import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

// POST - Submit lineup order for blind lineup mode
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ fixtureId: string }> }
) {
    try {
        const sql = getTournamentDb();
        const { fixtureId } = await params;
        const body = await request.json();

        const { team_id, players } = body;

        if (!team_id || !players || !Array.isArray(players)) {
            return NextResponse.json(
                { success: false, error: 'Missing required fields: team_id, players' },
                { status: 400 }
            );
        }

        // Validate players array
        if (players.length < 5 || players.length > 7) {
            return NextResponse.json(
                { success: false, error: 'Must have 5-7 players (5 playing, 0-2 substitutes)' },
                { status: 400 }
            );
        }

        // Count playing vs substitute players
        const playingPlayers = players.filter(p => !p.is_substitute);
        const substitutePlayers = players.filter(p => p.is_substitute);

        if (playingPlayers.length !== 5) {
            return NextResponse.json(
                { success: false, error: 'Must have exactly 5 playing players' },
                { status: 400 }
            );
        }

        if (substitutePlayers.length > 2) {
            return NextResponse.json(
                { success: false, error: 'Maximum 2 substitute players allowed' },
                { status: 400 }
            );
        }

        // Fetch fixture details
        const fixtures = await sql`
      SELECT 
        id, tournament_id, season_id, matchup_mode,
        home_team_id, away_team_id,
        home_lineup_submitted, away_lineup_submitted, lineups_locked
      FROM fixtures
      WHERE id = ${fixtureId}
      LIMIT 1
    `;

        if (fixtures.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Fixture not found' },
                { status: 404 }
            );
        }

        const fixture = fixtures[0];

        // Validate matchup mode
        if (fixture.matchup_mode !== 'blind_lineup') {
            return NextResponse.json(
                { success: false, error: 'This fixture is not in blind lineup mode' },
                { status: 400 }
            );
        }

        // Check if lineups are locked
        if (fixture.lineups_locked) {
            return NextResponse.json(
                { success: false, error: 'Lineups are locked. Home fixture phase has ended.' },
                { status: 400 }
            );
        }

        // Validate team owns this fixture
        const isHomeTeam = fixture.home_team_id === team_id;
        const isAwayTeam = fixture.away_team_id === team_id;

        if (!isHomeTeam && !isAwayTeam) {
            return NextResponse.json(
                { success: false, error: 'Team does not belong to this fixture' },
                { status: 403 }
            );
        }

        // Upsert lineup submission
        await sql`
      INSERT INTO lineup_submissions (
        fixture_id,
        team_id,
        season_id,
        tournament_id,
        players,
        submitted_at,
        updated_at
      ) VALUES (
        ${fixtureId},
        ${team_id},
        ${fixture.season_id},
        ${fixture.tournament_id},
        ${JSON.stringify(players)},
        NOW(),
        NOW()
      )
      ON CONFLICT (fixture_id, team_id)
      DO UPDATE SET
        players = EXCLUDED.players,
        updated_at = NOW()
    `;

        // Update fixture submission status
        if (isHomeTeam) {
            await sql`
        UPDATE fixtures
        SET home_lineup_submitted = true
        WHERE id = ${fixtureId}
      `;
        } else {
            await sql`
        UPDATE fixtures
        SET away_lineup_submitted = true
        WHERE id = ${fixtureId}
      `;
        }

        // Check if both teams have submitted
        const updatedFixtures = await sql`
      SELECT home_lineup_submitted, away_lineup_submitted
      FROM fixtures
      WHERE id = ${fixtureId}
      LIMIT 1
    `;

        const bothSubmitted = updatedFixtures[0].home_lineup_submitted &&
            updatedFixtures[0].away_lineup_submitted;

        return NextResponse.json({
            success: true,
            lineup_submitted: true,
            both_submitted: bothSubmitted,
            message: bothSubmitted
                ? 'Both teams submitted! Matchups will be created when home fixture phase ends.'
                : 'Lineup submitted successfully. Waiting for opponent...'
        });

    } catch (error: any) {
        console.error('Error submitting lineup:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

// GET - Get lineup submission status
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ fixtureId: string }> }
) {
    try {
        const sql = getTournamentDb();
        const { fixtureId } = await params;
        const { searchParams } = new URL(request.url);
        const teamId = searchParams.get('team_id');

        if (!teamId) {
            return NextResponse.json(
                { success: false, error: 'Missing team_id parameter' },
                { status: 400 }
            );
        }

        // Fetch fixture
        const fixtures = await sql`
      SELECT 
        id, matchup_mode, home_team_id, away_team_id,
        home_lineup_submitted, away_lineup_submitted, lineups_locked
      FROM fixtures
      WHERE id = ${fixtureId}
      LIMIT 1
    `;

        if (fixtures.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Fixture not found' },
                { status: 404 }
            );
        }

        const fixture = fixtures[0];

        // Check if team belongs to fixture
        const isHomeTeam = fixture.home_team_id === teamId;
        const isAwayTeam = fixture.away_team_id === teamId;

        if (!isHomeTeam && !isAwayTeam) {
            return NextResponse.json(
                { success: false, error: 'Team does not belong to this fixture' },
                { status: 403 }
            );
        }

        const bothSubmitted = fixture.home_lineup_submitted && fixture.away_lineup_submitted;
        const canViewLineups = fixture.lineups_locked; // Can only view after locked

        // Fetch lineups
        const lineups = await sql`
      SELECT team_id, players, submitted_at
      FROM lineup_submissions
      WHERE fixture_id = ${fixtureId}
    `;

        const myLineup = lineups.find(l => l.team_id === teamId);
        const opponentLineup = lineups.find(l => l.team_id !== teamId);

        return NextResponse.json({
            success: true,
            matchup_mode: fixture.matchup_mode,
            home_submitted: fixture.home_lineup_submitted,
            away_submitted: fixture.away_lineup_submitted,
            both_submitted: bothSubmitted,
            lineups_locked: fixture.lineups_locked,
            can_view_opponent: canViewLineups,
            my_lineup: myLineup ? JSON.parse(myLineup.players as string) : null,
            my_submitted_at: myLineup?.submitted_at,
            opponent_lineup: canViewLineups && opponentLineup
                ? JSON.parse(opponentLineup.players as string)
                : null,
            opponent_submitted: !!opponentLineup
        });

    } catch (error: any) {
        console.error('Error fetching lineup status:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
