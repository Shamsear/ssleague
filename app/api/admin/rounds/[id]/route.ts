import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { verifyAuth } from '@/lib/auth-helper';

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

/**
 * GET /api/admin/rounds/[id]
 * Get a single round by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify authentication and authorization
    const auth = await verifyAuth(['admin', 'committee_admin']);
    if (!auth.authenticated) {
      return NextResponse.json(
        { success: false, error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id: roundId } = await params;

    if (!roundId) {
      return NextResponse.json(
        { success: false, error: 'Round ID is required' },
        { status: 400 }
      );
    }

    // Fetch the round with additional stats
    const rounds = await sql`
      SELECT 
        r.*,
        COUNT(DISTINCT b.id) as total_bids,
        COUNT(DISTINCT b.team_id) as teams_bid,
        CASE 
          WHEN r.round_type = 'bulk' THEN (SELECT COUNT(*) FROM round_players WHERE round_id = r.id)
          ELSE 0
        END as player_count,
        EXISTS(
          SELECT 1 FROM pending_allocations WHERE round_id = r.id LIMIT 1
        ) as has_pending_allocations
      FROM rounds r
      LEFT JOIN bids b ON r.id = b.round_id
      WHERE r.id = ${roundId}
      GROUP BY r.id
    `;

    if (rounds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Round not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: rounds[0],
    });
  } catch (error: any) {
    console.error('Error fetching round:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
