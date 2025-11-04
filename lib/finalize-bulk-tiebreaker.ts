/**
 * Finalize Bulk Tiebreaker - Assign player to winner with contract info
 */

import { neon } from '@neondatabase/serverless';
import { logAuctionWin } from './transaction-logger';
import { getFirestore } from 'firebase-admin/firestore';
import { triggerNews } from './news/trigger';

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
        t.player_position as position,
        t.bulk_round_id as round_id,
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
    if (tiebreaker.status === 'resolved' || tiebreaker.status === 'finalized') {
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

    // Insert into team_players table
    await sql`
      INSERT INTO team_players (
        team_id,
        player_id,
        season_id,
        round_id,
        purchase_price,
        acquired_at
      ) VALUES (
        ${tiebreaker.current_highest_team_id},
        ${tiebreaker.player_id},
        ${seasonId},
        ${tiebreaker.round_id},
        ${winningAmount},
        NOW()
      )
      ON CONFLICT (team_id, player_id) DO UPDATE
      SET 
        season_id = ${seasonId},
        round_id = ${tiebreaker.round_id},
        purchase_price = ${winningAmount},
        acquired_at = NOW()
    `;

    // Mark bulk tiebreaker as resolved
    await sql`
      UPDATE bulk_tiebreakers
      SET 
        status = 'resolved',
        resolved_at = NOW(),
        updated_at = NOW()
      WHERE id = ${tiebreakerId}
    `;
    
    // Also update the corresponding tiebreakers table entry
    await sql`
      UPDATE tiebreakers
      SET 
        status = 'resolved',
        winning_team_id = ${tiebreaker.current_highest_team_id},
        winning_bid = ${winningAmount},
        updated_at = NOW()
      WHERE id = ${tiebreakerId}
    `;

    console.log(`✅ Bulk tiebreaker ${tiebreakerId} finalized. Winner: Team ${tiebreaker.current_highest_team_id}, Amount: £${winningAmount}`);
    console.log(`✅ Updated both bulk_tiebreakers and tiebreakers tables`);
    
    // Update Neon teams table - deduct from football_budget, increase football_spent
    try {
      await sql`
        UPDATE teams
        SET 
          football_spent = football_spent + ${winningAmount},
          football_budget = football_budget - ${winningAmount},
          football_players_count = football_players_count + 1,
          updated_at = NOW()
        WHERE id = ${tiebreaker.current_highest_team_id}
        AND season_id = ${seasonId}
      `;
      console.log(`✅ Updated Neon teams table for ${tiebreaker.current_highest_team_id}`);
    } catch (error) {
      console.error(`❌ Error updating Neon teams table:`, error);
    }
    
    // Update team balance and log transaction in Firebase
    const adminDb = getFirestore();
    const teamSeasonId = `${tiebreaker.current_highest_team_id}_${seasonId}`;
    const teamSeasonRef = adminDb.collection('team_seasons').doc(teamSeasonId);
    const teamSeasonSnap = await teamSeasonRef.get();
    
    if (teamSeasonSnap.exists) {
      const teamSeasonData = teamSeasonSnap.data();
      
      // Get current balances and spent amounts
      const currentFootballBudget = teamSeasonData?.football_budget || 0;
      const currentFootballSpent = teamSeasonData?.football_spent || 0;
      const newFootballBudget = currentFootballBudget - winningAmount;
      const newFootballSpent = currentFootballSpent + winningAmount;
      
      // Get current position counts
      const positionCounts = teamSeasonData?.position_counts || {};
      const currentPositionCount = positionCounts[tiebreaker.position] || 0;
      const newPositionCounts = {
        ...positionCounts,
        [tiebreaker.position]: currentPositionCount + 1
      };
      
      // Update budget, spent, and position counts
      await teamSeasonRef.update({
        football_budget: newFootballBudget,
        football_spent: newFootballSpent,
        position_counts: newPositionCounts,
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
        currentFootballBudget,
        tiebreaker.round_id
      );
      
      console.log(`💰 Updated team ${tiebreaker.current_highest_team_id}:`);
      console.log(`   - Deducted £${winningAmount} from football_budget (${currentFootballBudget} → ${newFootballBudget})`);
      console.log(`   - Increased football_spent by £${winningAmount} (${currentFootballSpent} → ${newFootballSpent})`);
      console.log(`   - Incremented ${tiebreaker.position} count (${currentPositionCount} → ${currentPositionCount + 1})`);
      
      // Trigger news generation for Last Person Standing auction completion
      const teamName = teamSeasonData?.team_name || 'Team';
      await triggerNews('last_person_standing', {
        season_id: seasonId,
        player_id: tiebreaker.player_id,
        player_name: tiebreaker.player_name,
        team_id: tiebreaker.current_highest_team_id,
        team_name: teamName,
        team_winning: teamName,
        winning_bid: winningAmount,
        position: tiebreaker.position,
        context: `After an intense Last Person Standing auction, ${teamName} emerged victorious, securing ${tiebreaker.player_name} (${tiebreaker.position}) for £${winningAmount}. In this open bidding battle, rival teams withdrew one by one until only ${teamName} remained standing.`
      });
      
      console.log(`📰 News generation triggered for tiebreaker completion`);
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
