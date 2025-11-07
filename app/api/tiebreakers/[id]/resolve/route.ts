import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { verifyAuth } from '@/lib/auth-helper';
import { resolveTiebreaker } from '@/lib/tiebreaker';

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

/**
 * POST /api/tiebreakers/[id]/resolve
 * Manually resolve a tiebreaker (committee admin only)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ✅ ZERO FIREBASE READS - Uses JWT claims only
    const auth = await verifyAuth(['admin', 'committee_admin'], request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: tiebreakerId } = await params;
    const body = await request.json();
    const { resolutionType } = body; // 'auto' or 'exclude'

    if (!resolutionType || !['auto', 'exclude'].includes(resolutionType)) {
      return NextResponse.json(
        { success: false, error: 'Valid resolution type required: auto or exclude' },
        { status: 400 }
      );
    }

    // Fetch tiebreaker details
    const tiebreakerResult = await sql`
      SELECT * FROM tiebreakers WHERE id = ${tiebreakerId}
    `;

    if (tiebreakerResult.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Tiebreaker not found' },
        { status: 404 }
      );
    }

    const tiebreaker = tiebreakerResult[0];

    if (tiebreaker.status !== 'active') {
      return NextResponse.json(
        { success: false, error: 'Tiebreaker is not active' },
        { status: 400 }
      );
    }

    // Resolve the tiebreaker
    const result = await resolveTiebreaker(tiebreakerId, resolutionType);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    console.log(`✅ Tiebreaker ${tiebreakerId} resolved by admin: ${resolutionType}`);

    return NextResponse.json({
      success: true,
      message: 'Tiebreaker resolved successfully',
      data: result.data,
    });
  } catch (error: any) {
    console.error('Error resolving tiebreaker:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
