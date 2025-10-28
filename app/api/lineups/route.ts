import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';
import { 
  validateLineup, 
  isLineupEditable, 
  generateLineupId,
  hasSubmittedLineup 
} from '@/lib/lineup-validation';

/**
 * GET - Fetch lineup(s)
 * Query params:
 * - fixture_id: required
 * - team_id: optional (if not provided, returns both teams' lineups)
 */
export async function GET(request: NextRequest) {
  try {
    const sql = getTournamentDb();
    const searchParams = request.nextUrl.searchParams;
    const fixtureId = searchParams.get('fixture_id');
    const teamId = searchParams.get('team_id');

    if (!fixtureId) {
      return NextResponse.json(
        { error: 'fixture_id is required' },
        { status: 400 }
      );
    }

    let lineups;

    if (teamId) {
      // Get specific team's lineup
      lineups = await sql`
        SELECT 
          l.*,
          f.home_team_name,
          f.away_team_name,
          f.round_number
        FROM lineups l
        JOIN fixtures f ON l.fixture_id = f.id
        WHERE l.fixture_id = ${fixtureId}
        AND l.team_id = ${teamId}
        LIMIT 1
      `;
    } else {
      // Get both teams' lineups
      lineups = await sql`
        SELECT 
          l.*,
          f.home_team_id,
          f.away_team_id,
          f.home_team_name,
          f.away_team_name,
          f.round_number
        FROM lineups l
        JOIN fixtures f ON l.fixture_id = f.id
        WHERE l.fixture_id = ${fixtureId}
      `;
    }

    // Get substitutions for the lineups
    if (lineups.length > 0) {
      const lineupIds = lineups.map((l: any) => l.id);
      const substitutions = await sql`
        SELECT *
        FROM lineup_substitutions
        WHERE lineup_id = ANY(${lineupIds})
        ORDER BY made_at ASC
      `;

      // Attach substitutions to each lineup
      lineups = lineups.map((l: any) => ({
        ...l,
        substitutions: substitutions.filter((s: any) => s.lineup_id === l.id),
      }));
    }

    return NextResponse.json({
      success: true,
      lineups: teamId && lineups.length > 0 ? lineups[0] : lineups,
    });
  } catch (error: any) {
    console.error('Error fetching lineups:', error);
    return NextResponse.json(
      { error: 'Failed to fetch lineups' },
      { status: 500 }
    );
  }
}

/**
 * POST - Submit or update lineup
 */
export async function POST(request: NextRequest) {
  try {
    const sql = getTournamentDb();
    const body = await request.json();
    const {
      fixture_id,
      team_id,
      starting_xi,
      substitutes,
      submitted_by,
      submitted_by_name,
    } = body;

    // Validation
    if (!fixture_id || !team_id || !starting_xi || !substitutes || !submitted_by) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if lineup can be edited
    const editableCheck = await isLineupEditable(fixture_id);
    if (!editableCheck.editable) {
      return NextResponse.json(
        { error: editableCheck.reason || 'Lineup cannot be edited' },
        { status: 403 }
      );
    }

    // Get fixture info
    const fixtures = await sql`
      SELECT season_id, round_number, tournament_id
      FROM fixtures
      WHERE id = ${fixture_id}
      LIMIT 1
    `;

    if (fixtures.length === 0) {
      return NextResponse.json(
        { error: 'Fixture not found' },
        { status: 404 }
      );
    }

    const fixture = fixtures[0];

    // Validate lineup
    const validation = await validateLineup(
      { starting_xi, substitutes },
      fixture.season_id,
      team_id
    );

    if (!validation.isValid) {
      return NextResponse.json(
        { 
          error: 'Lineup validation failed', 
          errors: validation.errors 
        },
        { status: 400 }
      );
    }

    // Generate lineup ID
    const lineupId = generateLineupId(fixture_id, team_id);

    // Check if lineup already exists
    const existingLineup = await hasSubmittedLineup(fixture_id, team_id);

    if (existingLineup) {
      // Update existing lineup
      await sql`
        UPDATE lineups SET
          starting_xi = ${JSON.stringify(starting_xi)},
          substitutes = ${JSON.stringify(substitutes)},
          classic_player_count = ${validation.classicPlayerCount},
          is_valid = ${validation.isValid},
          validation_errors = ${JSON.stringify(validation.errors)},
          updated_at = NOW()
        WHERE id = ${lineupId}
      `;

      return NextResponse.json({
        success: true,
        message: 'Lineup updated successfully',
        lineup_id: lineupId,
        validation,
      });
    } else {
      // Insert new lineup
      await sql`
        INSERT INTO lineups (
          id,
          fixture_id,
          team_id,
          round_number,
          season_id,
          tournament_id,
          starting_xi,
          substitutes,
          classic_player_count,
          is_valid,
          validation_errors,
          submitted_by,
          submitted_at,
          created_at,
          updated_at
        ) VALUES (
          ${lineupId},
          ${fixture_id},
          ${team_id},
          ${fixture.round_number},
          ${fixture.season_id},
          ${fixture.tournament_id},
          ${JSON.stringify(starting_xi)},
          ${JSON.stringify(substitutes)},
          ${validation.classicPlayerCount},
          ${validation.isValid},
          ${JSON.stringify(validation.errors)},
          ${submitted_by},
          NOW(),
          NOW(),
          NOW()
        )
      `;

      return NextResponse.json({
        success: true,
        message: 'Lineup submitted successfully',
        lineup_id: lineupId,
        validation,
      });
    }
  } catch (error: any) {
    console.error('Error submitting lineup:', error);
    return NextResponse.json(
      { error: 'Failed to submit lineup', details: error.message },
      { status: 500 }
    );
  }
}
