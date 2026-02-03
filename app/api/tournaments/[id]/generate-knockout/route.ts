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
        const {
            start_date,
            pairing_method = 'standard',
            matchup_mode = 'manual', // Allow changing from blind_lineup to manual
            is_two_legged = false, // Allow changing leg configuration
            knockout_format = 'single_leg' // New: single_leg, two_leg, or round_robin
        } = body;

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

        // Check if there are existing knockout rounds
        const existingKnockoutRounds = await sql`
      SELECT DISTINCT knockout_round, round_number
      FROM fixtures
      WHERE tournament_id = ${tournamentId}
        AND knockout_round IS NOT NULL
      ORDER BY round_number DESC
      LIMIT 1
    `;

        let qualifiedTeams: any[] = [];

        if (existingKnockoutRounds.length > 0) {
            // There are existing knockout rounds - get winners from the last knockout round
            const lastKnockoutRound = existingKnockoutRounds[0].round_number;
            
            console.log(`Found existing knockout round: ${existingKnockoutRounds[0].knockout_round} (round ${lastKnockoutRound})`);
            
            // Get winners from the last knockout round
            // For two-legged ties, we need to aggregate scores
            const knockoutWinners = await sql`
        WITH match_aggregates AS (
          SELECT 
            match_number,
            home_team_id,
            home_team_name,
            away_team_id,
            away_team_name,
            SUM(COALESCE(home_score, 0)) as total_home_score,
            SUM(COALESCE(away_score, 0)) as total_away_score,
            MAX(knockout_format) as knockout_format
          FROM fixtures
          WHERE tournament_id = ${tournamentId}
            AND round_number = ${lastKnockoutRound}
            AND status = 'completed'
          GROUP BY match_number, home_team_id, home_team_name, away_team_id, away_team_name
        )
        SELECT 
          CASE 
            WHEN total_home_score > total_away_score THEN home_team_id
            WHEN total_away_score > total_home_score THEN away_team_id
            ELSE home_team_id -- Default to home team if tied (should handle penalties separately)
          END as team_id,
          CASE 
            WHEN total_home_score > total_away_score THEN home_team_name
            WHEN total_away_score > total_home_score THEN away_team_name
            ELSE home_team_name
          END as team_name,
          match_number,
          total_home_score,
          total_away_score
        FROM match_aggregates
        ORDER BY match_number
      `;

            if (knockoutWinners.length === 0) {
                return NextResponse.json(
                    { error: `No completed matches found in the last knockout round. Please complete round ${lastKnockoutRound} before creating the next round.` },
                    { status: 400 }
                );
            }

            qualifiedTeams = knockoutWinners.map((winner: any) => ({
                team_id: winner.team_id,
                team_name: winner.team_name,
                match_number: winner.match_number
            }));

            console.log(`Found ${qualifiedTeams.length} winners from last knockout round`);
        } else {
            // No existing knockout rounds - get qualifiers from group stage
            console.log('No existing knockout rounds found, getting qualifiers from group stage');
            
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

            qualifiedTeams = groupStandings;
        }

        // Organize teams for pairing
        let pairings: Array<{ home: any; away: any }> = [];
        
        if (existingKnockoutRounds.length > 0) {
            // Pair winners sequentially: Winner of Match 1 vs Winner of Match 2, etc.
            for (let i = 0; i < qualifiedTeams.length; i += 2) {
                if (qualifiedTeams[i + 1]) {
                    pairings.push({
                        home: qualifiedTeams[i],
                        away: qualifiedTeams[i + 1]
                    });
                }
            }
        } else {
            // First knockout round - use group stage pairing logic
            // Organize teams by group and position
            const groupedTeams: Record<string, any[]> = {};
            qualifiedTeams.forEach((team: any) => {
                if (!groupedTeams[team.group_name]) {
                    groupedTeams[team.group_name] = [];
                }
                groupedTeams[team.group_name].push(team);
            });

            const groups = Object.keys(groupedTeams).sort();
            pairings = generatePairings(groupedTeams, groups, pairing_method);
        }

        if (pairings.length === 0) {
            return NextResponse.json(
                { error: 'Could not generate pairings. Not enough qualified teams.' },
                { status: 400 }
            );
        }

        const totalQualifiers = qualifiedTeams.length;

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

        // Get last round number
        const lastRound = await sql`
      SELECT COALESCE(MAX(round_number), 0) as max_round
      FROM fixtures
      WHERE tournament_id = ${tournamentId}
    `;
        let currentRound = lastRound[0].max_round + 1;

        const createdFixtures: any[] = [];
        const baseDate = start_date ? new Date(start_date) : new Date();

        // Create first round knockout fixtures
        for (let i = 0; i < pairings.length; i++) {
            const pairing = pairings[i];
            const currentKnockoutRound = knockoutRounds[0];

            // Determine fixture format based on knockout_format parameter
            // Finals are ALWAYS 1 leg, regardless of settings
            const isFinalRound = currentKnockoutRound === 'final';
            
            let legsToCreate = 1;
            let actualKnockoutFormat = knockout_format;
            
            if (isFinalRound) {
                // Finals are always single leg
                actualKnockoutFormat = 'single_leg';
                legsToCreate = 1;
            } else if (knockout_format === 'two_leg' || is_two_legged) {
                // Two-legged format
                actualKnockoutFormat = 'two_leg';
                legsToCreate = 2;
            } else if (knockout_format === 'round_robin') {
                // Round robin format (all vs all)
                actualKnockoutFormat = 'round_robin';
                legsToCreate = 1;
            } else {
                // Single leg format
                actualKnockoutFormat = 'single_leg';
                legsToCreate = 1;
            }

            // Create fixtures for each leg
            for (let legNum = 1; legNum <= legsToCreate; legNum++) {
                const scheduledDate = new Date(baseDate);
                // First leg: base date + match offset
                // Second leg: base date + match offset + 7 days
                const dayOffset = Math.floor(i / 2) * 3 + (legNum === 2 ? 7 : 0);
                scheduledDate.setDate(scheduledDate.getDate() + dayOffset);

                // For 2-legged ties, swap home/away for second leg
                const homeTeam = (legsToCreate === 2 && legNum === 2) ? pairing.away : pairing.home;
                const awayTeam = (legsToCreate === 2 && legNum === 2) ? pairing.home : pairing.away;

                const result = await sql`
          INSERT INTO fixtures (
            tournament_id, season_id,
            home_team_id, home_team_name,
            away_team_id, away_team_name,
            round_number, match_number, leg,
            knockout_round,
            knockout_format,
            matchup_mode,
            scheduled_date,
            status,
            created_at, updated_at
          ) VALUES (
            ${tournamentId},
            ${tournament.season_id},
            ${homeTeam.team_id},
            ${homeTeam.team_name},
            ${awayTeam.team_id},
            ${awayTeam.team_name},
            ${currentRound},
            ${i + 1},
            ${legNum},
            ${currentKnockoutRound},
            ${actualKnockoutFormat},
            ${matchup_mode},
            ${scheduledDate.toISOString().split('T')[0]},
            'scheduled',
            NOW(), NOW()
          )
          RETURNING id
        `;
        
                const actualFixtureId = result[0].id;

                createdFixtures.push({
                    id: actualFixtureId,
                    round: currentKnockoutRound,
                    match_number: i + 1,
                    leg: legNum,
                    knockout_format: actualKnockoutFormat,
                    home_team: homeTeam.team_name,
                    away_team: awayTeam.team_name,
                    scheduled_date: scheduledDate.toISOString().split('T')[0],
                    matchup_mode: matchup_mode
                });
            }
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
