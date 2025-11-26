import { NextRequest, NextResponse } from 'next/server';
import { executeSwapV2, SwapRequest, PlayerType } from '@/lib/player-transfers-v2';
import { calculateSwapDetails } from '@/lib/player-transfers-v2-utils';
import { getTournamentDb } from '@/lib/neon/tournament-config';
import { getAuctionDb } from '@/lib/neon/auction-config';

/**
 * POST /api/players/swap-v2
 * Execute a player swap with fixed committee fees and star upgrades
 * 
 * This endpoint implements the enhanced swap system with:
 * - Transfer limit enforcement (2 per team per season)
 * - Star-based value increases for both players
 * - Fixed committee fees based on star ratings
 * - Optional cash additions (max 30% of player value)
 * - Automatic star rating upgrades
 * - Salary recalculation
 * 
 * Body:
 * {
 *   player_a_id: string,
 *   player_a_type: 'real' | 'football',
 *   player_b_id: string,
 *   player_b_type: 'real' | 'football',
 *   cash_amount?: number,
 *   cash_direction?: 'A_to_B' | 'B_to_A' | 'none',
 *   season_id: string,
 *   swapped_by: string,
 *   swapped_by_name: string,
 *   preview_only?: boolean  // If true, only return calculation without executing
 * }
 * 
 * Requirements: 3.1-3.8, 11.3, 11.4, 11.5, 11.6
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      player_a_id, 
      player_a_type = 'real',
      player_b_id,
      player_b_type = 'real',
      cash_amount = 0,
      cash_direction = 'none',
      season_id,
      swapped_by, 
      swapped_by_name,
      preview_only = false
    } = body;

    // Validate required fields
    if (!player_a_id || !player_b_id || !season_id || !swapped_by || !swapped_by_name) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required fields: player_a_id, player_b_id, season_id, swapped_by, swapped_by_name',
          errorCode: 'MISSING_FIELDS'
        },
        { status: 400 }
      );
    }

    // Validate player types
    if ((player_a_type !== 'real' && player_a_type !== 'football') ||
        (player_b_type !== 'real' && player_b_type !== 'football')) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid player_type. Must be "real" or "football"',
          errorCode: 'INVALID_PLAYER_TYPE'
        },
        { status: 400 }
      );
    }

    // Validate cash direction
    if (!['A_to_B', 'B_to_A', 'none'].includes(cash_direction)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid cash_direction. Must be "A_to_B", "B_to_A", or "none"',
          errorCode: 'INVALID_CASH_DIRECTION'
        },
        { status: 400 }
      );
    }

    // Validate cash amount
    if (cash_amount < 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Cash amount must be non-negative',
          errorCode: 'INVALID_CASH_AMOUNT'
        },
        { status: 400 }
      );
    }

    // Check if trying to swap same player
    if (player_a_id === player_b_id) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Cannot swap a player with themselves',
          errorCode: 'SAME_PLAYER'
        },
        { status: 400 }
      );
    }

    // If preview_only, fetch both players and return calculation
    if (preview_only) {
      try {
        // Fetch Player A
        const sqlA = player_a_type === 'real' ? getTournamentDb() : getAuctionDb();
        let queryA: string;
        let resultA: any[];
        
        if (player_a_type === 'real') {
          queryA = `
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
          resultA = await sqlA(queryA, [player_a_id, season_id]);
        } else {
          queryA = `
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
          resultA = await sqlA(queryA, [player_a_id, season_id]);
        }
        
        if (resultA.length === 0) {
          return NextResponse.json(
            { 
              success: false, 
              error: 'Player A not found',
              errorCode: 'PLAYER_NOT_FOUND'
            },
            { status: 404 }
          );
        }
        
        // Fetch Player B
        const sqlB = player_b_type === 'real' ? getTournamentDb() : getAuctionDb();
        let queryB: string;
        let resultB: any[];
        
        if (player_b_type === 'real') {
          queryB = `
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
          resultB = await sqlB(queryB, [player_b_id, season_id]);
        } else {
          queryB = `
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
          resultB = await sqlB(queryB, [player_b_id, season_id]);
        }
        
        if (resultB.length === 0) {
          return NextResponse.json(
            { 
              success: false, 
              error: 'Player B not found',
              errorCode: 'PLAYER_NOT_FOUND'
            },
            { status: 404 }
          );
        }
        
        const playerAData = resultA[0];
        const playerBData = resultB[0];
        
        // Check if players are from the same team
        if (playerAData.team_id === playerBData.team_id) {
          return NextResponse.json(
            { 
              success: false, 
              error: 'Cannot swap players from the same team',
              errorCode: 'SAME_TEAM'
            },
            { status: 400 }
          );
        }
        
        // Calculate swap details
        const calculation = calculateSwapDetails(
          {
            value: parseFloat(playerAData.auction_value),
            starRating: parseInt(playerAData.star_rating) || 5,
            points: parseInt(playerAData.points) || 180,
            type: player_a_type
          },
          {
            value: parseFloat(playerBData.auction_value),
            starRating: parseInt(playerBData.star_rating) || 5,
            points: parseInt(playerBData.points) || 180,
            type: player_b_type
          },
          cash_amount,
          cash_direction
        );
        
        return NextResponse.json({
          success: true,
          preview: true,
          calculation,
          playerA: {
            id: playerAData.player_id,
            name: playerAData.player_name,
            team_id: playerAData.team_id,
            current_value: parseFloat(playerAData.auction_value),
            current_star_rating: parseInt(playerAData.star_rating) || 5
          },
          playerB: {
            id: playerBData.player_id,
            name: playerBData.player_name,
            team_id: playerBData.team_id,
            current_value: parseFloat(playerBData.auction_value),
            current_star_rating: parseInt(playerBData.star_rating) || 5
          }
        });
        
      } catch (error: any) {
        console.error('Error in swap preview:', error);
        return NextResponse.json(
          { 
            success: false, 
            error: error.message || 'Failed to calculate swap preview',
            errorCode: 'PREVIEW_ERROR'
          },
          { status: 500 }
        );
      }
    }

    // Execute the swap
    const swapRequest: SwapRequest = {
      playerAId: player_a_id,
      playerAType: player_a_type as PlayerType,
      playerBId: player_b_id,
      playerBType: player_b_type as PlayerType,
      cashAmount: cash_amount,
      cashDirection: cash_direction,
      seasonId: season_id,
      swappedBy: swapped_by,
      swappedByName: swapped_by_name
    };

    const result = await executeSwapV2(swapRequest);

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
    console.error('Error in swap-v2 API:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to swap players',
        errorCode: 'SYSTEM_ERROR'
      },
      { status: 500 }
    );
  }
}
