import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const sql = getTournamentDb();
        const { id: tournamentId } = await params;

        // Get all rewards distributed for this tournament
        const distributedRewards = await sql`
      SELECT 
        reward_type,
        COUNT(*) as teams_count,
        SUM(ecoin_amount) as total_ecoin,
        SUM(sscoin_amount) as total_sscoin,
        MIN(distributed_at) as first_distributed,
        MAX(distributed_at) as last_distributed,
        distributed_by
      FROM tournament_rewards_distributed
      WHERE tournament_id = ${tournamentId}
      GROUP BY reward_type, distributed_by
      ORDER BY first_distributed DESC
    `;

        // Get tournament details
        const [tournament] = await sql`
      SELECT * FROM tournaments WHERE id = ${tournamentId} LIMIT 1
    `;

        if (!tournament) {
            return NextResponse.json(
                { success: false, error: 'Tournament not found' },
                { status: 404 }
            );
        }

        // Build status object
        const status = {
            position_rewards: {
                distributed: false,
                date: null,
                teams_count: 0,
                total_ecoin: 0,
                total_sscoin: 0,
                distributed_by: null,
            },
            knockout_rewards: {
                distributed: false,
                date: null,
                teams_count: 0,
                total_ecoin: 0,
                total_sscoin: 0,
                distributed_by: null,
            },
            completion_bonus: {
                distributed: false,
                date: null,
                teams_count: 0,
                total_ecoin: 0,
                total_sscoin: 0,
                distributed_by: null,
            },
        };

        // Populate status from distributed rewards
        distributedRewards.forEach((reward: any) => {
            const key = reward.reward_type === 'position' ? 'position_rewards' :
                reward.reward_type === 'knockout' ? 'knockout_rewards' :
                    'completion_bonus';

            status[key] = {
                distributed: true,
                date: reward.first_distributed,
                teams_count: parseInt(reward.teams_count),
                total_ecoin: parseInt(reward.total_ecoin) || 0,
                total_sscoin: parseInt(reward.total_sscoin) || 0,
                distributed_by: reward.distributed_by,
            };
        });

        // Get per-team reward details
        const teamRewards = await sql`
      SELECT 
        team_id,
        reward_type,
        reward_details,
        ecoin_amount,
        sscoin_amount,
        distributed_at
      FROM tournament_rewards_distributed
      WHERE tournament_id = ${tournamentId}
      ORDER BY team_id, reward_type
    `;

        return NextResponse.json({
            success: true,
            status,
            team_rewards: teamRewards,
            tournament_name: tournament.tournament_name,
        });

    } catch (error: any) {
        console.error('Error fetching rewards status:', error);
        return NextResponse.json(
            { success: false, error: error.message || 'Failed to fetch rewards status' },
            { status: 500 }
        );
    }
}
