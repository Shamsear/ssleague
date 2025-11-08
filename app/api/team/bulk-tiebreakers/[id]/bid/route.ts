import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { verifyAuth } from '@/lib/auth-helper';
import { finalizeBulkTiebreaker } from '@/lib/finalize-bulk-tiebreaker';
import { broadcastTiebreakerBid } from '@/lib/realtime/broadcast';
import { calculateReserve } from '@/lib/reserve-calculator';
import { sendNotification } from '@/lib/notifications/send-notification';

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

/**
 * POST /api/team/bulk-tiebreakers/:id/bid
 * Place a bid in tiebreaker auction (Last Person Standing)
 * Team users only
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ✅ ZERO FIREBASE READS - Uses JWT claims only
    const auth = await verifyAuth(['team'], request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const firebaseUid = auth.userId!;

    const { id: tiebreakerId } = await params;
    const { bid_amount } = await request.json();

    // Validate input
    if (!bid_amount || typeof bid_amount !== 'number' || bid_amount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Valid bid_amount is required' },
        { status: 400 }
      );
    }

    // Get team_id and team_name from teams table using firebase_uid
    const teamResult = await sql`
      SELECT id, name FROM teams
      WHERE firebase_uid = ${firebaseUid}
    `;

    if (teamResult.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Team not found. Please ensure your team is registered.' },
        { status: 404 }
      );
    }

    const teamId = teamResult[0].id;
    const teamName = teamResult[0].name || 'Unknown Team';

    console.log(`💰 Team ${teamId} (firebase: ${firebaseUid}) bidding £${bid_amount} on tiebreaker ${tiebreakerId}`);

    // Get tiebreaker details
    const tiebreakerCheck = await sql`
      SELECT 
        id, 
        bulk_round_id,
        player_name, 
        status, 
        season_id,
        current_highest_bid,
        current_highest_team_id,
        max_end_time
      FROM bulk_tiebreakers
      WHERE id = ${tiebreakerId}
    `;

    if (tiebreakerCheck.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Tiebreaker not found' },
        { status: 404 }
      );
    }

    const tiebreaker = tiebreakerCheck[0];

    // VALIDATION 1: Tiebreaker must be active or ongoing
    if (tiebreaker.status !== 'active' && tiebreaker.status !== 'ongoing') {
      return NextResponse.json(
        { success: false, error: `Tiebreaker is not active. Current status: ${tiebreaker.status}` },
        { status: 400 }
      );
    }

    // VALIDATION 2: Check if within 24 hour limit
    if (tiebreaker.max_end_time) {
      const now = new Date();
      const maxEnd = new Date(tiebreaker.max_end_time);
      if (now > maxEnd) {
        return NextResponse.json(
          { success: false, error: 'Tiebreaker has exceeded 24 hour limit. Admin must finalize.' },
          { status: 400 }
        );
      }
    }

    // VALIDATION 3: Check if team is participating
    const teamCheck = await sql`
      SELECT status, current_bid
      FROM bulk_tiebreaker_teams
      WHERE tiebreaker_id = ${tiebreakerId}
      AND team_id = ${teamId}
    `;

    if (teamCheck.length === 0) {
      return NextResponse.json(
        { success: false, error: 'You are not participating in this tiebreaker' },
        { status: 403 }
      );
    }

    const teamData = teamCheck[0];

    // VALIDATION 4: Team must not be withdrawn
    if (teamData.status === 'withdrawn') {
      return NextResponse.json(
        { success: false, error: 'You have already withdrawn from this tiebreaker' },
        { status: 400 }
      );
    }

    // VALIDATION 5: Bid must be higher than current highest (unless you're the current highest bidder)
    // If you're the current highest bidder, you can raise your own bid
    const isCurrentHighest = tiebreaker.current_highest_team_id === teamId;
    
    if (!isCurrentHighest && bid_amount <= tiebreaker.current_highest_bid) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Bid must be higher than current highest bid of £${tiebreaker.current_highest_bid}`,
          current_highest_bid: tiebreaker.current_highest_bid,
          should_refresh: true
        },
        { status: 400 }
      );
    }
    
    // If you're already the highest bidder, just ensure new bid is higher than your current bid
    if (isCurrentHighest && bid_amount <= teamData.current_bid) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Your new bid must be higher than your current bid of £${teamData.current_bid}`
        },
        { status: 400 }
      );
    }

    // VALIDATION 6: Check team balance from Neon teams table
    // Get season_id from bulk_tiebreakers (already has it)
    const seasonId = tiebreaker.season_id;

    const balanceData = await sql`
      SELECT football_budget
      FROM teams
      WHERE id = ${teamId}
      AND season_id = ${seasonId}
    `;
    
    let balance = 1000;
    if (balanceData.length > 0) {
      balance = parseInt(balanceData[0].football_budget) || 1000;
    }

    if (bid_amount > balance) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Insufficient balance. Bid: £${bid_amount}, Available: £${balance}` 
        },
        { status: 400 }
      );
    }

    // VALIDATION 7: Check phase-based reserve requirement
    try {
      const reserveCheck = await calculateReserve(teamId, tiebreaker.bulk_round_id, seasonId);
      
      if (reserveCheck.requiresReserve) {
        const maxAllowedBid = balance - reserveCheck.minimumReserve;
        
        if (bid_amount > maxAllowedBid) {
          return NextResponse.json(
            {
              success: false,
              error: `Bid exceeds reserve. You must maintain £${reserveCheck.minimumReserve} for future rounds (${reserveCheck.explanation}). Maximum safe bid: £${Math.max(0, maxAllowedBid)}`
            },
            { status: 400 }
          );
        }
      }
      
      console.log(`✅ Reserve check passed: Balance £${balance}, Reserve £${reserveCheck.minimumReserve}, Bid £${bid_amount}`);
    } catch (reserveError) {
      console.error('⚠️ Reserve check failed:', reserveError);
      // Continue without reserve check (non-blocking)
    }

    // ALL VALIDATIONS PASSED - Place bid
    console.log('✅ All validations passed. Placing bid...');

    const bidTime = new Date();

    // Insert bid into history
    await sql`
      INSERT INTO bulk_tiebreaker_bids (
        tiebreaker_id,
        team_id,
        team_name,
        bid_amount,
        bid_time
      ) VALUES (
        ${tiebreakerId},
        ${teamId},
        ${teamName},
        ${bid_amount},
        ${bidTime.toISOString()}
      )
    `;

    // Update team's current bid
    await sql`
      UPDATE bulk_tiebreaker_teams
      SET current_bid = ${bid_amount}
      WHERE tiebreaker_id = ${tiebreakerId}
      AND team_id = ${teamId}
    `;

    // Update tiebreaker with new highest bid (with optimistic locking)
    // Allow update if: bid is higher OR you're the current highest bidder raising your own bid OR it's the first bid (NULL)
    const updateResult = await sql`
      UPDATE bulk_tiebreakers
      SET 
        current_highest_bid = ${bid_amount},
        current_highest_team_id = ${teamId},
        last_activity_time = ${bidTime.toISOString()},
        updated_at = NOW()
      WHERE id = ${tiebreakerId}
      AND (current_highest_bid IS NULL OR current_highest_bid < ${bid_amount} OR current_highest_team_id = ${teamId})
      RETURNING current_highest_bid
    `;
    
    // Check if update succeeded (race condition check)
    if (updateResult.length === 0) {
      // Someone else bid higher in the meantime (or you're no longer the highest bidder)
      const latestTiebreaker = await sql`
        SELECT current_highest_bid, current_highest_team_id
        FROM bulk_tiebreakers
        WHERE id = ${tiebreakerId}
      `;
      
      const actualHighest = latestTiebreaker[0]?.current_highest_bid || bid_amount;
      const actualHighestTeam = latestTiebreaker[0]?.current_highest_team_id;
      
      // Only return error if someone else is now the highest bidder
      if (actualHighestTeam !== teamId) {
        return NextResponse.json(
          { 
            success: false, 
            error: `Bid was outbid! Current highest bid is now £${actualHighest}`,
            current_highest_bid: actualHighest,
            should_refresh: true
          },
          { status: 409 } // 409 Conflict
        );
      }
    }

    console.log(`✅ Bid placed: £${bid_amount} by team ${teamId}`);

    // Check if this is the last team (auto-finalize condition)
    const activeTeamsCheck = await sql`
      SELECT COUNT(*) as teams_left
      FROM bulk_tiebreaker_teams
      WHERE tiebreaker_id = ${tiebreakerId}
      AND status = 'active'
    `;

    const teamsLeft = parseInt(activeTeamsCheck[0]?.teams_left) || 0;
    const isWinner = teamsLeft === 1;

    // ✅ Broadcast to Firebase Realtime DB for instant updates
    await broadcastTiebreakerBid(
      tiebreaker.season_id,
      tiebreakerId,
      {
        team_id: teamId,
        team_name: teamName,
        bid_amount,
      }
    );
    
    // 📨 Send push notifications to all other participating teams
    try {
      // Get all participating teams except the bidder
      const participatingTeams = await sql`
        SELECT team_id
        FROM bulk_tiebreaker_teams
        WHERE tiebreaker_id = ${tiebreakerId}
        AND status = 'active'
        AND team_id != ${teamId}
      `;
      
      if (participatingTeams.length > 0) {
        // Get Firebase UIDs for these teams
        const teamIdsToNotify = participatingTeams.map(t => t.team_id);
        const teamFirebaseUids = await sql`
          SELECT firebase_uid
          FROM teams
          WHERE id = ANY(${teamIdsToNotify})
          AND season_id = ${seasonId}
        `;
        
        const userIdsToNotify = teamFirebaseUids.map(t => t.firebase_uid).filter(Boolean);
        
        if (userIdsToNotify.length > 0) {
          await sendNotification(
            {
              title: 'New Tiebreaker Bid',
              body: `${teamName} bid £${bid_amount} for ${tiebreaker.player_name}`,
              url: `/dashboard/team/bulk-tiebreaker/${tiebreakerId}`,
              data: {
                type: 'tiebreaker_bid',
                tiebreaker_id: tiebreakerId,
                player_name: tiebreaker.player_name,
                bid_amount: bid_amount.toString(),
              }
            },
            { userIds: userIdsToNotify }
          );
          console.log(`📨 Sent notifications to ${userIdsToNotify.length} teams`);
        }
      }
    } catch (notifError) {
      console.error('⚠️ Failed to send notifications:', notifError);
      // Don't fail the bid if notifications fail
    }

    if (isWinner) {
      console.log(`🏆 AUTO-FINALIZE: Only 1 team left! Team ${teamId} wins!`);
      
      // Auto-finalize immediately
      const finalizeResult = await finalizeBulkTiebreaker(tiebreakerId);
      
      if (!finalizeResult.success) {
        console.error(`⚠️ Failed to auto-finalize tiebreaker: ${finalizeResult.error}`);
        // Still mark as pending for manual finalization
        await sql`
          UPDATE bulk_tiebreakers
          SET status = 'auto_finalize_pending'
          WHERE id = ${tiebreakerId}
        `;
      } else {
        console.log(`✅ Tiebreaker auto-finalized successfully`);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        tiebreaker_id: tiebreakerId,
        player_name: tiebreaker.player_name,
        your_bid: bid_amount,
        current_highest_bid: bid_amount,
        you_are_highest: true,
        teams_remaining: teamsLeft,
        is_winner: isWinner,
        message: isWinner 
          ? `🏆 Congratulations! You are the last team standing. You win ${tiebreaker.player_name} for £${bid_amount}!`
          : `Bid placed successfully! You are now the highest bidder at £${bid_amount}. You cannot withdraw while leading.`,
      },
    });

  } catch (error: any) {
    console.error('❌ Error placing tiebreaker bid:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
