import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

export async function GET(request: NextRequest) {
  try {
    const sql = getTournamentDb();
    const searchParams = request.nextUrl.searchParams;
    const teamId = searchParams.get('team_id');
    const seasonId = searchParams.get('season_id');

    if (!teamId) {
      return NextResponse.json(
        { error: 'team_id is required' },
        { status: 400 }
      );
    }

    console.log('🔍 Querying fixtures with:', { teamId, seasonId });

    // Fetch fixtures where the team is either home or away
    let fixtures;
    
    if (seasonId) {
      fixtures = await sql`
        SELECT f.*
        FROM fixtures f
        WHERE f.season_id = ${seasonId}
          AND (f.home_team_id = ${teamId} OR f.away_team_id = ${teamId})
        ORDER BY f.round_number DESC, f.match_number ASC
      `;
    } else {
      fixtures = await sql`
        SELECT f.*
        FROM fixtures f
        WHERE f.home_team_id = ${teamId} OR f.away_team_id = ${teamId}
        ORDER BY f.round_number DESC, f.match_number ASC
      `;
    }

    console.log('📊 Found', fixtures.length, 'fixtures in Neon');
    if (fixtures.length > 0) {
      console.log('Sample fixture:', fixtures[0]);
    }

    return NextResponse.json({ fixtures });
  } catch (error: any) {
    console.error('Error fetching team fixtures:', error);
    console.error('Error details:', error.message, error.stack);
    return NextResponse.json(
      { error: 'Failed to fetch fixtures', details: error.message },
      { status: 500 }
    );
  }
}
