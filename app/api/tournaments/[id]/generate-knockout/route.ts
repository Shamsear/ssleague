import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

interface RouteContext {
    params: Promise<{ id: string }>;
}

export async function POST(
    request: NextRequest,
    context: RouteContext
) {
    try {
        const sql = getTournamentDb();
        const params = await context.params;
        const tournamentId = params.id;
        const body = await request.json();
        const { start_date, pairing_method = 'standard' } = body;

        // Get tournament details
        const [tournament] = await sql`
      SELECT 
        id, tournament_name, season_id,
        has_group_stage, has_knockout_stage,
        number_of_groups, teams_advancing_per_group,
        playoff_teams
      FROM tournaments
      WHERE id = ${tournamentId}
      LIMIT 1
    `;

        if (!tournament) {
            return NextResponse.json(
                { error: 'Tournament not found' },
                { status: 404 }
            );
        }

        if (!tournament.has_knockout_stage) {
            return NextResponse.json(
                { error: 'Tournament does not have knockout stage enabled' },
                { status: 400 }
            );
        }

        // Get group standings to determine qualifiers
        const groupStandings = await sql`
      WITH group_standings AS (
        SELECT 
          ts.team_id,
          ts.team_name,
          ts.points,
          ts.goal_difference,
          ts.goals_for,
          ttg.group_name,
          ROW_NUMBER() OVER (
            PARTITION BY ttg.group_name 
            ORDER BY ts.points DESC, ts.goal_difference DESC, ts.goals_for DESC
          ) as group_position
        FROM teamstats ts
        JOIN tournament_team_groups ttg ON ts.team_id = ttg.team_id AND ts.tournament_id = ttg.tournament_id
        WHERE ts.tournament_id = ${tournamentId}
          AND ttg.tournament_id = ${tournamentId}
      )
      SELECT *
      FROM group_standings
      WHERE group_position <= ${tournament.teams_advancing_per_group || 2}
      ORDER BY group_name, group_position
    `;

        if (groupStandings.length === 0) {
            return NextResponse.json(
                { error: 'No qualified teams found. Ensure group stage is complete and teams are assigned to groups.' },
                { status: 400 }
            );
        }

        // Organize teams by group and position
        const groupedTeams: Record<string, any[]> = {};
        groupStandings.forEach((team: any) => {
            if (!groupedTeams[team.group_name]) {
                groupedTeams[team.group_name] = [];
            }
            groupedTeams[team.group_name].push(team);
        });

        const groups = Object.keys(groupedTeams).sort();
        const totalQualifiers = groupStandings.length;

        // Determine knockout structure
        let knockoutRounds: string[] = [];
        if (totalQualifiers === 16) {
            knockoutRounds = ['round_of_16', 'quarter_final', 'semi_final', 'final'];
        } else if (totalQualifiers === 8) {
            knockoutRounds = ['quarter_final', 'semi_final', 'final'];
        } else if (totalQualifiers === 4) {
            knockoutRounds = ['semi_final', 'final'];
        } else if (totalQualifiers === 2) {
            knockoutRounds = ['final'];
        } else {
            return NextResponse.json(
                { error: `Unsupported number of qualifiers: ${totalQualifiers}. Supported: 2, 4, 8, 16` },
                { status: 400 }
            );
        }

        // Get last round number from group stage
        const lastRound = await sql`
      SELECT COALESCE(MAX(round_number), 0) as max_round
      FROM fixtures
      WHERE tournament_id = ${tournamentId}
        AND knockout_round IS NULL
    `;
        let currentRound = lastRound[0].max_round + 1;

        // Generate pairings for first knockout round
        const pairings = generatePairings(groupedTeams, groups, pairing_method);

        const createdFixtures: any[] = [];
        const baseDate = start_date ? new Date(start_date) : new Date();

        // Create first round knockout fixtures
        for (let i = 0; i < pairings.length; i++) {
            const pairing = pairings[i];
            const fixtureId = `${tournamentId}_KO_${knockoutRounds[0]}_${i + 1}`;

            const scheduledDate = new Date(baseDate);
            scheduledDate.setDate(scheduledDate.getDate() + Math.floor(i / 2) * 3); // 3 days between match days

            await sql`
        INSERT INTO fixtures (
          id, tournament_id, season_id,
          home_team_id, home_team_name,
          away_team_id, away_team_name,
          round_number, leg,
          knockout_round,
          scheduled_date,
          status,
          created_at, updated_at
        ) VALUES (
          ${fixtureId},
          ${tournamentId},
          ${tournament.season_id},
          ${pairing.home.team_id},
          ${pairing.home.team_name},
          ${pairing.away.team_id},
          ${pairing.away.team_name},
          ${currentRound},
          1,
          ${knockoutRounds[0]},
          ${scheduledDate.toISOString().split('T')[0]},
          'scheduled',
          NOW(), NOW()
        )
      `;

            createdFixtures.push({
                id: fixtureId,
                round: knockoutRounds[0],
                match_number: i + 1,
                home_team: pairing.home.team_name,
                away_team: pairing.away.team_name,
                scheduled_date: scheduledDate.toISOString().split('T')[0]
            });
        }

        return NextResponse.json({
            success: true,
            message: `Generated ${createdFixtures.length} knockout fixtures`,
            knockout_structure: {
                total_qualifiers: totalQualifiers,
                rounds: knockoutRounds,
                first_round: knockoutRounds[0],
                fixtures_created: createdFixtures.length
            },
            fixtures: createdFixtures,
            note: 'Subsequent rounds (semi-finals, final) will be created after previous round completes'
        });

    } catch (error: any) {
        console.error('Error generating knockout fixtures:', error);
        return NextResponse.json(
            { error: 'Failed to generate knockout fixtures', details: error.message },
            { status: 500 }
        );
    }
}

function generatePairings(
    groupedTeams: Record<string, any[]>,
    groups: string[],
    method: string
): Array<{ home: any; away: any }> {
    const pairings: Array<{ home: any; away: any }> = [];

    if (method === 'standard' && groups.length === 4) {
        // Standard UEFA-style pairing for 4 groups
        // QF1: A1 vs B2
        // QF2: C1 vs D2
        // QF3: B1 vs A2
        // QF4: D1 vs C2

        const groupA = groupedTeams[groups[0]];
        const groupB = groupedTeams[groups[1]];
        const groupC = groupedTeams[groups[2]];
        const groupD = groupedTeams[groups[3]];

        if (groupA && groupB && groupC && groupD) {
            pairings.push({ home: groupA[0], away: groupB[1] }); // A1 vs B2
            pairings.push({ home: groupC[0], away: groupD[1] }); // C1 vs D2
            pairings.push({ home: groupB[0], away: groupA[1] }); // B1 vs A2
            pairings.push({ home: groupD[0], away: groupC[1] }); // D1 vs C2
        }
    } else if (method === 'bracket') {
        // Bracket-style pairing
        const winners: any[] = [];
        const runnersUp: any[] = [];

        groups.forEach(group => {
            if (groupedTeams[group]) {
                winners.push(groupedTeams[group][0]);
                if (groupedTeams[group][1]) {
                    runnersUp.push(groupedTeams[group][1]);
                }
            }
        });

        // Pair winners with runners-up in bracket style
        for (let i = 0; i < winners.length && i < runnersUp.length; i++) {
            pairings.push({
                home: winners[i],
                away: runnersUp[runnersUp.length - 1 - i] // Reverse order for runners-up
            });
        }
    } else {
        // Simple sequential pairing
        const allQualifiers: any[] = [];
        groups.forEach(group => {
            if (groupedTeams[group]) {
                allQualifiers.push(...groupedTeams[group]);
            }
        });

        for (let i = 0; i < allQualifiers.length; i += 2) {
            if (allQualifiers[i + 1]) {
                pairings.push({
                    home: allQualifiers[i],
                    away: allQualifiers[i + 1]
                });
            }
        }
    }

    return pairings;
}
