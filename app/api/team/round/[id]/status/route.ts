import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { cookies } from 'next/headers';
import { adminAuth } from '@/lib/firebase/admin';
import { checkAndFinalizeExpiredRound } from '@/lib/lazy-finalize-round';

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check Authorization header first (takes priority for fresh tokens)
    const authHeader = request.headers.get('Authorization');
    let token = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
    
    // Fallback to cookie if no Authorization header
    if (!token) {
      const cookieStore = await cookies();
      token = cookieStore.get('token')?.value;
    }

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
    } catch (error: any) {
      console.error('Token verification error:', error);
      
      // For status checks, return a soft error instead of 401
      // This prevents constant error popups when tokens expire
      return NextResponse.json({
        success: false,
        active: false,
        error: 'Authentication expired',
        needsRefresh: true
      });
    }

    const userId = decodedToken.uid;

    // Note: Skipping role check since Firebase auth already validates the user

    const { id: roundId } = await params;

    // Check and auto-finalize if expired (lazy finalization)
    await checkAndFinalizeExpiredRound(roundId);

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
        WHERE t.round_id = ${roundId}
        AND tt.team_id = ${userId}
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
