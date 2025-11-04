import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { cookies } from 'next/headers';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { finalizeBulkTiebreaker } from '@/lib/finalize-bulk-tiebreaker';
import { broadcastTiebreakerBid, broadcastWebSocket } from '@/lib/websocket/broadcast';

// WebSocket broadcast function (set by WebSocket server)
declare global {
  var wsBroadcast: ((channel: string, data: any) => void) | undefined;
}

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

    const firebaseUid = decodedToken.uid;

    // Check if user is a team
    const userDoc = await adminDb.collection('users').doc(firebaseUid).get();
    if (!userDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = userDoc.data();
    if (userData?.role !== 'team') {
      return NextResponse.json(
        { success: false, error: 'Access denied. Team users only.' },
        { status: 403 }
      );
    }

    const { id: tiebreakerId } = await params;
    const { bid_amount } = await request.json();

    // Validate input
    if (!bid_amount || typeof bid_amount !== 'number' || bid_amount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Valid bid_amount is required' },
        { status: 400 }
      );
    }

    // Get team_id from teams table using firebase_uid
    const teamResult = await sql`
      SELECT id FROM teams
      WHERE firebase_uid = ${firebaseUid}
    `;

    if (teamResult.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Team not found. Please ensure your team is registered.' },
        { status: 404 }
      );
    }

    const teamId = teamResult[0].id;

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

    // VALIDATION 5: Bid must be higher than current highest
    if (bid_amount <= tiebreaker.current_highest_bid) {
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

    // ALL VALIDATIONS PASSED - Place bid
    console.log('✅ All validations passed. Placing bid...');

    const bidTime = new Date();
    const teamName = userData.teamName || 'Unknown Team';

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
    // Allow update if either:
    // 1. New bid is higher than current highest, OR
    // 2. This team is already the highest bidder (re-bidding)
    const updateResult = await sql`
      UPDATE bulk_tiebreakers
      SET 
        current_highest_bid = ${bid_amount},
        current_highest_team_id = ${teamId},
        last_activity_time = ${bidTime.toISOString()},
        updated_at = NOW()
      WHERE id = ${tiebreakerId}
      AND (
        current_highest_bid < ${bid_amount}
        OR current_highest_team_id = ${teamId}
      )
      RETURNING current_highest_bid, current_highest_team_id
    `;
    
    // Check if update succeeded (race condition check)
    if (updateResult.length === 0) {
      // Someone else bid higher in the meantime
      const latestTiebreaker = await sql`
        SELECT current_highest_bid, current_highest_team_id
        FROM bulk_tiebreakers
        WHERE id = ${tiebreakerId}
      `;
      
      const actualHighest = latestTiebreaker[0]?.current_highest_bid || bid_amount;
      const actualHighestTeam = latestTiebreaker[0]?.current_highest_team_id;
      
      // Only return error if someone ELSE has a higher bid
      if (actualHighestTeam !== teamId && actualHighest >= bid_amount) {
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
      
      // If we reach here, update should have succeeded but didn't - retry once
      console.log('⚠️ Update failed unexpectedly, retrying...');
      const retryResult = await sql`
        UPDATE bulk_tiebreakers
        SET 
          current_highest_bid = ${bid_amount},
          current_highest_team_id = ${teamId},
          last_activity_time = ${bidTime.toISOString()},
          updated_at = NOW()
        WHERE id = ${tiebreakerId}
        RETURNING current_highest_bid
      `;
      
      if (retryResult.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Failed to update tiebreaker - please try again' },
          { status: 500 }
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

    // ✅ Broadcast to WebSocket clients for real-time updates
    // Broadcast to BOTH tiebreaker channel AND round channel
    await broadcastTiebreakerBid(tiebreakerId, {
      team_id: teamId,
      team_name: userData.teamName || 'Unknown Team',
      bid_amount,
      player_name: tiebreaker.player_name,
      teams_remaining: teamsLeft,
      is_winner: isWinner,
    });
    
    // ⚡ ALSO broadcast to round channel so committee page gets instant updates!
    if (tiebreaker.bulk_round_id) {
      await broadcastWebSocket(`round:${tiebreaker.bulk_round_id}`, {
        type: 'tiebreaker_bid',
        data: {
          tiebreaker_id: tiebreakerId,
          team_id: teamId,
          team_name: userData.teamName || 'Unknown Team',
          bid_amount,
          player_name: tiebreaker.player_name,
        },
      });
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
