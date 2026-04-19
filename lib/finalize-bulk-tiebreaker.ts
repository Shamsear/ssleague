/**
 * Finalize Bulk Tiebreaker - Assign player to winner with contract info
 */

import { neon } from '@neondatabase/serverless';
import { logAuctionWin } from './transaction-logger';
import { getFirestore } from 'firebase-admin/firestore';
import { triggerNews } from './news/trigger';
import { broadcastSquadUpdate, broadcastWalletUpdate } from './realtime/broadcast';
import { sendNotificationToSeason } from './notifications/send-notification';

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

    // ✅ SLOT VALIDATION: Check if winner has available slots
    const winnerSlotCheck = await sql`
      SELECT 
        football_total_slots,
        football_players_count
      FROM teams
      WHERE id = ${tiebreaker.current_highest_team_id}
      AND season_id = ${seasonId}
    `;

    if (winnerSlotCheck.length === 0) {
      return {
        success: false,
        error: `Winner team ${tiebreaker.current_highest_team_id} not found in teams table`,
      };
    }

    const winner = winnerSlotCheck[0];
    const totalSlots = parseInt(winner.football_total_slots) || 25;
    const currentCount = parseInt(winner.football_players_count) || 0;
    const availableSlots = totalSlots - currentCount;

    console.log(`🔍 Slot check for winner ${tiebreaker.current_highest_team_id}: ${currentCount}/${totalSlots} (${availableSlots} available)`);

    if (availableSlots <= 0) {
      return {
        success: false,
        error: `Winner team has no available slots (${currentCount}/${totalSlots}). Cannot assign player.`,
      };
    }

    console.log(`✅ Winner has ${availableSlots} available slots - proceeding with assignment`);

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

    // Insert into team_players table (check if exists first to avoid constraint issues)
    const existingTeamPlayer = await sql`
      SELECT id FROM team_players
      WHERE team_id = ${tiebreaker.current_highest_team_id}
      AND player_id = ${tiebreaker.player_id}
    `;
    
    if (existingTeamPlayer.length > 0) {
      // Update existing record
      await sql`
        UPDATE team_players
        SET 
          season_id = ${seasonId},
          round_id = ${tiebreaker.round_id},
          purchase_price = ${winningAmount},
          acquired_at = NOW()
        WHERE team_id = ${tiebreaker.current_highest_team_id}
        AND player_id = ${tiebreaker.player_id}
      `;
    } else {
      // Insert new record
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
      `;
    }

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

    // Mark the winning bid in round_bids table
    await sql`
      UPDATE round_bids
      SET is_winning = true
      WHERE round_id = ${tiebreaker.round_id}
      AND player_id = ${tiebreaker.player_id}
      AND team_id = ${tiebreaker.current_highest_team_id}
    `;

    console.log(`✅ Bulk tiebreaker ${tiebreakerId} finalized. Winner: Team ${tiebreaker.current_highest_team_id}, Amount: £${winningAmount}`);
    console.log(`✅ Updated both bulk_tiebreakers and tiebreakers tables`);
    
    // Check if all tiebreakers for this round are now resolved
    const unresolvedTiebreakers = await sql`
      SELECT COUNT(*) as count
      FROM bulk_tiebreakers
      WHERE bulk_round_id = ${tiebreaker.round_id}
      AND status NOT IN ('resolved', 'finalized')
    `;
    
    const unresolvedCount = parseInt(unresolvedTiebreakers[0]?.count || '0');
    console.log(`📊 Unresolved tiebreakers remaining for round: ${unresolvedCount}`);
    
    // If all tiebreakers are resolved, update round status to completed (if not already)
    if (unresolvedCount === 0) {
      await sql`
        UPDATE rounds
        SET 
          status = 'completed',
          updated_at = NOW()
        WHERE id = ${tiebreaker.round_id}
        AND status != 'completed'
      `;
      console.log(`✅ All tiebreakers resolved - Round ${tiebreaker.round_id} marked as completed`);
    } else {
      console.log(`⏳ ${unresolvedCount} tiebreaker(s) still pending for round ${tiebreaker.round_id}`);
    }
    
    // Update Neon teams table - deduct from football_budget, increase football_spent
    // Check if player already assigned to this team to avoid double-deducting budget
    const existingAssignment = await sql`
      SELECT team_id FROM team_players
      WHERE player_id = ${tiebreaker.player_id}
      AND season_id = ${seasonId}
    `;
    
    const isNewAssignment = existingAssignment.length === 0 || existingAssignment[0].team_id !== tiebreaker.current_highest_team_id;
    
    // Get firebase_uid for transaction check
    const teamFirebaseResult = await sql`
      SELECT firebase_uid FROM teams
      WHERE id = ${tiebreaker.current_highest_team_id}
      AND season_id = ${seasonId}
      LIMIT 1
    `;
    
    const firebaseUid = teamFirebaseResult[0]?.firebase_uid;
    
    // Check if transaction already exists in Firebase
    let transactionExists = false;
    if (firebaseUid) {
      const adminDb = getFirestore();
      const existingTxns = await adminDb.collection('transactions')
        .where('userId', '==', firebaseUid)
        .where('seasonId', '==', seasonId)
        .where('type', '==', 'auction_win')
        .get();
      
      transactionExists = existingTxns.docs.some(doc => {
        const metadata = doc.data().metadata || {};
        return metadata.playerId === tiebreaker.player_id;
      });
      
      if (transactionExists) {
        console.log(`✅ Transaction already exists for player ${tiebreaker.player_id}`);
      }
    }
    
    // Only update if it's a new assignment AND transaction doesn't exist
    const shouldUpdate = isNewAssignment && !transactionExists;
    
    if (shouldUpdate) {
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
    } else {
      if (!isNewAssignment) {
        console.log(`🔄 Skipped Neon update (player already assigned to ${tiebreaker.current_highest_team_id})`);
      }
      if (transactionExists) {
        console.log(`🔄 Skipped Neon update (transaction already exists)`);
      }
    }
    
    // Update team balance and log transaction in Firebase
    const adminDb = getFirestore();
    const teamSeasonId = `${tiebreaker.current_highest_team_id}_${seasonId}`;
    const teamSeasonRef = adminDb.collection('team_seasons').doc(teamSeasonId);
    const teamSeasonSnap = await teamSeasonRef.get();
    
    if (teamSeasonSnap.exists) {
      const teamSeasonData = teamSeasonSnap.data();
      
      // Only update if this is a new assignment AND transaction doesn't exist (prevent duplicate deductions)
      if (shouldUpdate) {
        // Detect currency system
        const currencySystem = teamSeasonData?.currency_system || 'single';
        const isDualCurrency = currencySystem === 'dual';

        // Get current budget based on currency system
        const currentBudget = isDualCurrency
          ? (teamSeasonData?.football_budget || 0)
          : (teamSeasonData?.budget || 0);
        
        const currentSpent = isDualCurrency
          ? (teamSeasonData?.football_spent || 0)
          : (teamSeasonData?.total_spent || 0);
        
        // Get current position counts
        const positionCounts = teamSeasonData?.position_counts || {};
        const currentPositionCount = positionCounts[tiebreaker.position] || 0;
        const newPositionCounts = {
          ...positionCounts,
          [tiebreaker.position]: currentPositionCount + 1
        };
        
        // Get current players count
        const currentPlayersCount = teamSeasonData?.players_count || 0;
        const newPlayersCount = currentPlayersCount + 1;
        
        // Prepare update object based on currency system
        const updateData: any = {
          position_counts: newPositionCounts,
          players_count: newPlayersCount,
          updated_at: new Date()
        };

        // Update budget and spent based on currency system
        if (isDualCurrency) {
          updateData.football_budget = currentBudget - winningAmount;
          updateData.football_spent = currentSpent + winningAmount;
        } else {
          updateData.budget = currentBudget - winningAmount;
          updateData.total_spent = currentSpent + winningAmount;
        }
        
        // Update Firebase
        await teamSeasonRef.update(updateData);
        
        // Log auction win transaction using firebase_uid
        if (firebaseUid) {
          await logAuctionWin(
            firebaseUid,
            seasonId,
            tiebreaker.player_name || 'Unknown Player',
            tiebreaker.player_id,
            'football',
            winningAmount,
            currentBudget,
            tiebreaker.round_id
          );
          console.log(`📝 Created transaction for ${tiebreaker.player_name || 'Unknown Player'}`);
        } else {
          console.warn(`⚠️ Could not find firebase_uid for team ${tiebreaker.current_highest_team_id} - transaction not logged`);
        }
        
        console.log(`💰 Updated team ${tiebreaker.current_highest_team_id}:`);
        console.log(`   - Currency system: ${currencySystem}`);
        console.log(`   - Deducted £${winningAmount} from ${isDualCurrency ? 'football_budget' : 'budget'} (${currentBudget} → ${currentBudget - winningAmount})`);
        console.log(`   - Increased ${isDualCurrency ? 'football_spent' : 'total_spent'} by £${winningAmount} (${currentSpent} → ${currentSpent + winningAmount})`);
        console.log(`   - Incremented ${tiebreaker.position} count (${currentPositionCount} → ${currentPositionCount + 1})`);
        console.log(`   - Incremented players_count (${currentPlayersCount} → ${newPlayersCount})`);
        
        // Broadcast real-time updates to team
        await broadcastSquadUpdate(seasonId, tiebreaker.current_highest_team_id, {
          player_id: tiebreaker.player_id,
          player_name: tiebreaker.player_name || 'Unknown Player',
          action: 'acquired',
          price: winningAmount,
        });

        await broadcastWalletUpdate(seasonId, tiebreaker.current_highest_team_id, {
          new_balance: isDualCurrency ? updateData.football_budget : updateData.budget,
          amount_spent: winningAmount,
          currency_type: isDualCurrency ? 'football' : 'single',
        });

        console.log(`📢 Broadcast squad and wallet updates to team ${tiebreaker.current_highest_team_id}`);
        
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

        // Send FCM notification to winner team
        try {
          await sendNotificationToSeason(
            {
              title: '🏆 Tiebreaker Won!',
              body: `${teamName} won ${tiebreaker.player_name} for £${winningAmount}!`,
              url: `/dashboard/team/squad`,
              icon: '/logo.png',
              data: {
                type: 'tiebreaker_won',
                playerId: tiebreaker.player_id,
                playerName: tiebreaker.player_name || 'Unknown Player',
                teamId: tiebreaker.current_highest_team_id,
                amount: winningAmount.toString()
              }
            },
            seasonId
          );
          console.log(`🔔 FCM notification sent for tiebreaker win`);
        } catch (notifError) {
          console.error('Failed to send tiebreaker win notification:', notifError);
          // Don't fail the finalization if notification fails
        }
      } else {
        if (!isNewAssignment) {
          console.log(`🔄 Skipped Firebase update (player already assigned to ${tiebreaker.current_highest_team_id})`);
        }
        if (transactionExists) {
          console.log(`🔄 Skipped Firebase update (transaction already exists)`);
        }
      }
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
