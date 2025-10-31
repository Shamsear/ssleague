import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { cookies } from 'next/headers';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { finalizeBulkTiebreaker } from '@/lib/finalize-bulk-tiebreaker';

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

    const userId = decodedToken.uid;

    // Check if user is a team
    const userDoc = await adminDb.collection('users').doc(userId).get();
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

    console.log(`🚪 Team ${userId} attempting to withdraw from tiebreaker ${tiebreakerId}`);

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
      AND team_id = ${userId}
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
    if (tiebreaker.current_highest_team_id === userId) {
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
      AND team_id = ${userId}
    `;

    // Update last activity time
    await sql`
      UPDATE bulk_tiebreakers
      SET 
        last_activity_time = ${withdrawTime.toISOString()},
        updated_at = NOW()
      WHERE id = ${tiebreakerId}
    `;

    console.log(`✅ Team ${userId} withdrew from tiebreaker ${tiebreakerId}`);

    // Check if only one team is left (winner condition)
    const winnerCheck = await sql`
      SELECT * FROM check_tiebreaker_winner(${tiebreakerId})
    `;

    const teamsLeft = winnerCheck[0]?.teams_left || 0;
    const winnerId = winnerCheck[0]?.winner_team_id;
    const isWinnerDetermined = teamsLeft === 1;

    // TODO: Broadcast via WebSocket
    // - Notify all teams of withdrawal
    // - Update UI in real-time

    if (isWinnerDetermined) {
      console.log(`🏆 AUTO-FINALIZE: Only 1 team left! Team ${winnerId} wins!`);
      
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
        withdrawn: true,
        teams_remaining: teamsLeft,
        is_winner_determined: isWinnerDetermined,
        message: isWinnerDetermined
          ? `You have withdrawn. The tiebreaker is now over. Team ${winnerId} wins ${tiebreaker.player_name}!`
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
