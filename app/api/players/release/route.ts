import { NextRequest, NextResponse } from 'next/server';
import { getAuctionDb } from '@/lib/neon/auction-config';
import { getTournamentDb } from '@/lib/neon/tournament-config';

/**
 * POST /api/players/release
 * Release a player (set team_id to null or 'free_agent')
 * 
 * Body:
 * {
 *   player_id: string,
 *   player_type: 'real' | 'football',
 *   season_id: string,
 *   released_by: string,
 *   released_by_name: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      player_id,
      player_type = 'football',
      season_id,
      released_by,
      released_by_name
    } = body;

    // Validate required fields
    if (!player_id || !season_id || !released_by || !released_by_name) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields',
          errorCode: 'MISSING_FIELDS'
        },
        { status: 400 }
      );
    }

    const sql = player_type === 'real' ? getTournamentDb() : getAuctionDb();
    const tableName = player_type === 'real' ? 'player_seasons' : 'footballplayers';
    const nameField = player_type === 'real' ? 'player_name' : 'name';

    // Fetch player (need to get 'id' for team_players deletion)
    const playerQuery = `
      SELECT 
        id,
        player_id,
        ${nameField} as player_name,
        team_id
      FROM ${tableName}
      WHERE player_id = $1 AND season_id = $2
    `;

    const players = await sql.query(playerQuery, [player_id, season_id]);

    if (players.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Player not found',
          errorCode: 'PLAYER_NOT_FOUND'
        },
        { status: 404 }
      );
    }

    const player = players[0];

    if (!player.team_id || player.team_id === 'free_agent') {
      return NextResponse.json(
        {
          success: false,
          error: 'Player is already a free agent',
          errorCode: 'ALREADY_FREE_AGENT'
        },
        { status: 400 }
      );
    }

    // Release player - reset all team/contract related fields
    // For football players, we need to reset multiple fields to match free agent state
    const updateQuery = player_type === 'football'
      ? `
        UPDATE ${tableName}
        SET 
          team_id = NULL,
          status = 'free_agent',
          is_sold = false,
          acquisition_value = NULL,
          contract_id = NULL,
          contract_start_season = NULL,
          contract_end_season = NULL,
          season_id = NULL,
          round_id = NULL,
          updated_at = NOW()
        WHERE player_id = $1 AND season_id = $2
      `
      : `
        UPDATE ${tableName}
        SET team_id = NULL, updated_at = NOW()
        WHERE player_id = $1 AND season_id = $2
      `;

    await sql.query(updateQuery, [player_id, season_id]);

    // Also remove from team_players table if exists
    // IMPORTANT: team_players.player_id references footballplayers.id (NOT player_id)
    try {
      const deleteTeamPlayerQuery = `
        DELETE FROM team_players
        WHERE player_id = $1 AND season_id = $2
      `;
      // Use player.id (not player.player_id) for team_players deletion
      await sql.query(deleteTeamPlayerQuery, [player.id, season_id]);
      console.log(`Removed player id ${player.id} from team_players table`);
    } catch (teamPlayerError) {
      // Log but don't fail if team_players deletion fails
      console.warn('Could not delete from team_players:', teamPlayerError);
    }

    return NextResponse.json({
      success: true,
      message: `${player.player_name} released successfully`,
      data: {
        player_name: player.player_name,
        old_team: player.team_id,
        new_status: 'free_agent'
      }
    });

  } catch (error: any) {
    console.error('Error in release API:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to release player',
        errorCode: 'SYSTEM_ERROR'
      },
      { status: 500 }
    );
  }
}
