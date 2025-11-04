import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { cookies } from 'next/headers';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { finalizeBulkTiebreaker } from '@/lib/finalize-bulk-tiebreaker';
import { broadcastWebSocket, BroadcastType } from '@/lib/websocket/broadcast';

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

/**
 * POST /api/team/bulk-tiebreakers/:id/withdraw
 * Withdraw from tiebreaker auction (Last Person Standing)
 * Team users only
 * RULE: Cannot withdraw if you are the current highest bidder
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

    console.log(`🚪 Team ${teamId} (firebase: ${firebaseUid}) attempting to withdraw from tiebreaker ${tiebreakerId}`);

    // Get tiebreaker details
    const tiebreakerCheck = await sql`
      SELECT 
        id, 
        player_name, 
        status, 
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

    // VALIDATION 1: Tiebreaker must be active
    if (tiebreaker.status !== 'active') {
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

    // VALIDATION 4: Team must not be already withdrawn
    if (teamData.status === 'withdrawn') {
      return NextResponse.json(
        { success: false, error: 'You have already withdrawn from this tiebreaker' },
        { status: 400 }
      );
    }

    // VALIDATION 5: CRITICAL - Cannot withdraw if you are the highest bidder
    if (tiebreaker.current_highest_team_id === teamId) {
      return NextResponse.json(
        { 
          success: false, 
          error: `You cannot withdraw! You are the current highest bidder at £${tiebreaker.current_highest_bid}. Another team must outbid you first.` 
        },
        { status: 400 }
      );
    }

    // ALL VALIDATIONS PASSED - Withdraw
    console.log('✅ All validations passed. Withdrawing...');

    const withdrawTime = new Date();

    // Update team status to withdrawn
    await sql`
      UPDATE bulk_tiebreaker_teams
      SET 
        status = 'withdrawn',
        withdrawn_at = ${withdrawTime.toISOString()}
      WHERE tiebreaker_id = ${tiebreakerId}
      AND team_id = ${teamId}
    `;

    // Update last activity time
    await sql`
      UPDATE bulk_tiebreakers
      SET 
        last_activity_time = ${withdrawTime.toISOString()},
        updated_at = NOW()
      WHERE id = ${tiebreakerId}
    `;

    console.log(`✅ Team ${teamId} withdrew from tiebreaker ${tiebreakerId}`);

    // Check if only one team is left (winner condition)
    const winnerCheck = await sql`
      SELECT * FROM check_tiebreaker_winner(${tiebreakerId})
    `;

    const teamsLeft = winnerCheck[0]?.teams_left || 0;
    const winnerId = winnerCheck[0]?.winner_team_id;
    const winnerBid = winnerCheck[0]?.winner_bid;
    const isWinnerDetermined = teamsLeft === 1;

    // Get team names for broadcast
    const withdrawnTeamName = teamData.status === 'active' ? (await sql`
      SELECT team_name FROM bulk_tiebreaker_teams
      WHERE tiebreaker_id = ${tiebreakerId} AND team_id = ${teamId}
    `)[0]?.team_name : 'Unknown';

    // Broadcast withdrawal to all watching clients
    await broadcastWebSocket(`tiebreaker:${tiebreakerId}`, {
      type: BroadcastType.TIEBREAKER_WITHDRAW,
      data: {
        tiebreaker_id: tiebreakerId,
        team_id: teamId,
        team_name: withdrawnTeamName,
        teams_remaining: teamsLeft,
        is_winner_determined: isWinnerDetermined,
      },
    });

    if (isWinnerDetermined) {
      console.log(`🏆 AUTO-FINALIZE: Only 1 team left! Team ${winnerId} wins!`);
      
      // Auto-finalize immediately
      console.log(`🔄 Calling finalizeBulkTiebreaker for tiebreaker ${tiebreakerId}...`);
      const finalizeResult = await finalizeBulkTiebreaker(tiebreakerId);
      
      if (!finalizeResult.success) {
        console.error(`⚠️ Failed to auto-finalize tiebreaker ${tiebreakerId}`);
        console.error(`⚠️ Error details: ${finalizeResult.error}`);
        console.error(`⚠️ Full result:`, JSON.stringify(finalizeResult, null, 2));
        // Still mark as pending for manual finalization
        await sql`
          UPDATE bulk_tiebreakers
          SET status = 'auto_finalize_pending'
          WHERE id = ${tiebreakerId}
        `;
        console.log(`⚠️ Status set to 'auto_finalize_pending' - admin must manually finalize`);
      } else {
        console.log(`✅ Tiebreaker auto-finalized successfully`);
        
        // Get winner team name
        const winnerTeamResult = await sql`
          SELECT team_name FROM bulk_tiebreaker_teams
          WHERE tiebreaker_id = ${tiebreakerId} AND team_id = ${winnerId}
        `;
        const winnerTeamName = winnerTeamResult[0]?.team_name || 'Unknown';
        
        // Broadcast tiebreaker completion to all clients
        await broadcastWebSocket(`tiebreaker:${tiebreakerId}`, {
          type: BroadcastType.TIEBREAKER_FINALIZED,
          data: {
            tiebreaker_id: tiebreakerId,
            player_name: tiebreaker.player_name,
            position: tiebreaker.position,
            winner_team_id: winnerId,
            winner_team_name: winnerTeamName,
            final_bid: winnerBid,
            status: 'resolved',
          },
        });
      }
    }

    // Get winner details if determined
    let winnerDetails = null;
    if (isWinnerDetermined && winnerId) {
      const winnerTeamResult = await sql`
        SELECT team_name FROM bulk_tiebreaker_teams
        WHERE tiebreaker_id = ${tiebreakerId} AND team_id = ${winnerId}
      `;
      winnerDetails = {
        winner_team_id: winnerId,
        winner_team_name: winnerTeamResult[0]?.team_name || 'Unknown',
        final_bid: winnerBid,
      };
    }

    return NextResponse.json({
      success: true,
      data: {
        tiebreaker_id: tiebreakerId,
        player_name: tiebreaker.player_name,
        position: tiebreaker.position,
        withdrawn: true,
        teams_remaining: teamsLeft,
        is_winner_determined: isWinnerDetermined,
        winner: winnerDetails,
        message: isWinnerDetermined
          ? `You have withdrawn. The tiebreaker is now over. Team ${winnerDetails?.winner_team_name} wins ${tiebreaker.player_name}!`
          : `You have successfully withdrawn from the tiebreaker for ${tiebreaker.player_name}. ${teamsLeft} team(s) remaining.`,
      },
    });

  } catch (error: any) {
    console.error('❌ Error withdrawing from tiebreaker:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
