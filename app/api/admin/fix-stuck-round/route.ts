import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { getAuthToken } from '@/lib/auth/token-helper';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { applyFinalizationResults } from '@/lib/finalize-round';

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

/**
 * POST /api/admin/fix-stuck-round
 * Fix rounds stuck in "finalizing" status with no active tiebreakers
 */
export async function POST(request: NextRequest) {
  try {
    const token = await getAuthToken(request);

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

    // Check if user is committee admin
    const userDoc = await adminDb.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const userData = userDoc.data();
    if (userData?.role !== 'admin' && userData?.role !== 'committee_admin') {
      return NextResponse.json(
        { success: false, error: 'Access denied. Committee admin only.' },
        { status: 403 }
      );
    }

    const { roundId } = await request.json();

    if (!roundId) {
      return NextResponse.json(
        { success: false, error: 'Round ID is required' },
        { status: 400 }
      );
    }

    console.log(`🔧 Fixing stuck round: ${roundId}`);

    // Check if round is in finalizing status
    const roundResult = await sql`
      SELECT * FROM rounds WHERE id = ${roundId}
    `;

    if (roundResult.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Round not found' },
        { status: 404 }
      );
    }

    const round = roundResult[0];

    if (round.status !== 'finalizing') {
      return NextResponse.json(
        { success: false, error: `Round is not in finalizing status (current: ${round.status})` },
        { status: 400 }
      );
    }

    // Check for active tiebreakers
    const activeTiebreakers = await sql`
      SELECT COUNT(*) as count
      FROM tiebreakers
      WHERE round_id = ${roundId}
      AND status = 'active'
    `;

    const tiebreakerCount = parseInt(activeTiebreakers[0].count);

    if (tiebreakerCount > 0) {
      return NextResponse.json(
        { success: false, error: `Round still has ${tiebreakerCount} active tiebreaker(s)` },
        { status: 400 }
      );
    }

    console.log(`✅ No active tiebreakers found - updating round to completed`);

    // Update round status to completed
    await sql`
      UPDATE rounds
      SET status = 'completed',
          updated_at = NOW()
      WHERE id = ${roundId}
    `;

    return NextResponse.json({
      success: true,
      message: 'Round status updated to completed',
      data: {
        roundId,
        previousStatus: 'finalizing',
        newStatus: 'completed',
      },
    });
  } catch (error: any) {
    console.error('Error fixing stuck round:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
