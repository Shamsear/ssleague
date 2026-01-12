import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';
import { verifyAuth } from '@/lib/auth-helper';
import { generateLineupId } from '@/lib/lineup-validation';

/**
 * Allow committee admin to set lineup for teams that haven't submitted
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ fixtureId: string }> }
) {
    try {
        const { fixtureId } = await params;

        const auth = await verifyAuth(['committee_admin'], request);
        if (!auth.authenticated) {
            return NextResponse.json(
                { success: false, error: auth.error || 'Unauthorized' },
                { status: 401 }
            );
        }

        const userId = auth.userId!;

        // Get request body
        const body = await request.json();
        const { players, team_type } = body as {
            players: Array<{
                player_id: string;
                player_name: string;
                position: number;
                is_substitute: boolean;
            }>;
            team_type: 'home' | 'away';
        };

        // Validate lineup
        if (!players || players.length < 5 || players.length > 7) {
            return NextResponse.json(
                { success: false, error: 'Lineup must have between 5 and 7 players' },
                { status: 400 }
            );
        }

        const playingCount = players.filter(p => !p.is_substitute).length;
        if (playingCount !== 5) {
            return NextResponse.json(
                { success: false, error: 'Lineup must have exactly 5 playing players' },
                { status: 400 }
            );
        }

        if (!team_type || !['home', 'away'].includes(team_type)) {
            return NextResponse.json(
                { success: false, error: 'Invalid team type' },
                { status: 400 }
            );
        }

        const sql = getTournamentDb();

        const fixtures = await sql`
      SELECT * FROM fixtures WHERE id = ${fixtureId} LIMIT 1
    `;

        if (fixtures.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Fixture not found' },
                { status: 404 }
            );
        }

        const fixture = fixtures[0];
        const teamId = team_type === 'home' ? fixture.home_team_id : fixture.away_team_id;

        // Check if lineup already exists
        const existingLineup = await sql`
      SELECT * FROM lineups 
      WHERE fixture_id = ${fixtureId} AND team_id = ${teamId}
      LIMIT 1
    `;

        if (existingLineup.length > 0 && existingLineup[0].is_locked) {
            return NextResponse.json(
                { success: false, error: 'Lineup is already locked' },
                { status: 403 }
            );
        }

        // Verify all players belong to the team
        const seasonId = fixture.season_id;
        const playerIds = players.map(p => p.player_id);

        const teamPlayers = await sql`
      SELECT player_id 
      FROM player_seasons 
      WHERE team_id = ${teamId} 
        AND season_id = ${seasonId}
        AND player_id = ANY(${playerIds})
        AND status = 'active'
    `;

        if (teamPlayers.length !== players.length) {
            return NextResponse.json(
                { success: false, error: 'All players must belong to the team' },
                { status: 400 }
            );
        }

        // Separate starting XI and substitutes - only save player IDs
        const startingXI = players
            .filter(p => !p.is_substitute)
            .sort((a, b) => a.position - b.position)
            .map(p => p.player_id);

        const substitutes = players
            .filter(p => p.is_substitute)
            .sort((a, b) => a.position - b.position)
            .map(p => p.player_id);

        // Generate lineup ID
        const lineupId = generateLineupId(fixtureId, teamId);

        // Save lineup using UPSERT
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
        ${fixtureId},
        ${teamId},
        ${fixture.round_number},
        ${fixture.season_id},
        ${fixture.tournament_id},
        ${JSON.stringify(startingXI)},
        ${JSON.stringify(substitutes)},
        ${startingXI.length},
        true,
        ${JSON.stringify([])},
        ${userId},
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
        submitted_by = EXCLUDED.submitted_by,
        submitted_at = EXCLUDED.submitted_at,
        updated_at = NOW()
    `;

        // Record the action in audit log
        await sql`
      INSERT INTO lineup_audit_log (
        fixture_id,
        team_id,
        action,
        new_lineup,
        changed_by,
        reason
      ) VALUES (
        ${fixtureId},
        ${teamId},
        'created',
        ${JSON.stringify({ starting_xi: startingXI, substitutes: substitutes })}::jsonb,
        ${userId},
        'Committee admin set lineup for team'
      )
    `;

        console.log(`✅ Committee admin set ${team_type} team lineup for fixture ${fixtureId}`);

        return NextResponse.json({
            success: true,
            message: 'Lineup set successfully',
            lineup_id: lineupId,
        });
    } catch (error: any) {
        console.error('Error setting lineup:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Failed to set lineup' },
            { status: 500 }
        );
    }
}

/**
 * Get available players for a team in a fixture
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ fixtureId: string }> }
) {
    try {
        const { fixtureId } = await params;

        const auth = await verifyAuth(['committee_admin'], request);
        if (!auth.authenticated) {
            return NextResponse.json(
                { success: false, error: auth.error || 'Unauthorized' },
                { status: 401 }
            );
        }

        const { searchParams } = new URL(request.url);
        const teamType = searchParams.get('team_type') as 'home' | 'away';

        if (!teamType || !['home', 'away'].includes(teamType)) {
            return NextResponse.json(
                { success: false, error: 'Invalid team type' },
                { status: 400 }
            );
        }

        const sql = getTournamentDb();

        const fixtures = await sql`
      SELECT * FROM fixtures WHERE id = ${fixtureId} LIMIT 1
    `;

        if (fixtures.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Fixture not found' },
                { status: 404 }
            );
        }

        const fixture = fixtures[0];
        const teamId = teamType === 'home' ? fixture.home_team_id : fixture.away_team_id;

        // Get all active players for the team
        const players = await sql`
      SELECT 
        ps.player_id,
        ps.player_name,
        ps.status
      FROM player_seasons ps
      WHERE ps.team_id = ${teamId}
        AND ps.season_id = ${fixture.season_id}
        AND ps.status = 'active'
      ORDER BY ps.player_name
    `;

        return NextResponse.json({
            success: true,
            players: players,
            team_id: teamId,
            team_name: teamType === 'home' ? fixture.home_team_name : fixture.away_team_name,
        });
    } catch (error: any) {
        console.error('Error fetching players:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Failed to fetch players' },
            { status: 500 }
        );
    }
}
