import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/neon';

/**
 * Get lineup submission history for a season
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const seasonId = searchParams.get('season_id');

    if (!seasonId) {
      return NextResponse.json(
        { success: false, error: 'season_id is required' },
        { status: 400 }
      );
    }

    const history = await sql`
      SELECT 
        l.id as lineup_id,
        l.fixture_id,
        l.team_id,
        t.name as team_name,
        l.round_number,
        f.match_number,
        l.starting_xi,
        l.substitutes,
        l.submitted_by_name,
        l.submitted_at,
        l.is_locked,
        l.locked_at,
        l.selected_by_opponent
      FROM lineups l
      LEFT JOIN teams t ON l.team_id = t.id
      LEFT JOIN fixtures f ON l.fixture_id = f.id
      WHERE l.season_id = ${seasonId}
      ORDER BY l.submitted_at DESC
    `;

    return NextResponse.json({
      success: true,
      history
    });
  } catch (error: any) {
    console.error('Error fetching lineup history:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch lineup history' },
      { status: 500 }
    );
  }
}
