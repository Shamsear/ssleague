import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { cookies } from 'next/headers';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

/**
 * GET /api/team/bulk-tiebreakers/:id
 * Get tiebreaker details and current state
 * Team users only
 */
export async function GET(
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

    console.log(`📊 Team ${userId} viewing tiebreaker ${tiebreakerId}`);

    // Get tiebreaker details
    const tiebreakerData = await sql`
      SELECT 
        bt.id,
        bt.round_id,
        bt.player_name,
        bt.player_team,
        bt.player_position,
        bt.status,
        bt.tie_amount,
        bt.tied_team_count,
        bt.current_highest_bid,
        bt.current_highest_team_id,
        bt.start_time,
        bt.last_activity_time,
        bt.max_end_time,
        bt.created_at,
        ar.round_name,
        ar.season_id
      FROM bulk_tiebreakers bt
      LEFT JOIN rounds ar ON bt.round_id = ar.id
      WHERE bt.id = ${tiebreakerId}
    `;

    if (tiebreakerData.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Tiebreaker not found' },
        { status: 404 }
      );
    }

    const tiebreaker = tiebreakerData[0];

    // Check if team is participating
    const myTeamData = await sql`
      SELECT 
        status,
        current_bid,
        joined_at,
        withdrawn_at
      FROM bulk_tiebreaker_teams
      WHERE tiebreaker_id = ${tiebreakerId}
      AND team_id = ${userId}
    `;

    if (myTeamData.length === 0) {
      return NextResponse.json(
        { success: false, error: 'You are not participating in this tiebreaker' },
        { status: 403 }
      );
    }

    const myTeam = myTeamData[0];

    // Get all participating teams (for context)
    const participatingTeams = await sql`
      SELECT 
        team_id,
        team_name,
        status,
        current_bid,
        joined_at,
        withdrawn_at
      FROM bulk_tiebreaker_teams
      WHERE tiebreaker_id = ${tiebreakerId}
      ORDER BY current_bid DESC NULLS LAST, joined_at ASC
    `;

    // Get bid history (last 10 bids)
    const bidHistory = await sql`
      SELECT 
        id,
        team_id,
        team_name,
        bid_amount,
        bid_time
      FROM bulk_tiebreaker_bids
      WHERE tiebreaker_id = ${tiebreakerId}
      ORDER BY bid_time DESC
      LIMIT 10
    `;

    // Calculate statistics
    const activeTeamsCount = participatingTeams.filter(t => t.status === 'active').length;
    const withdrawnTeamsCount = participatingTeams.filter(t => t.status === 'withdrawn').length;

    // Determine if user can bid or withdraw
    const canBid = tiebreaker.status === 'active' && myTeam.status === 'active';
    const canWithdraw = tiebreaker.status === 'active' 
      && myTeam.status === 'active' 
      && tiebreaker.current_highest_team_id !== userId;

    const youAreHighest = tiebreaker.current_highest_team_id === userId;

    // Time remaining calculation
    let timeRemaining = null;
    if (tiebreaker.max_end_time) {
      const now = new Date();
      const maxEnd = new Date(tiebreaker.max_end_time);
      const diffMs = maxEnd.getTime() - now.getTime();
      if (diffMs > 0) {
        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        timeRemaining = `${hours}h ${minutes}m`;
      } else {
        timeRemaining = 'EXPIRED';
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        tiebreaker: {
          id: tiebreaker.id,
          player_name: tiebreaker.player_name,
          player_team: tiebreaker.player_team,
          player_position: tiebreaker.player_position,
          status: tiebreaker.status,
          round_name: tiebreaker.round_name,
          season_id: tiebreaker.season_id,
          tie_amount: tiebreaker.tie_amount,
          tied_team_count: tiebreaker.tied_team_count,
          current_highest_bid: tiebreaker.current_highest_bid,
          current_highest_team_id: tiebreaker.current_highest_team_id,
          start_time: tiebreaker.start_time,
          last_activity_time: tiebreaker.last_activity_time,
          max_end_time: tiebreaker.max_end_time,
          time_remaining: timeRemaining,
        },
        my_status: {
          status: myTeam.status,
          current_bid: myTeam.current_bid,
          you_are_highest: youAreHighest,
          can_bid: canBid,
          can_withdraw: canWithdraw,
          joined_at: myTeam.joined_at,
          withdrawn_at: myTeam.withdrawn_at,
        },
        statistics: {
          active_teams: activeTeamsCount,
          withdrawn_teams: withdrawnTeamsCount,
          total_bids: bidHistory.length,
        },
        participating_teams: participatingTeams.map(team => ({
          team_id: team.team_id,
          team_name: team.team_name,
          status: team.status,
          current_bid: team.current_bid,
          is_you: team.team_id === userId,
        })),
        recent_bids: bidHistory.map(bid => ({
          team_id: bid.team_id,
          team_name: bid.team_name,
          bid_amount: bid.bid_amount,
          bid_time: bid.bid_time,
          is_you: bid.team_id === userId,
        })),
      },
    });

  } catch (error: any) {
    console.error('❌ Error fetching tiebreaker details:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
