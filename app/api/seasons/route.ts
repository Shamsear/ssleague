import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

// GET - List all seasons (derived from tournaments)
export async function GET(request: NextRequest) {
  try {
    const sql = getTournamentDb();
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');

    // Get unique seasons from tournaments table
    let seasons;
    
    if (status) {
      seasons = await sql`
        SELECT DISTINCT 
          season_id,
          MAX(created_at) as created_at,
          MAX(status) as status
        FROM tournaments
        WHERE status = ${status}
        GROUP BY season_id
        ORDER BY season_id DESC
      `;
    } else {
      seasons = await sql`
        SELECT DISTINCT 
          season_id,
          MAX(created_at) as created_at,
          MAX(status) as status
        FROM tournaments
        GROUP BY season_id
        ORDER BY season_id DESC
      `;
    }

    // Format seasons to match expected structure
    const formattedSeasons = seasons.map((season: any) => ({
      id: season.season_id,
      season_id: season.season_id,
      name: season.season_id.replace('SSPSLS', 'Season '),
      status: season.status || 'active',
      created_at: season.created_at,
    }));

    return NextResponse.json(formattedSeasons);
  } catch (error) {
    console.error('Error fetching seasons:', error);
    return NextResponse.json(
      { error: 'Failed to fetch seasons' },
      { status: 500 }
    );
  }
}
