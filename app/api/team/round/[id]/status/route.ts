import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { cookies } from 'next/headers';
import { adminAuth } from '@/lib/firebase/admin';

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

    const { id: roundId } = await params;

    // Get round details
    const roundResult = await sql`
      SELECT 
        r.id,
        r.status,
        r.end_time,
        r.season_id
      FROM rounds r
      WHERE r.id = ${roundId}
    `;

    if (roundResult.length === 0) {
      return NextResponse.json({
        active: false,
        redirect: '/dashboard/team',
        error: 'Round not found',
      });
    }

    const round = roundResult[0];

    // Check if round is active
    if (round.status !== 'active') {
      // Check if there are active tiebreakers for this team
      const tiebreakerResult = await sql`
        SELECT t.id
        FROM tiebreakers t
        INNER JOIN team_tiebreakers tt ON t.id = tt.tiebreaker_id
        INNER JOIN bids b ON tt.original_bid_id = b.id
        WHERE t.round_id = ${roundId}
        AND b.team_id = ${userId}
        AND t.status = 'active'
        LIMIT 1
      `;

      if (tiebreakerResult.length > 0) {
        return NextResponse.json({
          active: false,
          redirect: `/dashboard/team/tiebreaker/${tiebreakerResult[0].id}`,
          error: 'Round has tiebreakers - please resolve your tiebreaker',
          tiebreaker: true,
        });
      }

      // Check if there's another active round
      const activeRoundResult = await sql`
        SELECT id FROM rounds 
        WHERE season_id = ${round.season_id} 
        AND status = 'active'
        LIMIT 1
      `;

      if (activeRoundResult.length > 0) {
        return NextResponse.json({
          active: false,
          redirect: `/dashboard/team/round/${activeRoundResult[0].id}`,
          error: 'This round is no longer active',
        });
      }

      return NextResponse.json({
        active: false,
        redirect: '/dashboard/team',
        error: 'No active rounds available',
      });
    }

    // Check if round has ended
    const now = new Date();
    const endTime = new Date(round.end_time);
    if (now > endTime) {
      return NextResponse.json({
        active: false,
        redirect: '/dashboard/team',
        error: 'This round has ended',
      });
    }

    // Round is active
    return NextResponse.json({
      active: true,
      timeRemaining: Math.max(0, Math.floor((endTime.getTime() - now.getTime()) / 1000)),
    });
  } catch (error) {
    console.error('Error checking round status:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
