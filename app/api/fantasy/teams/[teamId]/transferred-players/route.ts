import { NextRequest, NextResponse } from 'next/server';
import { fantasySql } from '@/lib/neon/fantasy-config';

/**
 * GET /api/fantasy/teams/[teamId]/transferred-players
 * Get all players that were transferred out from this team with their points earned while on the team
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { teamId: string } }
) {
  try {
    const teamId = params.teamId;

    if (!teamId) {
      return NextResponse.json(
        { error: 'Missing team_id parameter' },
        { status: 400 }
      );
    }

    // Get all transfers where a player was transferred out
    const transfers = await fantasySql`
      SELECT 
        ft.transfer_id,
        ft.player_out_id,
        ft.player_out_name,
        ft.transferred_at,
        ft.window_id
      FROM fantasy_transfers ft
      WHERE ft.team_id = ${teamId}
        AND ft.player_out_id IS NOT NULL
      ORDER BY ft.transferred_at DESC
    `;

    // For each transferred player, get their total points earned while on this team
    const transferredPlayers = await Promise.all(
      transfers.map(async (transfer: any) => {
        // Get total points earned by this player for this team
        const pointsData = await fantasySql`
          SELECT 
            SUM(fpp.total_points) as total_points,
            COUNT(fpp.id) as matches_played,
            SUM(fpp.goals_scored) as total_goals,
            SUM(CASE WHEN fpp.clean_sheet THEN 1 ELSE 0 END) as clean_sheets,
            SUM(CASE WHEN fpp.motm THEN 1 ELSE 0 END) as motm_count
          FROM fantasy_player_points fpp
          WHERE fpp.team_id = ${teamId}
            AND fpp.real_player_id = ${transfer.player_out_id}
        `;

        const stats = pointsData[0] || {};

        return {
          player_id: transfer.player_out_id,
          player_name: transfer.player_out_name,
          transferred_at: transfer.transferred_at,
          window_id: transfer.window_id,
          total_points: Number(stats.total_points || 0),
          matches_played: Number(stats.matches_played || 0),
          total_goals: Number(stats.total_goals || 0),
          clean_sheets: Number(stats.clean_sheets || 0),
          motm_count: Number(stats.motm_count || 0),
          average_points: stats.matches_played > 0 
            ? Math.round((Number(stats.total_points || 0) / Number(stats.matches_played)) * 10) / 10
            : 0,
        };
      })
    );

    return NextResponse.json({
      success: true,
      transferred_players: transferredPlayers,
    });
  } catch (error) {
    console.error('Error fetching transferred players:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transferred players', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
