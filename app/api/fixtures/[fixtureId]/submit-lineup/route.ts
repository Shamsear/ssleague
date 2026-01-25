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
        id, tournament_id, season_id, matchup_mode, round_number,
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
      SELECT home_lineup_submitted, away_lineup_submitted, lineups_locked
      FROM fixtures
      WHERE id = ${fixtureId}
      LIMIT 1
    `;

        const bothSubmitted = updatedFixtures[0].home_lineup_submitted &&
            updatedFixtures[0].away_lineup_submitted;
        const lineupsLocked = updatedFixtures[0].lineups_locked;

        // Auto-create matchups if both teams submitted and lineups not locked yet
        if (bothSubmitted && !lineupsLocked) {
            try {
                console.log(`🎯 Both teams submitted for fixture ${fixtureId}, auto-creating matchups...`);

                // Fetch both lineups
                const lineups = await sql`
                    SELECT team_id, players
                    FROM lineup_submissions
                    WHERE fixture_id = ${fixtureId}
                `;

                if (lineups.length !== 2) {
                    throw new Error('Both team lineups not found');
                }

                const homeLineup = lineups.find(l => l.team_id === fixture.home_team_id);
                const awayLineup = lineups.find(l => l.team_id === fixture.away_team_id);

                if (!homeLineup || !awayLineup) {
                    throw new Error('Could not find lineups for both teams');
                }

                // Helper function to safely parse players
                const parsePlayers = (players: any) => {
                    if (!players) return null;
                    if (typeof players === 'string') {
                        try {
                            return JSON.parse(players);
                        } catch (e) {
                            console.error('Failed to parse players JSON:', e);
                            return null;
                        }
                    }
                    return players;
                };

                // Parse lineups
                const homePlayers = parsePlayers(homeLineup.players);
                const awayPlayers = parsePlayers(awayLineup.players);

                if (!homePlayers || !awayPlayers) {
                    throw new Error('Failed to parse lineup data');
                }

                // Get playing players only and sort by position
                const homePlayingPlayers = homePlayers
                    .filter((p: any) => !p.is_substitute)
                    .sort((a: any, b: any) => a.position - b.position);

                const awayPlayingPlayers = awayPlayers
                    .filter((p: any) => !p.is_substitute)
                    .sort((a: any, b: any) => a.position - b.position);

                // Validate both have exactly 5 playing players
                if (homePlayingPlayers.length !== 5 || awayPlayingPlayers.length !== 5) {
                    throw new Error('Both teams must have exactly 5 playing players');
                }

                // Delete existing matchups (if any)
                await sql`
                    DELETE FROM matchups
                    WHERE fixture_id = ${fixtureId}
                `;

                // Create matchups by pairing players in order
                const matchupsCreated = [];
                for (let i = 0; i < 5; i++) {
                    const homePlayer = homePlayingPlayers[i];
                    const awayPlayer = awayPlayingPlayers[i];

                    await sql`
                        INSERT INTO matchups (
                            fixture_id,
                            tournament_id,
                            season_id,
                            round_number,
                            position,
                            home_player_id,
                            away_player_id,
                            home_player_name,
                            away_player_name,
                            home_goals,
                            away_goals,
                            created_at,
                            updated_at
                        ) VALUES (
                            ${fixtureId},
                            ${fixture.tournament_id},
                            ${fixture.season_id},
                            ${fixture.round_number || 1},
                            ${i + 1},
                            ${homePlayer.player_id},
                            ${awayPlayer.player_id},
                            ${homePlayer.player_name},
                            ${awayPlayer.player_name},
                            NULL,
                            NULL,
                            NOW(),
                            NOW()
                        )
                    `;

                    matchupsCreated.push({
                        position: i + 1,
                        home_player_name: homePlayer.player_name,
                        away_player_name: awayPlayer.player_name
                    });
                }

                // Lock lineups
                await sql`
                    UPDATE fixtures
                    SET lineups_locked = true
                    WHERE id = ${fixtureId}
                `;

                await sql`
                    UPDATE lineup_submissions
                    SET is_locked = true
                    WHERE fixture_id = ${fixtureId}
                `;

                console.log(`✅ Auto-created ${matchupsCreated.length} matchups for fixture ${fixtureId}`);

                return NextResponse.json({
                    success: true,
                    lineup_submitted: true,
                    both_submitted: true,
                    matchups_created: true,
                    matchups_count: matchupsCreated.length,
                    matchups: matchupsCreated,
                    message: `Both teams submitted! ${matchupsCreated.length} matchups created automatically.`
                });

            } catch (error: any) {
                console.error('❌ Error auto-creating matchups:', error);
                // Still return success for lineup submission
                return NextResponse.json({
                    success: true,
                    lineup_submitted: true,
                    both_submitted: true,
                    matchups_created: false,
                    message: 'Both teams submitted! Matchups will be created shortly.',
                    error: error.message
                });
            }
        }

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
            { success: false, error: error?.message || String(error) || 'Failed to submit lineup' },
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

        // Helper function to safely parse players (handles both string and already-parsed object)
        const parsePlayers = (players: any) => {
            if (!players) return null;
            if (typeof players === 'string') {
                try {
                    return JSON.parse(players);
                } catch (e) {
                    console.error('Failed to parse players JSON:', e);
                    return null;
                }
            }
            // Already an object
            return players;
        };

        return NextResponse.json({
            success: true,
            matchup_mode: fixture.matchup_mode,
            home_submitted: fixture.home_lineup_submitted,
            away_submitted: fixture.away_lineup_submitted,
            both_submitted: bothSubmitted,
            lineups_locked: fixture.lineups_locked,
            can_view_opponent: canViewLineups,
            my_lineup: myLineup ? parsePlayers(myLineup.players) : null,
            my_submitted_at: myLineup?.submitted_at,
            opponent_lineup: canViewLineups && opponentLineup
                ? parsePlayers(opponentLineup.players)
                : null,
            opponent_submitted: !!opponentLineup
        });

    } catch (error: any) {
        console.error('Error fetching lineup status:', error);
        return NextResponse.json(
            { success: false, error: error?.message || String(error) || 'Failed to fetch lineup status' },
            { status: 500 }
        );
    }
}
