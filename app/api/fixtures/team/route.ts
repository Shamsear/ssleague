import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.NEON_DATABASE_URL!);

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const teamId = searchParams.get('team_id');
    const seasonId = searchParams.get('season_id');

    if (!teamId || !seasonId) {
      return NextResponse.json(
        { error: 'team_id and season_id are required' },
        { status: 400 }
      );
    }

    console.log('🔍 Querying fixtures with:', { teamId, seasonId });

    // Fetch fixtures where the team is either home or away
    const fixtures = await sql`
      SELECT 
        f.*,
        -- Calculate aggregate scores from matchups
        (
          SELECT COALESCE(SUM(m.home_goals), 0)
          FROM matchups m
          WHERE m.fixture_id = f.id
        ) as home_score,
        (
          SELECT COALESCE(SUM(m.away_goals), 0)
          FROM matchups m
          WHERE m.fixture_id = f.id
        ) as away_score
      FROM fixtures f
      WHERE f.season_id = ${seasonId}
        AND (f.home_team_id = ${teamId} OR f.away_team_id = ${teamId})
      ORDER BY f.round_number DESC, f.match_number ASC
    `;

    console.log('📊 Found', fixtures.length, 'fixtures in Neon');
    if (fixtures.length > 0) {
      console.log('Sample fixture:', fixtures[0]);
    }

    return NextResponse.json({ fixtures });
  } catch (error) {
    console.error('Error fetching team fixtures:', error);
    return NextResponse.json(
      { error: 'Failed to fetch fixtures' },
      { status: 500 }
    );
  }
}
