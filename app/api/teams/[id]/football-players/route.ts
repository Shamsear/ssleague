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

        // Try to verify team exists, but don't fail if it doesn't (for historical teams)
        const teamCheck = await sql`
      SELECT id, name, season_id, football_budget, football_spent, football_players_count
      FROM teams
      WHERE id = ${teamId}
      LIMIT 1
    `;

        const team = teamCheck.length > 0 ? teamCheck[0] : {
            id: teamId,
            name: teamId,
            season_id: seasonId || null,
            football_budget: 0,
            football_spent: 0,
            football_players_count: 0
        };

        console.log(`[Football Players API] Team check: ${teamCheck.length > 0 ? 'Found in teams table' : 'Historical team, using defaults'}`);

        // Build query based on whether seasonId is provided
        let players;

        if (seasonId) {
            console.log(`[Football Players API] Fetching for team ${teamId}, season ${seasonId}`);
            
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

            console.log(`[Football Players API] Found ${players.length} players in footballplayers table`);

            // If no players found in footballplayers, try player_history table
            if (players.length === 0) {
                console.log(`[Football Players API] Trying player_history fallback...`);
                
                players = await sql`
          SELECT 
            id,
            player_id,
            player_name,
            position,
            position_group,
            team_id,
            team_name as club,
            overall_rating,
            nationality,
            age,
            playing_style,
            COALESCE(is_sold, true) as is_sold,
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
            defensive_awareness,
            aggression,
            gk_reflexes,
            gk_reach,
            season_id,
            contract_start_season,
            contract_end_season,
            status
          FROM player_history
          WHERE team_id = ${teamId}
            AND season_id = ${seasonId}
          ORDER BY 
            CASE WHEN overall_rating IS NOT NULL THEN overall_rating ELSE 0 END DESC,
            acquisition_value DESC, 
            player_name ASC
        `;
                
                console.log(`[Football Players API] Found ${players.length} players in player_history table`);
            }
        } else {
            console.log(`[Football Players API] Fetching all current players for team ${teamId}`);
            
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
            
            console.log(`[Football Players API] Found ${players.length} current players`);
        }

        // Calculate statistics
        const totalSpent = players.reduce((sum, p) => sum + (p.purchase_price || 0), 0);
        const positionBreakdown = players.reduce((acc, p) => {
            const pos = p.position_group || 'Unknown';
            acc[pos] = (acc[pos] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const dataSource = players.length > 0 && players[0].overall_rating === null ? 'player_history_table' : 'footballplayers_table';
        console.log(`[Football Players API] Returning ${players.length} players from ${dataSource}`);

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
                source: dataSource,
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
