import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

export async function POST(
  request: NextRequest,
  { params }: { params: { tournamentId: string } }
) {
  try {
    const { tournamentId } = params;
    const body = await request.json();
    const {
      knockout_round,
      round_number,
      num_teams,
      knockout_format,
      scoring_system,
      matchup_mode,
      teams,
      pairing_method,
      start_date,
      created_by,
      created_by_name
    } = body;

    // Validate inputs
    if (!knockout_round || !round_number || !num_teams || !teams || teams.length !== num_teams) {
      return NextResponse.json({
        success: false,
        error: 'Invalid input parameters'
      }, { status: 400 });
    }

    // Get tournament details
    const tournamentResult = await sql`
      SELECT * FROM tournaments WHERE id = ${tournamentId}
    `;

    if (tournamentResult.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Tournament not found'
      }, { status: 404 });
    }

    const tournament = tournamentResult[0];

    // Determine number of matches based on format and round type
    let numMatches = 0;
    let isThirdPlace = knockout_round === 'third_place';

    if (isThirdPlace) {
      numMatches = 1; // Only one match for third place
    } else {
      numMatches = num_teams / 2; // Standard knockout pairing
    }

    // Create fixtures based on pairing method
    const fixtures = [];
    let matchNumber = 1;

    if (pairing_method === 'standard') {
      // Standard seeding: 1 vs 8, 2 vs 7, 3 vs 6, 4 vs 5
      for (let i = 0; i < numMatches; i++) {
        const homeTeam = teams[i];
        const awayTeam = teams[num_teams - 1 - i];

        fixtures.push({
          home_team: homeTeam,
          away_team: awayTeam,
          match_number: matchNumber++
        });
      }
    } else if (pairing_method === 'manual') {
      // Manual pairing: use order as provided
      for (let i = 0; i < numMatches; i++) {
        const homeTeam = teams[i * 2];
        const awayTeam = teams[i * 2 + 1];

        fixtures.push({
          home_team: homeTeam,
          away_team: awayTeam,
          match_number: matchNumber++
        });
      }
    } else if (pairing_method === 'random') {
      // Random pairing: shuffle teams
      const shuffled = [...teams].sort(() => Math.random() - 0.5);
      for (let i = 0; i < numMatches; i++) {
        const homeTeam = shuffled[i * 2];
        const awayTeam = shuffled[i * 2 + 1];

        fixtures.push({
          home_team: homeTeam,
          away_team: awayTeam,
          match_number: matchNumber++
        });
      }
    }

    // Insert fixtures into database
    let fixturesCreated = 0;

    for (const fixture of fixtures) {
      // Determine leg configuration
      const legs = knockout_format === 'two_leg' ? ['leg1', 'leg2'] : ['single'];

      for (const leg of legs) {
        await sql`
          INSERT INTO fixtures (
            tournament_id,
            season_id,
            home_team_id,
            away_team_id,
            round_number,
            leg,
            match_number,
            scheduled_date,
            status,
            matchup_mode,
            scoring_system,
            knockout_round,
            created_by,
            created_by_name,
            created_at,
            updated_at
          ) VALUES (
            ${tournamentId},
            ${tournament.season_id},
            ${fixture.home_team.team_id},
            ${fixture.away_team.team_id},
            ${round_number},
            ${leg},
            ${fixture.match_number},
            ${start_date},
            'scheduled',
            ${matchup_mode || 'manual'},
            ${scoring_system || 'goals'},
            ${knockout_round},
            ${created_by},
            ${created_by_name},
            NOW(),
            NOW()
          )
        `;
        fixturesCreated++;
      }
    }

    return NextResponse.json({
      success: true,
      fixtures_created: fixturesCreated,
      knockout_round,
      round_number,
      message: `Successfully created ${fixturesCreated} fixtures for ${knockout_round}`
    });

  } catch (error: any) {
    console.error('Error generating knockout round:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to generate knockout round'
    }, { status: 500 });
  }
}
