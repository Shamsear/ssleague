/**
 * Finalize Bulk Tiebreaker - Assign player to winner with contract info
 */

import { neon } from '@neondatabase/serverless';
import { logAuctionWin } from './transaction-logger';
import { getFirestore } from 'firebase-admin/firestore';

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

export interface BulkTiebreakerFinalizeResult {
  success: boolean;
  winner_team_id?: string;
  winning_amount?: number;
  player_id?: string;
  error?: string;
}

/**
 * Finalize a bulk tiebreaker by assigning the player to the winner
 * Sets contract fields (status, contract_id, etc.)
 */
export async function finalizeBulkTiebreaker(
  tiebreakerId: string
): Promise<BulkTiebreakerFinalizeResult> {
  try {
    // Get tiebreaker details
    const tiebreakerResult = await sql`
      SELECT 
        t.id,
        t.player_id,
        t.player_name,
        t.round_id,
        t.current_highest_bid,
        t.current_highest_team_id,
        t.status
      FROM bulk_tiebreakers t
      WHERE t.id = ${tiebreakerId}
    `;

    if (tiebreakerResult.length === 0) {
      return {
        success: false,
        error: 'Tiebreaker not found',
      };
    }

    const tiebreaker = tiebreakerResult[0];

    // Check if already finalized
    if (tiebreaker.status === 'finalized') {
      return {
        success: false,
        error: 'Tiebreaker already finalized',
      };
    }

    // Must have a winner
    if (!tiebreaker.current_highest_team_id) {
      return {
        success: false,
        error: 'No winner determined yet',
      };
    }

    // Get round and season info
    const roundResult = await sql`
      SELECT season_id, base_price FROM rounds WHERE id = ${tiebreaker.round_id}
    `;

    if (roundResult.length === 0) {
      return {
        success: false,
        error: 'Round not found',
      };
    }

    const round = roundResult[0];
    const seasonId = round.season_id;
    const winningAmount = tiebreaker.current_highest_bid;

    // Get contract duration from auction settings
    let contractDuration = 2;
    try {
      const settingsResult = await sql`
        SELECT contract_duration FROM auction_settings WHERE season_id = ${seasonId} LIMIT 1
      `;
      if (settingsResult.length > 0 && settingsResult[0].contract_duration) {
        contractDuration = settingsResult[0].contract_duration;
      }
    } catch (error) {
      console.warn('Could not fetch contract_duration, using default of 2');
    }

    // Calculate contract end season
    const seasonNum = parseInt(seasonId?.replace(/\D/g, '') || '0');
    const seasonPrefix = seasonId?.replace(/\d+$/, '') || 'S';
    const contractEndSeason = `${seasonPrefix}${seasonNum + contractDuration - 1}`;
    const contractId = `contract_${tiebreaker.player_id}_${seasonId}_${Date.now()}`;

    // Update round_players
    await sql`
      UPDATE round_players
      SET 
        winning_team_id = ${tiebreaker.current_highest_team_id},
        winning_bid = ${winningAmount},
        status = 'sold'
      WHERE round_id = ${tiebreaker.round_id}
      AND player_id = ${tiebreaker.player_id}
    `;

    // Update player in footballplayers table with contract info
    await sql`
      UPDATE footballplayers
      SET 
        is_sold = true,
        team_id = ${tiebreaker.current_highest_team_id},
        acquisition_value = ${winningAmount},
        status = 'active',
        contract_id = ${contractId},
        contract_start_season = ${seasonId},
        contract_end_season = ${contractEndSeason},
        contract_length = ${contractDuration},
        season_id = ${seasonId},
        round_id = ${tiebreaker.round_id},
        updated_at = NOW()
      WHERE id = ${tiebreaker.player_id}
    `;

    // Mark tiebreaker as finalized
    await sql`
      UPDATE bulk_tiebreakers
      SET 
        status = 'finalized',
        finalized_at = NOW(),
        updated_at = NOW()
      WHERE id = ${tiebreakerId}
    `;

    console.log(`✅ Bulk tiebreaker ${tiebreakerId} finalized. Winner: Team ${tiebreaker.current_highest_team_id}, Amount: £${winningAmount}`);
    
    // Update team balance and log transaction
    const adminDb = getFirestore();
    const teamSeasonId = `${tiebreaker.current_highest_team_id}_${seasonId}`;
    const teamSeasonRef = adminDb.collection('team_seasons').doc(teamSeasonId);
    const teamSeasonSnap = await teamSeasonRef.get();
    
    if (teamSeasonSnap.exists) {
      const teamSeasonData = teamSeasonSnap.data();
      const currentBalance = teamSeasonData?.euro_balance || 0;
      const newBalance = currentBalance - winningAmount;
      
      // Update balance
      await teamSeasonRef.update({
        euro_balance: newBalance,
        updated_at: new Date()
      });
      
      // Log auction win transaction
      await logAuctionWin(
        tiebreaker.current_highest_team_id,
        seasonId,
        tiebreaker.player_name || 'Unknown Player',
        tiebreaker.player_id,
        'football',
        winningAmount,
        currentBalance,
        tiebreaker.round_id
      );
      
      console.log(`💰 Deducted £${winningAmount} from team ${tiebreaker.current_highest_team_id}`);
    } else {
      console.warn(`⚠️ Team season ${teamSeasonId} not found - balance not updated`);
    }

    return {
      success: true,
      winner_team_id: tiebreaker.current_highest_team_id,
      winning_amount: winningAmount,
      player_id: tiebreaker.player_id,
    };
  } catch (error: any) {
    console.error('Error finalizing bulk tiebreaker:', error);
    return {
      success: false,
      error: error.message || 'Failed to finalize bulk tiebreaker',
    };
  }
}
