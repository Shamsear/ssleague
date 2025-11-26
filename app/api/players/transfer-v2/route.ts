import { NextRequest, NextResponse } from 'next/server';
import { executeTransferV2, TransferRequest, PlayerType } from '@/lib/player-transfers-v2';
import { calculateTransferDetails } from '@/lib/player-transfers-v2-utils';
import { getTournamentDb } from '@/lib/neon/tournament-config';
import { getAuctionDb } from '@/lib/neon/auction-config';

/**
 * POST /api/players/transfer-v2
 * Execute a player transfer with committee fees and star upgrades
 * 
 * This endpoint implements the enhanced transfer system with:
 * - Transfer limit enforcement (2 per team per season)
 * - Star-based value increases
 * - 10% committee fees
 * - Automatic star rating upgrades
 * - Salary recalculation
 * 
 * Body:
 * {
 *   player_id: string,
 *   player_type: 'real' | 'football',
 *   new_team_id: string,
 *   season_id: string,
 *   transferred_by: string,
 *   transferred_by_name: string,
 *   preview_only?: boolean  // If true, only return calculation without executing
 * }
 * 
 * Requirements: 2.1-2.7, 11.1, 11.2, 11.5, 11.6
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      player_id, 
      player_type = 'real',
      new_team_id,
      season_id,
      transferred_by, 
      transferred_by_name,
      preview_only = false
    } = body;

    // Validate required fields
    if (!player_id || !new_team_id || !season_id || !transferred_by || !transferred_by_name) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required fields: player_id, new_team_id, season_id, transferred_by, transferred_by_name',
          errorCode: 'MISSING_FIELDS'
        },
        { status: 400 }
      );
    }

    // Validate player type
    if (player_type !== 'real' && player_type !== 'football') {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid player_type. Must be "real" or "football"',
          errorCode: 'INVALID_PLAYER_TYPE'
        },
        { status: 400 }
      );
    }

    // If preview_only, fetch player data and return calculation
    if (preview_only) {
      try {
        const sql = player_type === 'real' ? getTournamentDb() : getAuctionDb();
        const tableName = player_type === 'real' ? 'player_seasons' : 'footballplayers';
        
        let query: string;
        let result: any[];
        
        if (player_type === 'real') {
          query = `
            SELECT 
              ps.player_id,
              ps.player_name,
              ps.team_id,
              ps.auction_value,
              ps.star_rating,
              ps.points,
              ps.salary_per_match
            FROM player_seasons ps
            WHERE ps.player_id = $1 AND ps.season_id = $2
          `;
          result = await sql(query, [player_id, season_id]);
        } else {
          query = `
            SELECT 
              fp.player_id,
              fp.player_name,
              fp.team_id,
              fp.auction_value,
              fp.star_rating,
              fp.points,
              fp.salary_per_match
            FROM footballplayers fp
            WHERE fp.player_id = $1 AND fp.season_id = $2
          `;
          result = await sql(query, [player_id, season_id]);
        }
        
        if (result.length === 0) {
          return NextResponse.json(
            { 
              success: false, 
              error: 'Player not found',
              errorCode: 'PLAYER_NOT_FOUND'
            },
            { status: 404 }
          );
        }
        
        const playerData = result[0];
        
        // Calculate transfer details
        const calculation = calculateTransferDetails(
          parseFloat(playerData.auction_value),
          parseInt(playerData.star_rating) || 5,
          parseInt(playerData.points) || 180,
          player_type
        );
        
        return NextResponse.json({
          success: true,
          preview: true,
          calculation,
          player: {
            id: playerData.player_id,
            name: playerData.player_name,
            current_team_id: playerData.team_id,
            current_value: parseFloat(playerData.auction_value),
            current_star_rating: parseInt(playerData.star_rating) || 5
          }
        });
        
      } catch (error: any) {
        console.error('Error in transfer preview:', error);
        return NextResponse.json(
          { 
            success: false, 
            error: error.message || 'Failed to calculate transfer preview',
            errorCode: 'PREVIEW_ERROR'
          },
          { status: 500 }
        );
      }
    }

    // Execute the transfer
    const transferRequest: TransferRequest = {
      playerId: player_id,
      playerType: player_type as PlayerType,
      newTeamId: new_team_id,
      seasonId: season_id,
      transferredBy: transferred_by,
      transferredByName: transferred_by_name
    };

    const result = await executeTransferV2(transferRequest);

    if (!result.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: result.error || result.message,
          errorCode: result.errorCode,
          calculation: result.calculation
        },
        { status: result.errorCode === 'PLAYER_NOT_FOUND' ? 404 : 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      calculation: result.calculation,
      transactionId: result.transactionId
    });

  } catch (error: any) {
    console.error('Error in transfer-v2 API:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to transfer player',
        errorCode: 'SYSTEM_ERROR'
      },
      { status: 500 }
    );
  }
}
