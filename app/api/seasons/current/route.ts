import { NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

/**
 * GET /api/seasons/current
 * Returns the currently active season
 */
export async function GET() {
  try {
    const sql = getTournamentDb();

    // Get the most recent active season
    const result = await sql`
      SELECT DISTINCT 
        season_id,
        MAX(created_at) as created_at,
        MAX(status) as status
      FROM tournaments
      WHERE status = 'active'
      GROUP BY season_id
      ORDER BY season_id DESC
      LIMIT 1
    `;

    if (result.length === 0) {
      // If no active season, get the most recent season
      const latestResult = await sql`
        SELECT DISTINCT 
          season_id,
          MAX(created_at) as created_at,
          MAX(status) as status
        FROM tournaments
        GROUP BY season_id
        ORDER BY season_id DESC
        LIMIT 1
      `;

      if (latestResult.length === 0) {
        return NextResponse.json(
          { error: 'No seasons found' },
          { status: 404 }
        );
      }

      const season = latestResult[0];
      return NextResponse.json({
        season: {
          id: season.season_id,
          season_id: season.season_id,
          name: season.season_id.replace('SSPSLS', 'Season '),
          status: season.status || 'completed',
          created_at: season.created_at,
        }
      });
    }

    const season = result[0];
    return NextResponse.json({
      season: {
        id: season.season_id,
        season_id: season.season_id,
        name: season.season_id.replace('SSPSLS', 'Season '),
        status: season.status,
        created_at: season.created_at,
      }
    });
  } catch (error) {
    console.error('Error fetching current season:', error);
    return NextResponse.json(
      { error: 'Failed to fetch current season' },
      { status: 500 }
    );
  }
}
