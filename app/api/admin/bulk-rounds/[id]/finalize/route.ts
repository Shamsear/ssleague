import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { cookies } from 'next/headers';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { batchGetFirebaseFields } from '@/lib/firebase/batch';
import { logAuctionWin } from '@/lib/transaction-logger';

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
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify Firebase ID token
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch (error) {
      console.error('Token verification error:', error);
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 401 }
      );
    }

    const userId = decodedToken.uid;

    // Check if user is committee admin
    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = userDoc.data();
    if (userData?.role !== 'admin' && userData?.role !== 'committee_admin') {
      return NextResponse.json(
        { success: false, error: 'Access denied. Committee admin only.' },
        { status: 403 }
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
          rp.player_name
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
            status = 'sold'
          WHERE round_id = ${roundId}
          AND player_id = ${playerId}
        `;

        // Update player in footballplayers table with contract info
        await sql`
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

        // Get team_season to update balance and log transaction
        const teamSeasonId = `${bid.team_id}_${round.season_id}`;
        const teamSeasonRef = adminDb.collection('team_seasons').doc(teamSeasonId);
        const teamSeasonSnap = await teamSeasonRef.get();
        
        if (teamSeasonSnap.exists) {
          const teamSeasonData = teamSeasonSnap.data();
          const currentBalance = teamSeasonData?.euro_balance || 0;
          const newBalance = currentBalance - round.base_price;
          
          // Update balance
          await teamSeasonRef.update({
            euro_balance: newBalance,
            updated_at: new Date()
          });
          
          // Log transaction
          await logAuctionWin(
            bid.team_id,
            round.season_id,
            playerInfo?.player_name || 'Unknown Player',
            playerId,
            'football',
            round.base_price,
            currentBalance,
            roundId
          );
          
          console.log(`💰 Deducted £${round.base_price} from team ${bid.team_id}`);
        } else {
          console.warn(`⚠️ Team season ${teamSeasonId} not found - balance not updated`);
        }

        immediatelyAssigned++;
      }

      console.log(`✅ Assigned ${immediatelyAssigned} players immediately`);
    }

    // PART 2: Create tiebreakers for conflicts
    if (conflicts.length > 0) {
      console.log(`\n⚔️ Creating ${conflicts.length} tiebreakers...`);

      // Get player details for tiebreakers
      const playerDetails = await sql`
        SELECT 
          rp.player_id,
          rp.player_name,
          rp.position
        FROM round_players rp
        WHERE rp.round_id = ${roundId}
        AND rp.player_id = ANY(${conflicts})
      `;

      const playerDetailsMap = new Map();
      for (const p of playerDetails) {
        playerDetailsMap.set(p.player_id, p);
      }

      for (const playerId of conflicts) {
        const bids = bidsByPlayer.get(playerId)!;
        const playerInfo = playerDetailsMap.get(playerId);

        // Create tiebreaker
        const tiebreakerResult = await sql`
          INSERT INTO bulk_tiebreakers (
            round_id,
            player_id,
            player_name,
            position,
            base_price,
            status,
            current_highest_bid,
            teams_remaining,
            created_at
          ) VALUES (
            ${roundId},
            ${playerId},
            ${playerInfo.player_name},
            ${playerInfo.position},
            ${round.base_price},
            'pending',
            ${round.base_price},
            ${bids.length},
            NOW()
          )
          RETURNING id
        `;

        const tiebreakerId = tiebreakerResult[0].id;

        // Add all teams to tiebreaker
        for (const bid of bids) {
          await sql`
            INSERT INTO bulk_tiebreaker_teams (
              tiebreaker_id,
              team_id,
              team_name,
              status,
              current_bid,
              joined_at
            ) VALUES (
              ${tiebreakerId},
              ${bid.team_id},
              ${bid.team_name},
              'active',
              ${round.base_price},
              NOW()
            )
          `;
        }

        console.log(`✅ Created tiebreaker ${tiebreakerId} for player ${playerInfo.player_name} (${bids.length} teams)`);
        tiebreakerCreated++;
      }
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
    const newStatus = tiebreakerCreated > 0 ? 'pending_tiebreakers' : 'completed';
    await sql`
      UPDATE rounds
      SET status = ${newStatus}, updated_at = NOW()
      WHERE id = ${roundId}
    `;

    console.log(`\n🎉 Finalization complete!`);
    console.log(`   Immediately assigned: ${immediatelyAssigned}`);
    console.log(`   Tiebreakers created: ${tiebreakerCreated}`);
    console.log(`   New status: ${newStatus}`);

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
