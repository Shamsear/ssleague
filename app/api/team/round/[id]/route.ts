import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { cookies } from 'next/headers';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

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

    // Note: Skipping role check since Firebase auth already validates the user
    // All authenticated users with valid tokens are allowed to access team routes

    const { id: roundId } = await params;

    // Get round details (seasons table doesn't exist in Neon, only rounds)
    const roundResult = await sql`
      SELECT *
      FROM rounds
      WHERE id = ${roundId}
    `;

    if (roundResult.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Round not found' },
        { status: 404 }
      );
    }

    const round = roundResult[0];

    // Check if round is active
    if (round.status !== 'active') {
      // Check if there's another active round
      const activeRoundResult = await sql`
        SELECT id FROM rounds 
        WHERE season_id = ${round.season_id} 
        AND status = 'active'
        LIMIT 1
      `;

      if (activeRoundResult.length > 0) {
        return NextResponse.json({
          success: false,
          redirect: `/dashboard/team/round/${activeRoundResult[0].id}`,
          error: 'This round is no longer active',
        });
      }

      return NextResponse.json({
        success: false,
        redirect: '/dashboard/team',
        error: 'No active rounds available',
      });
    }

    // Check if round has ended
    const now = new Date();
    const endTime = new Date(round.end_time);
    if (now > endTime) {
      return NextResponse.json({
        success: false,
        redirect: '/dashboard/team',
        error: 'This round has ended',
      });
    }

    // Get team data from Firestore
    const teamId = userId;
    
    // Get team's season data to access budget
    const teamSeasonId = `${teamId}_${round.season_id}`;
    const teamSeasonDoc = await adminDb.collection('team_seasons').doc(teamSeasonId).get();
    
    if (!teamSeasonDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'Team not registered for this season' },
        { status: 404 }
      );
    }
    
    const teamSeasonData = teamSeasonDoc.data();
    const teamBalance = teamSeasonData?.budget || 0;

    // Get available players for this position
    const playersResult = await sql`
      SELECT 
        p.id,
        p.player_id,
        p.name,
        p.position,
        p.team_name,
        p.nationality,
        p.age,
        p.club,
        p.playing_style,
        p.overall_rating,
        p.offensive_awareness,
        p.ball_control,
        p.dribbling,
        p.tight_possession,
        p.low_pass,
        p.lofted_pass,
        p.finishing,
        p.heading,
        p.set_piece_taking,
        p.curl,
        p.speed,
        p.acceleration,
        p.kicking_power,
        p.jumping,
        p.physical_contact,
        p.balance,
        p.stamina,
        p.defensive_awareness,
        p.tackling,
        p.aggression,
        p.defensive_engagement,
        p.gk_awareness,
        p.gk_catching,
        p.gk_parrying,
        p.gk_reflexes,
        p.gk_reach,
        CASE WHEN sp.player_id IS NOT NULL THEN true ELSE false END as is_starred_by_user
      FROM footballplayers p
      LEFT JOIN starred_players sp ON p.id = sp.player_id AND sp.team_id = ${teamId}
      WHERE p.position = ${round.position}
      AND p.is_auction_eligible = true
      AND (p.is_sold = false OR p.is_sold IS NULL)
      AND (p.team_id IS NULL OR p.team_id = '')
      ORDER BY is_starred_by_user DESC, p.overall_rating DESC
    `;

    // Get user's bids for this round
    const bidsResult = await sql`
      SELECT 
        b.id,
        b.player_id,
        b.amount,
        b.round_id,
        b.created_at,
        p.id as "player.id",
        p.name as "player.name",
        p.position as "player.position",
        p.team_name as "player.team_name",
        p.overall_rating as "player.overall_rating",
        p.playing_style as "player.playing_style",
        CASE WHEN sp.player_id IS NOT NULL THEN true ELSE false END as "player.is_starred"
      FROM bids b
      JOIN footballplayers p ON b.player_id = p.id
      LEFT JOIN starred_players sp ON p.id = sp.player_id AND sp.team_id = ${teamId}
      WHERE b.team_id = ${teamId}
      AND b.round_id = ${roundId}
      AND b.status = 'active'
      ORDER BY b.created_at DESC
    `;

    // Transform bids to nest player object
    const myBids = bidsResult.map((bid) => ({
      id: bid.id,
      player_id: bid.player_id,
      amount: bid.amount,
      round_id: bid.round_id,
      created_at: bid.created_at,
      player: {
        id: bid['player.id'],
        name: bid['player.name'],
        position: bid['player.position'],
        team_name: bid['player.team_name'],
        overall_rating: bid['player.overall_rating'],
        playing_style: bid['player.playing_style'],
        is_starred: bid['player.is_starred'],
      },
    }));

    // Get auction progress (completed rounds and total rounds)
    const roundsProgressResult = await sql`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'completed') as completed_rounds,
        COUNT(*) as total_rounds
      FROM rounds
      WHERE season_id = ${round.season_id}
    `;

    const completedRounds = parseInt(roundsProgressResult[0]?.completed_rounds || '0');
    const totalRounds = parseInt(roundsProgressResult[0]?.total_rounds || '0');

    return NextResponse.json({
      success: true,
      round: {
        id: round.id,
        position: round.position,
        max_bids_per_team: round.max_bids_per_team,
        end_time: round.end_time,
        status: round.status,
        season_id: round.season_id,
      },
      players: playersResult,
      myBids,
      teamBalance,
      completedRounds,
      totalRounds,
    });
  } catch (error) {
    console.error('Error fetching round data:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
