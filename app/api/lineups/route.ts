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
      // Get specific team's lineup - ONLY for that team
      // This ensures Team A cannot fetch Team B's lineup by accident
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
      
      // Additional verification: ensure the returned lineup matches requested team_id
      if (lineups.length > 0 && lineups[0].team_id !== teamId) {
        console.error('❌ SECURITY: Lineup team_id mismatch!', {
          requested: teamId,
          returned: lineups[0].team_id
        });
        return NextResponse.json(
          { error: 'Unauthorized access to lineup' },
          { status: 403 }
        );
      }
    } else {
      // Get both teams' lineups (for admin/committee views)
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

    // If requesting specific team and no lineup found, return null
    // If requesting specific team and lineup found, return the lineup object
    // If requesting all lineups, return the array
    const response = teamId 
      ? (lineups.length > 0 ? lineups[0] : null)
      : lineups;
    
    return NextResponse.json({
      success: true,
      lineups: response,
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

    console.log('📥 Lineup API - Received request:', {
      fixture_id,
      team_id,
      starting_xi_count: starting_xi?.length,
      substitutes_count: substitutes?.length,
      starting_xi,
      substitutes,
      submitted_by
    });

    // Validation
    if (!fixture_id || !team_id || !starting_xi || !substitutes || !submitted_by) {
      console.error('❌ Missing required fields:', { fixture_id, team_id, starting_xi, substitutes, submitted_by });
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // CRITICAL: Verify the team_id is actually part of this fixture
    const fixtureCheck = await sql`
      SELECT home_team_id, away_team_id
      FROM fixtures
      WHERE id = ${fixture_id}
      LIMIT 1
    `;
    
    if (fixtureCheck.length === 0) {
      return NextResponse.json(
        { error: 'Fixture not found' },
        { status: 404 }
      );
    }
    
    const { home_team_id, away_team_id } = fixtureCheck[0];
    if (team_id !== home_team_id && team_id !== away_team_id) {
      console.error('❌ SECURITY: Team not part of fixture!', {
        team_id,
        home_team_id,
        away_team_id,
        fixture_id
      });
      return NextResponse.json(
        { error: 'Team is not part of this fixture' },
        { status: 403 }
      );
    }

    // Check if lineup can be edited (pass team_id to check home team permissions)
    const editableCheck = await isLineupEditable(fixture_id, team_id);
    if (!editableCheck.editable) {
      // Check if it's because matchups exist
      const matchupsResult = await sql`
        SELECT COUNT(*) as count FROM matchups WHERE fixture_id = ${fixture_id}
      `;
      const matchupsExist = matchupsResult[0].count > 0;
      
      if (matchupsExist) {
        return NextResponse.json(
          { 
            error: 'Lineup locked - matchups have been created',
            message: 'Matchups already exist for this fixture. To edit lineup, go to the fixture page and use the "Edit Your Lineup" button.',
            requires_confirmation: true
          },
          { status: 409 }
        );
      }
      
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
    console.log('🔍 Validating lineup for:', { season_id: fixture.season_id, team_id, tournament_id: fixture.tournament_id });
    const validation = await validateLineup(
      { starting_xi, substitutes },
      fixture.season_id,
      team_id,
      fixture.tournament_id
    );
    console.log('🔍 Validation result:', validation);

    if (!validation.isValid) {
      console.error('❌ Lineup validation failed:', validation.errors);
      return NextResponse.json(
        { 
          error: 'Lineup validation failed', 
          errors: validation.errors 
        },
        { status: 400 }
      );
    }

    // Generate lineup ID based on fixture and team
    // This ensures each team has a unique lineup entry per fixture
    const lineupId = generateLineupId(fixture_id, team_id);
    
    console.log('💾 Saving lineup:', { lineupId, fixture_id, team_id });

    // Check if matchups exist - if so, delete them when lineup changes
    const matchupsResult = await sql`
      SELECT COUNT(*) as count FROM matchups WHERE fixture_id = ${fixture_id}
    `;
    const matchupsExist = matchupsResult[0].count > 0;
    let matchupsDeleted = false;

    if (matchupsExist) {
      console.log('🗑️ Deleting existing matchups due to lineup change');
      await sql`
        DELETE FROM matchups WHERE fixture_id = ${fixture_id}
      `;
      matchupsDeleted = true;
    }

    // Use UPSERT to handle both create and update in a single query
    // This prevents race conditions and handles both cases reliably
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
      ON CONFLICT (id) DO UPDATE SET
        starting_xi = EXCLUDED.starting_xi,
        substitutes = EXCLUDED.substitutes,
        classic_player_count = EXCLUDED.classic_player_count,
        is_valid = EXCLUDED.is_valid,
        validation_errors = EXCLUDED.validation_errors,
        updated_at = NOW()
    `;

    return NextResponse.json({
      success: true,
      message: matchupsDeleted ? 'Lineup saved successfully. Matchups have been deleted and need to be recreated.' : 'Lineup saved successfully',
      lineup_id: lineupId,
      validation,
      matchups_deleted: matchupsDeleted,
    });
  } catch (error: any) {
    console.error('Error submitting lineup:', error);
    return NextResponse.json(
      { error: 'Failed to submit lineup', details: error.message },
      { status: 500 }
    );
  }
}
