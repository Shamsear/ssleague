import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

/**
 * GET /api/teams/[id]/football-players
 * Fetch all football players for a specific team
 * 
 * Query params:
 * - season_id (optional): Filter by season
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: teamId } = await params;
        const { searchParams } = new URL(request.url);
        const seasonId = searchParams.get('season_id') || searchParams.get('seasonId'); // Support both for backward compatibility

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
            // Fetch players for specific season from footballplayers table
            // Filter by contract dates: players whose contract includes this season
            players = await sql`
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
          season_id,
          contract_start_season,
          contract_end_season,
          status
        FROM footballplayers
        WHERE team_id = ${teamId}
          AND (
            (contract_start_season <= ${seasonId} AND contract_end_season >= ${seasonId})
            OR season_id = ${seasonId}
          )
          AND status != 'released'
        ORDER BY overall_rating DESC, name ASC
      `;
        } else {
            // Fetch all current players for the team (latest season)
            players = await sql`
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
          season_id,
          contract_start_season,
          contract_end_season,
          status
        FROM footballplayers
        WHERE team_id = ${teamId}
          AND status != 'released'
        ORDER BY overall_rating DESC, name ASC
      `;
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
                source: 'footballplayers_table',
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
