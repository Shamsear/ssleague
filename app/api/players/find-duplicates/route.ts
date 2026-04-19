import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

/**
 * GET /api/players/find-duplicates
 * Find duplicate players based on name, position, and nationality
 */
export async function GET(request: NextRequest) {
  try {
    // Find players with same name, position, and nationality
    const duplicates = await sql`
      SELECT 
        name,
        position,
        nationality,
        COUNT(*) as duplicate_count,
        ARRAY_AGG(
          json_build_object(
            'id', id,
            'player_id', player_id,
            'name', name,
            'position', position,
            'nationality', nationality,
            'overall_rating', overall_rating,
            'team_id', team_id,
            'team_name', team_name,
            'is_sold', is_sold,
            'acquisition_value', acquisition_value,
            'season_id', season_id,
            'club', club,
            'age', age,
            'playing_style', playing_style
          ) ORDER BY overall_rating DESC, created_at ASC
        ) as players
      FROM footballplayers
      WHERE name IS NOT NULL
      GROUP BY name, position, nationality
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC, name ASC
    `;

    return NextResponse.json({
      success: true,
      data: duplicates,
      count: duplicates.length
    });
  } catch (error: any) {
    console.error('Error finding duplicates:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
