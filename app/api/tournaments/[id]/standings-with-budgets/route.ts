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

        // Get standings from tournament DB
        const standings = await sql`
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

                return {
                    ...team,
                    team_name: teamName,
                    football_budget: footballBudget,
                    real_player_budget: realPlayerBudget,
                    position_reward: positionReward,
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
