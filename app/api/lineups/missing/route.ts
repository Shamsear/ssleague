import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

/**
 * GET - Get fixtures with missing lineups for a round
 * Query params:
 * - round_number: required
 * - season_id: required
 */
export async function GET(request: NextRequest) {
  try {
    const sql = getTournamentDb();
    const searchParams = request.nextUrl.searchParams;
    const roundNumber = searchParams.get('round_number');
    const seasonId = searchParams.get('season_id');

    if (!roundNumber || !seasonId) {
      return NextResponse.json(
        { error: 'round_number and season_id are required' },
        { status: 400 }
      );
    }

    // Get all fixtures for the round
    const fixtures = await sql`
      SELECT 
        f.id as fixture_id,
        f.home_team_id,
        f.away_team_id,
        f.home_team_name,
        f.away_team_name,
        f.round_number,
        f.match_number,
        rd.scheduled_date,
        rd.home_fixture_deadline_time
      FROM fixtures f
      LEFT JOIN round_deadlines rd ON 
        f.round_number = rd.round_number 
        AND f.season_id = rd.season_id
      WHERE f.round_number = ${parseInt(roundNumber)}
      AND f.season_id = ${seasonId}
      ORDER BY f.match_number
    `;

    if (fixtures.length === 0) {
      return NextResponse.json({
        success: true,
        missing: [],
        message: 'No fixtures found for this round',
      });
    }

    // Get all lineups for these fixtures
    const fixtureIds = fixtures.map((f: any) => f.fixture_id);
    const lineups = await sql`
      SELECT fixture_id, team_id, is_valid, warning_given
      FROM lineups
      WHERE fixture_id = ANY(${fixtureIds})
    `;

    // Build missing lineups list
    const missing: any[] = [];

    fixtures.forEach((fixture: any) => {
      const homeLineup = lineups.find(
        (l: any) => l.fixture_id === fixture.fixture_id && l.team_id === fixture.home_team_id
      );
      const awayLineup = lineups.find(
        (l: any) => l.fixture_id === fixture.fixture_id && l.team_id === fixture.away_team_id
      );

      if (!homeLineup) {
        missing.push({
          fixture_id: fixture.fixture_id,
          match_number: fixture.match_number,
          team_id: fixture.home_team_id,
          team_name: fixture.home_team_name,
          team_type: 'home',
          opponent_id: fixture.away_team_id,
          opponent_name: fixture.away_team_name,
          warning_given: false,
        });
      } else if (!homeLineup.is_valid) {
        missing.push({
          fixture_id: fixture.fixture_id,
          match_number: fixture.match_number,
          team_id: fixture.home_team_id,
          team_name: fixture.home_team_name,
          team_type: 'home',
          opponent_id: fixture.away_team_id,
          opponent_name: fixture.away_team_name,
          warning_given: homeLineup.warning_given,
          reason: 'Invalid lineup',
        });
      }

      if (!awayLineup) {
        missing.push({
          fixture_id: fixture.fixture_id,
          match_number: fixture.match_number,
          team_id: fixture.away_team_id,
          team_name: fixture.away_team_name,
          team_type: 'away',
          opponent_id: fixture.home_team_id,
          opponent_name: fixture.home_team_name,
          warning_given: false,
        });
      } else if (!awayLineup.is_valid) {
        missing.push({
          fixture_id: fixture.fixture_id,
          match_number: fixture.match_number,
          team_id: fixture.away_team_id,
          team_name: fixture.away_team_name,
          team_type: 'away',
          opponent_id: fixture.home_team_id,
          opponent_name: fixture.home_team_name,
          warning_given: awayLineup.warning_given,
          reason: 'Invalid lineup',
        });
      }
    });

    return NextResponse.json({
      success: true,
      round_number: parseInt(roundNumber),
      season_id: seasonId,
      total_fixtures: fixtures.length,
      missing_count: missing.length,
      missing,
    });
  } catch (error: any) {
    console.error('Error fetching missing lineups:', error);
    return NextResponse.json(
      { error: 'Failed to fetch missing lineups', details: error.message },
      { status: 500 }
    );
  }
}
