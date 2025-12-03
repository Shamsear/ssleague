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

    // Fetch player
    const playerQuery = `
      SELECT 
        player_id,
        ${nameField} as player_name,
        team_id,
        auction_value
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

    // Release player - set team_id to null or 'free_agent'
    const updateQuery = `
      UPDATE ${tableName}
      SET team_id = NULL, updated_at = NOW()
      WHERE player_id = $1 AND season_id = $2
    `;
    
    await sql.query(updateQuery, [player_id, season_id]);

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
