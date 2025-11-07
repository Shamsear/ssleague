import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { verifyAuth } from '@/lib/auth-helper';
import { adminDb } from '@/lib/firebase/admin';
import { batchGetFirebaseFields } from '@/lib/firebase/batch';
import { logAuctionWin } from '@/lib/transaction-logger';
import { triggerNews } from '@/lib/news/trigger';
import { generateTiebreakerId } from '@/lib/id-generator';
import { broadcastSquadUpdate, broadcastWalletUpdate } from '@/lib/realtime/broadcast';

// WebSocket broadcast function (set by WebSocket server)
declare global {
  var wsBroadcast: ((channel: string, data: any) => void) | undefined;
}

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

/**
 * POST /api/admin/bulk-rounds/:id/finalize
 * Finalize bulk round: detect conflicts, assign singles, create tiebreakers
 * Committee admin only
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ✅ ZERO FIREBASE READS - Uses JWT claims only
    const auth = await verifyAuth(['admin', 'committee_admin'], request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: roundId } = await params;

    console.log(`🔍 Finalizing bulk round ${roundId}`);

    // Get round details
    const roundCheck = await sql`
      SELECT id, status, round_number, season_id, base_price
      FROM rounds
      WHERE id = ${roundId}
      AND round_type = 'bulk'
    `;

    if (roundCheck.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Bulk round not found' },
        { status: 404 }
      );
    }

    const round = roundCheck[0];

    if (round.status === 'completed') {
      // Round already finalized - return success with current state
      const soldPlayers = await sql`
        SELECT COUNT(*) as count FROM round_players
        WHERE round_id = ${roundId} AND status = 'sold'
      `;
      const contestedPlayers = await sql`
        SELECT COUNT(*) as count FROM round_players
        WHERE round_id = ${roundId} AND bid_count > 1
      `;
      
      return NextResponse.json({
        success: true,
        data: {
          round_id: roundId,
          round_number: round.round_number,
          status: 'completed',
          immediately_assigned: soldPlayers[0]?.count || 0,
          conflicts: contestedPlayers[0]?.count || 0,
          message: 'Round already finalized. No changes made.',
        },
      });
    }

    if (round.status !== 'active') {
      return NextResponse.json(
        { success: false, error: `Cannot finalize round. Current status: ${round.status}. Round must be active.` },
        { status: 400 }
      );
    }

    console.log(`⚡ Analyzing bids for round ${round.round_number}...`);

    // Get all bids for this round
    console.time('Fetch bids');
    const allBids = await sql`
      SELECT 
        rb.player_id,
        rb.team_id,
        rb.team_name,
        rb.bid_amount,
        COUNT(*) OVER (PARTITION BY rb.player_id) as bid_count
      FROM round_bids rb
      WHERE rb.round_id = ${roundId}
      ORDER BY rb.player_id, rb.bid_time ASC
    `;
    console.timeEnd('Fetch bids');

    console.log(`📊 Found ${allBids.length} total bids`);

    // Group bids by player
    const bidsByPlayer = new Map<string, any[]>();
    for (const bid of allBids) {
      if (!bidsByPlayer.has(bid.player_id)) {
        bidsByPlayer.set(bid.player_id, []);
      }
      bidsByPlayer.get(bid.player_id)!.push(bid);
    }

    // Separate into singles and conflicts
    const singleBidders: string[] = [];
    const conflicts: string[] = [];

    for (const [playerId, bids] of bidsByPlayer.entries()) {
      if (bids.length === 1) {
        singleBidders.push(playerId);
      } else if (bids.length > 1) {
        conflicts.push(playerId);
      }
    }

    console.log(`✅ Single bidders: ${singleBidders.length}`);
    console.log(`⚠️ Conflicts: ${conflicts.length}`);

    let immediatelyAssigned = 0;
    let tiebreakerCreated = 0;

    // Get contract duration from auction settings
    let contractDuration = 2;
    try {
      const settingsResult = await sql`
        SELECT contract_duration FROM auction_settings WHERE season_id = ${round.season_id} LIMIT 1
      `;
      if (settingsResult.length > 0 && settingsResult[0].contract_duration) {
        contractDuration = settingsResult[0].contract_duration;
      }
    } catch (error) {
      console.warn('Could not fetch contract_duration, using default of 2');
    }
    
    const seasonNum = parseInt(round.season_id?.replace(/\D/g, '') || '0');
    const seasonPrefix = round.season_id?.replace(/\d+$/, '') || 'S';
    const contractEndSeason = `${seasonPrefix}${seasonNum + contractDuration - 1}`;

    // Get player details for single bidders
    let singlePlayerDetailsMap = new Map();
    if (singleBidders.length > 0) {
      const singlePlayerDetails = await sql`
        SELECT 
          rp.player_id,
          rp.player_name,
          rp.position
        FROM round_players rp
        WHERE rp.round_id = ${roundId}
        AND rp.player_id = ANY(${singleBidders})
      `;
      for (const p of singlePlayerDetails) {
        singlePlayerDetailsMap.set(p.player_id, p);
      }
    }
    
    // PART 1: Immediately assign players with single bidder
    if (singleBidders.length > 0) {
      console.log(`\n🎯 Assigning ${singleBidders.length} players with single bidders...`);

      for (const playerId of singleBidders) {
        const bid = bidsByPlayer.get(playerId)![0];
        const playerInfo = singlePlayerDetailsMap.get(playerId);
        const contractId = `contract_${playerId}_${round.season_id}_${Date.now()}`;

        // Update round_players
        await sql`
          UPDATE round_players
          SET 
            winning_team_id = ${bid.team_id},
            winning_bid = ${round.base_price},
            status = 'sold',
            bid_count = 1
          WHERE round_id = ${roundId}
          AND player_id = ${playerId}
        `;

        // Mark the winning bid
        await sql`
          UPDATE round_bids
          SET is_winning = true
          WHERE round_id = ${roundId}
          AND player_id = ${playerId}
          AND team_id = ${bid.team_id}
        `;

        // Insert into team_players to track player ownership (skip if already exists)
        const teamPlayerResult = await sql`
          INSERT INTO team_players (
            team_id,
            player_id,
            season_id,
            round_id,
            purchase_price,
            acquired_at
          ) VALUES (
            ${bid.team_id},
            ${playerId},
            ${round.season_id},
            ${roundId},
            ${round.base_price},
            NOW()
          )
          ON CONFLICT (player_id, season_id) DO UPDATE
          SET 
            team_id = EXCLUDED.team_id,
            round_id = EXCLUDED.round_id,
            purchase_price = EXCLUDED.purchase_price
          RETURNING (xmax = 0) AS inserted
        `;
        
        const wasInserted = teamPlayerResult[0]?.inserted;
        if (!wasInserted) {
          console.log(`🔄 Updated existing team_players entry for player ${playerId}`);
        }

        // Update player in footballplayers table with contract info (idempotent)
        const playerUpdateResult = await sql`
          UPDATE footballplayers
          SET 
            is_sold = true,
            team_id = ${bid.team_id},
            acquisition_value = ${round.base_price},
            status = 'active',
            contract_id = ${contractId},
            contract_start_season = ${round.season_id},
            contract_end_season = ${contractEndSeason},
            contract_length = ${contractDuration},
            season_id = ${round.season_id},
            round_id = ${roundId},
            updated_at = NOW()
          WHERE id = ${playerId}
        `;
        
        if (playerUpdateResult.length === 0) {
          console.warn(`⚠️ Player ${playerId} not found in footballplayers table`);
        }

        // Update Neon teams table - bid.team_id contains readable team ID (SSPSLT0001)
        // Check if player already assigned to this team to avoid double-deducting budget
        const existingAssignment = await sql`
          SELECT team_id FROM team_players
          WHERE player_id = ${playerId}
          AND season_id = ${round.season_id}
        `;
        
        const isNewAssignment = existingAssignment.length === 0 || existingAssignment[0].team_id !== bid.team_id;
        
        if (isNewAssignment) {
          try {
            await sql`
              UPDATE teams 
              SET 
                football_spent = football_spent + ${round.base_price},
                football_budget = football_budget - ${round.base_price},
                football_players_count = football_players_count + 1,
                updated_at = NOW()
              WHERE id = ${bid.team_id}
              AND season_id = ${round.season_id}
            `;
            console.log(`✅ Updated Neon teams table for ${bid.team_id}`);
          } catch (error) {
            console.error(`❌ Error updating Neon teams for ${bid.team_id}:`, error);
          }
        } else {
          console.log(`🔄 Skipped team budget update (player already assigned to ${bid.team_id})`);
        }

        // Get firebase_uid for this team for Firebase updates
        const teamFirebaseResult = await sql`
          SELECT firebase_uid FROM teams
          WHERE id = ${bid.team_id}
          AND season_id = ${round.season_id}
          LIMIT 1
        `;
        
        const firebaseUid = teamFirebaseResult[0]?.firebase_uid;
        if (!firebaseUid) {
          console.warn(`⚠️ No firebase_uid found for team ${bid.team_id}`);
          immediatelyAssigned++;
          continue;
        }

        // Update Firebase team_seasons using firebase_uid
        const teamSeasonId = `${firebaseUid}_${round.season_id}`;
        const teamSeasonRef = adminDb.collection('team_seasons').doc(teamSeasonId);
        const teamSeasonSnap = await teamSeasonRef.get();
        
        if (teamSeasonSnap.exists) {
          const teamSeasonData = teamSeasonSnap.data();
          const currencySystem = teamSeasonData?.currency_system || 'single';
          const isDualCurrency = currencySystem === 'dual';
          
          // Get current budget based on currency system
          const currentBudget = isDualCurrency 
            ? (teamSeasonData?.football_budget || 0)
            : (teamSeasonData?.budget || 0);
          
          // Get player position for position counts
          const playerPosition = playerInfo?.position;
          const positionCounts = teamSeasonData?.position_counts || {};
          if (playerPosition && playerPosition in positionCounts) {
            positionCounts[playerPosition] = (positionCounts[playerPosition] || 0) + 1;
          }
          
          // Prepare update object
          const updateData: any = {
            total_spent: (teamSeasonData?.total_spent || 0) + round.base_price,
            players_count: (teamSeasonData?.players_count || 0) + 1,
            position_counts: positionCounts,
            updated_at: new Date()
          };
          
          // Update budget based on currency system
          if (isDualCurrency) {
            updateData.football_budget = currentBudget - round.base_price;
            updateData.football_spent = (teamSeasonData?.football_spent || 0) + round.base_price;
          } else {
            updateData.budget = currentBudget - round.base_price;
          }
          
          // Update balance
          await teamSeasonRef.update(updateData);
          
          // Log transaction using firebase_uid
          await logAuctionWin(
            firebaseUid,
            round.season_id,
            playerInfo?.player_name || 'Unknown Player',
            playerId,
            'football',
            round.base_price,
            currentBudget,
            roundId
          );
          
          console.log(`💰 Updated Firebase: Deducted £${round.base_price} from team ${firebaseUid}`);
          
          // Broadcast squad and wallet updates to team
          await broadcastTeamUpdate(bid.team_id, 'squad', {
            player_id: playerId,
            player_name: playerInfo?.player_name,
            action: 'acquired',
            price: round.base_price,
          });
          
          await broadcastTeamUpdate(bid.team_id, 'wallet', {
            new_balance: isDualCurrency ? updateData.football_budget : updateData.budget,
            amount_spent: round.base_price,
            currency_type: isDualCurrency ? 'football' : 'single',
          });
        } else {
          console.warn(`⚠️ Team season ${teamSeasonId} not found in Firebase`);
        }

        immediatelyAssigned++;
      }

      console.log(`✅ Assigned ${immediatelyAssigned} players immediately`);
    }

    // PART 2: Update bid counts for contested players
    if (conflicts.length > 0) {
      console.log(`\n⚠️ Found ${conflicts.length} contested players (manual tiebreaker creation required)`);
      
      // Update round_players with correct bid counts for contested players
      for (const playerId of conflicts) {
        const bids = bidsByPlayer.get(playerId)!;
        await sql`
          UPDATE round_players
          SET 
            bid_count = ${bids.length},
            status = 'pending'
          WHERE round_id = ${roundId}
          AND player_id = ${playerId}
        `;
      }
      
      tiebreakerCreated = conflicts.length; // Track count for status
    }

    // PART 3: Handle players with no bids (unsold)
    const playersWithBids = Array.from(bidsByPlayer.keys());
    if (playersWithBids.length > 0) {
      await sql`
        UPDATE round_players
        SET status = 'unsold'
        WHERE round_id = ${roundId}
        AND status = 'pending'
        AND player_id != ALL(${playersWithBids})
      `;
    }

    // Update round status
    // Mark as completed (not pending_tiebreakers) so committee can manually create tiebreakers
    const newStatus = 'completed';
    await sql`
      UPDATE rounds
      SET status = ${newStatus}, updated_at = NOW()
      WHERE id = ${roundId}
    `;

    console.log(`\n🎉 Finalization complete!`);
    console.log(`   Immediately assigned: ${immediatelyAssigned}`);
    console.log(`   Tiebreakers created: ${tiebreakerCreated}`);
    console.log(`   New status: ${newStatus}`);

    // Broadcast round completion via WebSocket
    if (global.wsBroadcast) {
      global.wsBroadcast(`round:${roundId}`, {
        type: 'round_updated',
        data: {
          round_id: roundId,
          status: newStatus,
          immediately_assigned: immediatelyAssigned,
          tiebreakers_created: tiebreakerCreated,
        },
      });
      console.log(`📢 [WebSocket] Broadcast round completion to round:${roundId}`);
    }

    // Generate news for bulk round completion
    if (immediatelyAssigned > 0) {
      try {
        // Collect all allocations for news
        const allocations = [];
        for (const playerId of singleBidders) {
          const bid = bidsByPlayer.get(playerId)![0];
          const playerInfo = singlePlayerDetailsMap.get(playerId);
          allocations.push({
            player_name: playerInfo?.player_name || 'Unknown',
            team_name: bid.team_name,
            amount: round.base_price,
          });
        }

        // Calculate stats
        const totalSpent = immediatelyAssigned * round.base_price;
        const avgBid = round.base_price; // Fixed price for bulk rounds

        await triggerNews('auction_highlights', {
          season_id: round.season_id,
          round_id: roundId,
          round_number: round.round_number,
          round_type: 'bulk',
          total_spent: totalSpent,
          average_bid: avgBid,
          base_price: round.base_price,
          players_allocated: immediatelyAssigned,
          conflicts_created: tiebreakerCreated,
          all_allocations: allocations,
        });

        console.log('📰 News generated for bulk round completion');
      } catch (newsError) {
        console.error('Failed to generate news:', newsError);
        // Don't fail the finalization if news generation fails
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        round_id: roundId,
        round_number: round.round_number,
        status: newStatus,
        immediately_assigned: immediatelyAssigned,
        conflicts: tiebreakerCreated,
        tiebreakers_created: tiebreakerCreated,
        total_bids: allBids.length,
        message: tiebreakerCreated > 0 
          ? `${immediatelyAssigned} players assigned immediately. ${tiebreakerCreated} tiebreakers created for conflicts.`
          : `All ${immediatelyAssigned} players assigned successfully. No conflicts.`,
      },
    });

  } catch (error: any) {
    console.error('❌ Error finalizing bulk round:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
