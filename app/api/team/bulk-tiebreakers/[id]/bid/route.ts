import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { cookies } from 'next/headers';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

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
    const { bid_amount } = await request.json();

    // Validate input
    if (!bid_amount || typeof bid_amount !== 'number' || bid_amount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Valid bid_amount is required' },
        { status: 400 }
      );
    }

    console.log(`💰 Team ${userId} bidding £${bid_amount} on tiebreaker ${tiebreakerId}`);

    // Get tiebreaker details
    const tiebreakerCheck = await sql`
      SELECT 
        id, 
        player_name, 
        status, 
        current_highest_bid,
        current_highest_team_id,
        max_end_time,
        round_id
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
          error: `Bid must be higher than current highest bid of £${tiebreaker.current_highest_bid}` 
        },
        { status: 400 }
      );
    }

    // VALIDATION 6: Check team balance
    const roundCheck = await sql`
      SELECT season_id FROM rounds WHERE id = ${tiebreaker.round_id}
    `;
    const seasonId = roundCheck[0]?.season_id;

    const teamSeasonId = `${userId}_${seasonId}`;
    const teamSeasonDoc = await adminDb.collection('team_seasons').doc(teamSeasonId).get();
    
    let balance = 1000;
    if (teamSeasonDoc.exists) {
      balance = teamSeasonDoc.data()?.balance || 1000;
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
        ${userId},
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
      AND team_id = ${userId}
    `;

    // Update tiebreaker with new highest bid
    await sql`
      UPDATE bulk_tiebreakers
      SET 
        current_highest_bid = ${bid_amount},
        current_highest_team_id = ${userId},
        last_activity_time = ${bidTime.toISOString()},
        updated_at = NOW()
      WHERE id = ${tiebreakerId}
    `;

    console.log(`✅ Bid placed: £${bid_amount} by team ${userId}`);

    // Check if this is the last team (auto-finalize condition)
    const winnerCheck = await sql`
      SELECT * FROM check_tiebreaker_winner(${tiebreakerId})
    `;

    const teamsLeft = winnerCheck[0]?.teams_left || 0;
    const isWinner = teamsLeft === 1;

    // TODO: Broadcast via WebSocket
    // - Notify all teams of new bid
    // - Update UI in real-time

    if (isWinner) {
      console.log(`🏆 AUTO-FINALIZE: Only 1 team left! Team ${userId} wins!`);
      
      // Auto-finalize will be handled by a separate process or admin
      // For now, just flag it
      await sql`
        UPDATE bulk_tiebreakers
        SET status = 'auto_finalize_pending'
        WHERE id = ${tiebreakerId}
      `;
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
