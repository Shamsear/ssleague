import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

/**
 * GET /api/teams/[id]/football-players
 * Fetch all football players for a specific team
 * 
 * Query params:
 * - seasonId (optional): Filter by season
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: teamId } = await params;
        const { searchParams } = new URL(request.url);
        const seasonId = searchParams.get('seasonId');

        // First, verify team exists
        const teamCheck = await sql`
      SELECT id, name, season_id, football_budget, football_spent, football_players_count
      FROM teams
      WHERE id = ${teamId}
      LIMIT 1
    `;

        if (teamCheck.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    error: `Team ${teamId} not found`,
                    message: 'Team does not exist in the database'
                },
                { status: 404 }
            );
        }

        const team = teamCheck[0];

        // Build query based on whether seasonId is provided
        let players;

        if (seasonId) {
            // Fetch players for specific season from team_players table
            players = await sql`
        SELECT 
          tp.id as team_player_id,
          tp.player_id,
          tp.purchase_price,
          tp.acquired_at,
          tp.round_id,
          tp.season_id,
          fp.name as player_name,
          fp.position,
          fp.position_group,
          fp.team_name as club,
          fp.overall_rating,
          fp.nationality,
          fp.age,
          fp.playing_style,
          fp.speed,
          fp.acceleration,
          fp.ball_control,
          fp.dribbling,
          fp.low_pass,
          fp.lofted_pass,
          fp.finishing,
          fp.heading,
          fp.physical_contact,
          fp.stamina
        FROM team_players tp
        INNER JOIN footballplayers fp ON tp.player_id = fp.id
        WHERE tp.team_id = ${teamId}
          AND tp.season_id = ${seasonId}
        ORDER BY tp.acquired_at DESC
      `;
        } else {
            // Fetch all players for the team (current season from team record)
            players = await sql`
        SELECT 
          tp.id as team_player_id,
          tp.player_id,
          tp.purchase_price,
          tp.acquired_at,
          tp.round_id,
          tp.season_id,
          fp.name as player_name,
          fp.position,
          fp.position_group,
          fp.team_name as club,
          fp.overall_rating,
          fp.nationality,
          fp.age,
          fp.playing_style,
          fp.speed,
          fp.acceleration,
          fp.ball_control,
          fp.dribbling,
          fp.low_pass,
          fp.lofted_pass,
          fp.finishing,
          fp.heading,
          fp.physical_contact,
          fp.stamina
        FROM team_players tp
        INNER JOIN footballplayers fp ON tp.player_id = fp.id
        WHERE tp.team_id = ${teamId}
        ORDER BY tp.acquired_at DESC
      `;
        }

        // If no players found in team_players, check footballplayers table directly (legacy)
        if (players.length === 0) {
            const directPlayers = await sql`
        SELECT 
          id,
          player_id,
          name as player_name,
          position,
          position_group,
          team_id,
          team_name as club,
          overall_rating,
          nationality,
          age,
          playing_style,
          is_sold,
          acquisition_value as purchase_price,
          speed,
          acceleration,
          ball_control,
          dribbling,
          low_pass,
          lofted_pass,
          finishing,
          heading,
          physical_contact,
          stamina,
          season_id
        FROM footballplayers
        WHERE team_id = ${teamId}
        ${seasonId ? sql`AND season_id = ${seasonId}` : sql``}
        ORDER BY name ASC
      `;

            if (directPlayers.length > 0) {
                return NextResponse.json({
                    success: true,
                    data: {
                        team: {
                            id: team.id,
                            name: team.name,
                            season_id: team.season_id,
                            football_budget: team.football_budget,
                            football_spent: team.football_spent,
                            football_players_count: team.football_players_count,
                        },
                        players: directPlayers,
                        source: 'footballplayers_table',
                        count: directPlayers.length,
                    },
                    message: 'Players fetched from footballplayers table (legacy method)'
                });
            }
        }

        // Calculate statistics
        const totalSpent = players.reduce((sum, p) => sum + (p.purchase_price || 0), 0);
        const positionBreakdown = players.reduce((acc, p) => {
            const pos = p.position_group || 'Unknown';
            acc[pos] = (acc[pos] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        return NextResponse.json({
            success: true,
            data: {
                team: {
                    id: team.id,
                    name: team.name,
                    season_id: team.season_id,
                    football_budget: team.football_budget,
                    football_spent: team.football_spent,
                    football_players_count: team.football_players_count,
                },
                players,
                source: 'team_players_table',
                count: players.length,
                statistics: {
                    total_spent: totalSpent,
                    position_breakdown: positionBreakdown,
                },
            },
            message: 'Players fetched successfully'
        });

    } catch (error: any) {
        console.error('Error fetching team football players:', error);
        return NextResponse.json(
            {
                success: false,
                error: error.message || 'Failed to fetch team football players'
            },
            { status: 500 }
        );
    }
}
