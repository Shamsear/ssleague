import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

// POST - Auto-create matchups from submitted lineups
// Called when home fixture phase ends for blind_lineup fixtures
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ fixtureId: string }> }
) {
    try {
        const sql = getTournamentDb();
        const { fixtureId } = await params;

        // Fetch fixture
        const fixtures = await sql`
      SELECT 
        id, tournament_id, season_id, matchup_mode,
        home_team_id, away_team_id, home_team_name, away_team_name,
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

        // Check if both teams submitted
        if (!fixture.home_lineup_submitted || !fixture.away_lineup_submitted) {
            return NextResponse.json(
                { success: false, error: 'Both teams must submit lineups before creating matchups' },
                { status: 400 }
            );
        }

        // Check if already locked
        if (fixture.lineups_locked) {
            return NextResponse.json(
                { success: false, error: 'Lineups already locked and matchups created' },
                { status: 400 }
            );
        }

        // Fetch both lineups
        const lineups = await sql`
      SELECT team_id, players
      FROM lineup_submissions
      WHERE fixture_id = ${fixtureId}
    `;

        if (lineups.length !== 2) {
            return NextResponse.json(
                { success: false, error: 'Both team lineups not found' },
                { status: 400 }
            );
        }

        const homeLineup = lineups.find(l => l.team_id === fixture.home_team_id);
        const awayLineup = lineups.find(l => l.team_id === fixture.away_team_id);

        if (!homeLineup || !awayLineup) {
            return NextResponse.json(
                { success: false, error: 'Could not find lineups for both teams' },
                { status: 400 }
            );
        }

        // Parse lineups
        const homePlayers = JSON.parse(homeLineup.players as string);
        const awayPlayers = JSON.parse(awayLineup.players as string);

        // Get playing players only (not substitutes) and sort by position
        const homePlayingPlayers = homePlayers
            .filter((p: any) => !p.is_substitute)
            .sort((a: any, b: any) => a.position - b.position);

        const awayPlayingPlayers = awayPlayers
            .filter((p: any) => !p.is_substitute)
            .sort((a: any, b: any) => a.position - b.position);

        // Validate both have exactly 5 playing players
        if (homePlayingPlayers.length !== 5 || awayPlayingPlayers.length !== 5) {
            return NextResponse.json(
                { success: false, error: 'Both teams must have exactly 5 playing players' },
                { status: 400 }
            );
        }

        // Delete existing matchups (if any)
        await sql`
      DELETE FROM matchups
      WHERE fixture_id = ${fixtureId}
    `;

        // Create matchups by pairing players in order
        const matchupsToCreate = [];
        for (let i = 0; i < 5; i++) {
            const homePlayer = homePlayingPlayers[i];
            const awayPlayer = awayPlayingPlayers[i];

            matchupsToCreate.push({
                fixture_id: fixtureId,
                tournament_id: fixture.tournament_id,
                season_id: fixture.season_id,
                matchup_number: i + 1,
                home_player_id: homePlayer.player_id,
                away_player_id: awayPlayer.player_id,
                home_player_name: homePlayer.player_name,
                away_player_name: awayPlayer.player_name,
                home_score: null,
                away_score: null,
                status: 'pending'
            });
        }

        // Insert all matchups
        for (const matchup of matchupsToCreate) {
            await sql`
        INSERT INTO matchups (
          fixture_id,
          tournament_id,
          season_id,
          matchup_number,
          home_player_id,
          away_player_id,
          home_player_name,
          away_player_name,
          home_score,
          away_score,
          status,
          created_at,
          updated_at
        ) VALUES (
          ${matchup.fixture_id},
          ${matchup.tournament_id},
          ${matchup.season_id},
          ${matchup.matchup_number},
          ${matchup.home_player_id},
          ${matchup.away_player_id},
          ${matchup.home_player_name},
          ${matchup.away_player_name},
          ${matchup.home_score},
          ${matchup.away_score},
          ${matchup.status},
          NOW(),
          NOW()
        )
      `;
        }

        // Lock lineups and mark fixture
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

        console.log(`✅ Auto-created ${matchupsToCreate.length} matchups for fixture ${fixtureId}`);

        return NextResponse.json({
            success: true,
            matchups_created: matchupsToCreate.length,
            matchups: matchupsToCreate,
            message: 'Matchups created successfully from lineup orders'
        });

    } catch (error: any) {
        console.error('Error auto-creating matchups:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
