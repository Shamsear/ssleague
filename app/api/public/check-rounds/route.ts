import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { checkAndFinalizeExpiredRound } from '@/lib/lazy-finalize-round';

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

/**
 * GET /api/public/check-rounds
 * Public endpoint to check and finalize expired rounds
 * Called from home page to ensure rounds finalize even when no users are logged in
 */
export async function GET() {
  try {
    // Get all active rounds
    const activeRounds = await sql`
      SELECT id, position, end_time, status
      FROM rounds
      WHERE status = 'active'
    `;

    if (activeRounds.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active rounds to check',
        checked: 0,
        finalized: 0
      });
    }

    // Check and finalize each expired round
    const results = await Promise.all(
      activeRounds.map(round => checkAndFinalizeExpiredRound(round.id))
    );

    const finalizedCount = results.filter(r => r.finalized).length;

    return NextResponse.json({
      success: true,
      checked: activeRounds.length,
      finalized: finalizedCount,
      rounds: activeRounds.map((round, index) => ({
        id: round.id,
        position: round.position,
        wasFinalized: results[index].finalized
      }))
    });
  } catch (error) {
    console.error('Error checking rounds:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
