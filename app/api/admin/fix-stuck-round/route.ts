import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { verifyAuth } from '@/lib/auth-helper';
import { applyFinalizationResults } from '@/lib/finalize-round';

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

/**
 * POST /api/admin/fix-stuck-round
 * Fix rounds stuck in "finalizing" status with no active tiebreakers
 */
export async function POST(request: NextRequest) {
  try {
    // ✅ ZERO FIREBASE READS - Uses JWT claims only
    const auth = await verifyAuth(['admin', 'committee_admin'], request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: 401 }
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
