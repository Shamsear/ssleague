import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';
import { adminDb } from '@/lib/firebase/admin';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const sql = getTournamentDb();
        const { id: tournamentId } = await params;
        const { searchParams } = new URL(request.url);
        const seasonId = searchParams.get('season_id');

        if (!seasonId) {
            return NextResponse.json(
                { success: false, error: 'season_id is required' },
                { status: 400 }
            );
        }

        // Get tournament details with rewards
        const [tournament] = await sql`
      SELECT * FROM tournaments WHERE id = ${tournamentId} LIMIT 1
    `;

        if (!tournament) {
            return NextResponse.json(
                { success: false, error: 'Tournament not found' },
                { status: 404 }
            );
        }

        // Calculate standings from fixtures (ALWAYS, to ensure accuracy)
        // Get all completed fixtures for this tournament (EXCLUDING knockout fixtures)
        // Standings are based on league/group stage only
        // Fixture ID pattern: knockout has "_ko_", group has "_grp", league has neither
        const fixtures = await sql`
      SELECT 
        f.id,
        f.home_team_id,
        f.away_team_id,
        f.home_team_name,
        f.away_team_name,
        f.home_score,
        f.away_score,
        f.status,
        f.group_name,
        f.knockout_round
      FROM fixtures f
      WHERE f.tournament_id = ${tournamentId}
        AND f.season_id = ${seasonId}
        AND f.status = 'completed'
        AND f.home_score IS NOT NULL
        AND f.away_score IS NOT NULL
        AND f.id NOT LIKE '%_ko_%'
    `;

        let standings: any[] = [];

        if (fixtures.length === 0) {
            // No fixtures yet, try teamstats as fallback
            standings = await sql`
        SELECT 
          ts.id,
          ts.team_id,
          ts.position,
          ts.points,
          ts.wins,
          ts.draws,
          ts.losses,
          ts.goals_for,
          ts.goals_against,
          ts.goal_difference
        FROM teamstats ts
        WHERE ts.season_id = ${seasonId}
          AND ts.tournament_id = ${tournamentId}
        ORDER BY ts.position ASC
      `;
        } else {
            // Calculate standings from fixtures
                const teamStats = new Map<string, {
                    team_id: string;
                    team_name: string;
                    points: number;
                    wins: number;
                    draws: number;
                    losses: number;
                    goals_for: number;
                    goals_against: number;
                    goal_difference: number;
                }>();

                // Process each fixture
                for (const fixture of fixtures) {
                    // Initialize home team if not exists
                    if (!teamStats.has(fixture.home_team_id)) {
                        teamStats.set(fixture.home_team_id, {
                            team_id: fixture.home_team_id,
                            team_name: fixture.home_team_name,
                            points: 0,
                            wins: 0,
                            draws: 0,
                            losses: 0,
                            goals_for: 0,
                            goals_against: 0,
                            goal_difference: 0
                        });
                    }

                    // Initialize away team if not exists
                    if (!teamStats.has(fixture.away_team_id)) {
                        teamStats.set(fixture.away_team_id, {
                            team_id: fixture.away_team_id,
                            team_name: fixture.away_team_name,
                            points: 0,
                            wins: 0,
                            draws: 0,
                            losses: 0,
                            goals_for: 0,
                            goals_against: 0,
                            goal_difference: 0
                        });
                    }

                    const homeTeam = teamStats.get(fixture.home_team_id)!;
                    const awayTeam = teamStats.get(fixture.away_team_id)!;

                    // Update goals
                    homeTeam.goals_for += fixture.home_score;
                    homeTeam.goals_against += fixture.away_score;
                    awayTeam.goals_for += fixture.away_score;
                    awayTeam.goals_against += fixture.home_score;

                    // Determine result and update points/wins/draws/losses
                    if (fixture.home_score > fixture.away_score) {
                        // Home win
                        homeTeam.points += 3;
                        homeTeam.wins += 1;
                        awayTeam.losses += 1;
                    } else if (fixture.home_score < fixture.away_score) {
                        // Away win
                        awayTeam.points += 3;
                        awayTeam.wins += 1;
                        homeTeam.losses += 1;
                    } else {
                        // Draw
                        homeTeam.points += 1;
                        homeTeam.draws += 1;
                        awayTeam.points += 1;
                        awayTeam.draws += 1;
                    }

                    // Update goal difference
                    homeTeam.goal_difference = homeTeam.goals_for - homeTeam.goals_against;
                    awayTeam.goal_difference = awayTeam.goals_for - awayTeam.goals_against;
                }

                // Convert to array and sort by points, then goal difference
                const sortedTeams = Array.from(teamStats.values()).sort((a, b) => {
                    if (b.points !== a.points) return b.points - a.points;
                    if (b.goal_difference !== a.goal_difference) return b.goal_difference - a.goal_difference;
                    if (b.goals_for !== a.goals_for) return b.goals_for - a.goals_for;
                    return a.team_name.localeCompare(b.team_name);
                });

                // Add position and format for compatibility
                standings = sortedTeams.map((team, index) => ({
                    id: `${team.team_id}_${seasonId}_${tournamentId}`,
                    team_id: team.team_id,
                    position: index + 1,
                    points: team.points,
                    wins: team.wins,
                    draws: team.draws,
                    losses: team.losses,
                    goals_for: team.goals_for,
                    goals_against: team.goals_against,
                    goal_difference: team.goal_difference
                }));
        }

        // Enrich standings with budget data from Firebase and calculate rewards
        const enrichedStandings = await Promise.all(
            standings.map(async (team: any) => {
                // Get team_season data from Firebase using Admin SDK
                const teamSeasonRef = adminDb.collection('team_seasons').doc(`${team.team_id}_${seasonId}`);
                const teamSeasonDoc = await teamSeasonRef.get();

                let teamName = 'Unknown Team';
                let footballBudget = 0;
                let realPlayerBudget = 0;

                if (teamSeasonDoc.exists) {
                    const data = teamSeasonDoc.data();
                    teamName = data?.team_name || 'Unknown Team';
                    footballBudget = data?.football_budget || 0;
                    realPlayerBudget = data?.real_player_budget || 0;
                }

                // Calculate potential rewards based on position
                let positionReward = { ecoin: 0, sscoin: 0 };
                if (tournament.rewards?.league_positions) {
                    const reward = tournament.rewards.league_positions.find(
                        (r: any) => r.position === team.position
                    );
                    if (reward) {
                        positionReward = {
                            ecoin: reward.ecoin || 0,
                            sscoin: reward.sscoin || 0
                        };
                    }
                }

                // Calculate completion bonus
                let completionReward = { ecoin: 0, sscoin: 0 };
                if (tournament.rewards?.completion_bonus) {
                    completionReward = {
                        ecoin: tournament.rewards.completion_bonus.ecoin || 0,
                        sscoin: tournament.rewards.completion_bonus.sscoin || 0
                    };
                }

                // Calculate knockout rewards based on fixture results
                let knockoutReward = { ecoin: 0, sscoin: 0 };
                if (tournament.rewards?.knockout_stages) {
                    // Check if team participated in knockout stage matches
                    // Knockout fixtures have "_ko_" in their ID
                    const knockoutFixtures = await sql`
                        SELECT 
                            f.id,
                            f.knockout_round,
                            f.home_team_id,
                            f.away_team_id,
                            f.home_score,
                            f.away_score
                        FROM fixtures f
                        WHERE f.tournament_id = ${tournamentId}
                            AND f.season_id = ${seasonId}
                            AND f.id LIKE '%_ko_%'
                            AND f.status = 'completed'
                            AND (f.home_team_id = ${team.team_id} OR f.away_team_id = ${team.team_id})
                        ORDER BY f.scheduled_date DESC
                    `;

                    // Determine highest knockout achievement
                    let highestAchievement = null;
                    
                    for (const fixture of knockoutFixtures) {
                        const isHomeTeam = fixture.home_team_id === team.team_id;
                        const teamScore = isHomeTeam ? fixture.home_score : fixture.away_score;
                        const opponentScore = isHomeTeam ? fixture.away_score : fixture.home_score;
                        
                        // Check if team won this match
                        if (teamScore > opponentScore) {
                            const round = fixture.knockout_round.toLowerCase();
                            
                            // Map round to reward key
                            if (round.includes('final') && !round.includes('semi')) {
                                highestAchievement = 'winner';
                                break; // Winner is highest, no need to check further
                            } else if (round.includes('semi')) {
                                if (!highestAchievement) highestAchievement = 'runner_up';
                            } else if (round.includes('quarter')) {
                                if (!highestAchievement) highestAchievement = 'semi_final_loser';
                            } else if (round.includes('16')) {
                                if (!highestAchievement) highestAchievement = 'quarter_final_loser';
                            } else if (round.includes('32')) {
                                if (!highestAchievement) highestAchievement = 'round_of_16_loser';
                            }
                        } else if (teamScore < opponentScore) {
                            // Team lost - determine at which stage
                            const round = fixture.knockout_round.toLowerCase();
                            
                            if (round.includes('final') && !round.includes('semi')) {
                                if (!highestAchievement || highestAchievement === 'winner') {
                                    highestAchievement = 'runner_up';
                                }
                            } else if (round.includes('semi')) {
                                if (!highestAchievement) highestAchievement = 'semi_final_loser';
                            } else if (round.includes('quarter')) {
                                if (!highestAchievement) highestAchievement = 'quarter_final_loser';
                            } else if (round.includes('16')) {
                                if (!highestAchievement) highestAchievement = 'round_of_16_loser';
                            } else if (round.includes('32')) {
                                if (!highestAchievement) highestAchievement = 'round_of_32_loser';
                            }
                        }
                    }

                    // Apply reward if achievement found
                    if (highestAchievement && tournament.rewards.knockout_stages[highestAchievement]) {
                        knockoutReward = {
                            ecoin: tournament.rewards.knockout_stages[highestAchievement].ecoin || 0,
                            sscoin: tournament.rewards.knockout_stages[highestAchievement].sscoin || 0
                        };
                    }
                }

                return {
                    ...team,
                    team_name: teamName,
                    football_budget: footballBudget,
                    real_player_budget: realPlayerBudget,
                    position_reward: positionReward,
                    knockout_reward: knockoutReward,
                    completion_reward: completionReward
                };
            })
        );

        return NextResponse.json({
            success: true,
            standings: enrichedStandings
        });

    } catch (error: any) {
        console.error('Error fetching standings with budgets:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Failed to fetch standings' },
            { status: 500 }
        );
    }
}
