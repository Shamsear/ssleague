import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { cookies } from 'next/headers';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

/**
 * GET /api/team/tiebreakers
 * Fetch tiebreakers for the authenticated team
 */
export async function GET(request: NextRequest) {
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

    // Get user data and team ID
    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = userDoc.data();
    const teamId = userData?.teamId;

    if (!teamId) {
      return NextResponse.json(
        { success: false, error: 'User not associated with a team' },
        { status: 403 }
      );
    }

    // Get query params for filtering
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'active';

    // Fetch tiebreakers involving this team
    const tiebreakersResult = await sql`
      SELECT 
        t.*,
        p.name as player_name,
        p.position,
        p.overall_rating,
        p.team_name as player_team,
        r.position as round_position,
        r.season_id,
        tt.new_bid_amount as team_new_bid,
        tt.submitted as team_submitted,
        tt.submitted_at as team_submitted_at
      FROM tiebreakers t
      INNER JOIN footballplayers p ON t.player_id = p.id
      INNER JOIN rounds r ON t.round_id = r.id
      INNER JOIN team_tiebreakers tt ON t.id = tt.tiebreaker_id
      INNER JOIN bids b ON tt.original_bid_id = b.id
      WHERE b.team_id = ${teamId}
      AND t.status = ${status}
      ORDER BY t.created_at DESC
    `;

    // Process tiebreakers with time calculations
    const tiebreakers = tiebreakersResult.map(tiebreaker => {
      const createdAt = new Date(tiebreaker.created_at);
      const expiresAt = new Date(createdAt.getTime() + tiebreaker.duration_minutes * 60 * 1000);
      const timeRemaining = Math.max(0, expiresAt.getTime() - Date.now());
      const isExpired = timeRemaining === 0;

      return {
        id: tiebreaker.id,
        round_id: tiebreaker.round_id,
        round_position: tiebreaker.round_position,
        season_id: tiebreaker.season_id,
        player: {
          id: tiebreaker.player_id,
          name: tiebreaker.player_name,
          position: tiebreaker.position,
          overall_rating: tiebreaker.overall_rating,
          team_name: tiebreaker.player_team,
        },
        original_amount: tiebreaker.original_amount,
        status: tiebreaker.status,
        winning_team_id: tiebreaker.winning_team_id,
        winning_amount: tiebreaker.winning_amount,
        duration_minutes: tiebreaker.duration_minutes,
        created_at: tiebreaker.created_at,
        resolved_at: tiebreaker.resolved_at,
        new_amount: tiebreaker.team_new_bid,
        submitted: tiebreaker.team_submitted,
        submitted_at: tiebreaker.team_submitted_at,
        expiresAt: expiresAt.toISOString(),
        timeRemaining,
        isExpired,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        tiebreakers,
        total: tiebreakers.length,
      },
    });
  } catch (error: any) {
    console.error('Error fetching team tiebreakers:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
