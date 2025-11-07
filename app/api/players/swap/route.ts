import { NextRequest, NextResponse } from 'next/server';
import { swapPlayersNeon, NeonPlayerData, PlayerType } from '@/lib/player-transfers-neon';
import { getTournamentDb } from '@/lib/neon/tournament-config';
import { getAuctionDb } from '@/lib/neon/auction-config';
import { sendNotification } from '@/lib/notifications/send-notification';

/**
 * POST /api/players/swap
 * Swap two players between two teams with optional fee
 * 
 * Body:
 * {
 *   player_a_id: string,
 *   player_b_id: string,
 *   fee_amount: number (positive = Team A pays Team B, negative = Team B pays Team A, 0 = no fee),
 *   season_id: string,
 *   player_type: 'real' | 'football',
 *   swapped_by: string,
 *   swapped_by_name: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      player_a_id, 
      player_b_id, 
      fee_amount,
      season_id,
      player_type = 'real',
      swapped_by, 
      swapped_by_name 
    } = body;

    // Validate required fields
    if (!player_a_id || !player_b_id || fee_amount === undefined || !season_id || !swapped_by || !swapped_by_name) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required fields: player_a_id, player_b_id, fee_amount, season_id, swapped_by, swapped_by_name' 
        },
        { status: 400 }
      );
    }

    // Validate player type
    if (player_type !== 'real' && player_type !== 'football') {
      return NextResponse.json(
        { success: false, error: 'Invalid player_type. Must be "real" or "football"' },
        { status: 400 }
      );
    }

    // Check if trying to swap same player
    if (player_a_id === player_b_id) {
      return NextResponse.json(
        { success: false, error: 'Cannot swap a player with themselves' },
        { status: 400 }
      );
    }

    // Get appropriate database
    const sql = player_type === 'real' ? getTournamentDb() : getAuctionDb();
    
    // Fetch both players from Neon
    let playerAData, playerBData;
    
    if (player_type === 'real') {
      const compositeIdA = `${player_a_id}_${season_id}`;
      const compositeIdB = `${player_b_id}_${season_id}`;
      
      const [resultA, resultB] = await Promise.all([
        sql`SELECT * FROM player_seasons WHERE id = ${compositeIdA} LIMIT 1`,
        sql`SELECT * FROM player_seasons WHERE id = ${compositeIdB} LIMIT 1`
      ]);
      
      if (resultA.length === 0 || resultB.length === 0) {
        return NextResponse.json(
          { success: false, error: 'One or both players not found' },
          { status: 404 }
        );
      }
      
      playerAData = resultA[0];
      playerBData = resultB[0];
    } else {
      const [resultA, resultB] = await Promise.all([
        sql`SELECT * FROM footballplayers WHERE player_id = ${player_a_id} AND season_id = ${season_id} LIMIT 1`,
        sql`SELECT * FROM footballplayers WHERE player_id = ${player_b_id} AND season_id = ${season_id} LIMIT 1`
      ]);
      
      if (resultA.length === 0 || resultB.length === 0) {
        return NextResponse.json(
          { success: false, error: 'One or both players not found' },
          { status: 404 }
        );
      }
      
      playerAData = resultA[0];
      playerBData = resultB[0];
    }

    // Check if players are free agents
    if (playerAData.status === 'free_agent' || !playerAData.team_id) {
      return NextResponse.json(
        { success: false, error: 'Player A is a free agent' },
        { status: 400 }
      );
    }

    if (playerBData.status === 'free_agent' || !playerBData.team_id) {
      return NextResponse.json(
        { success: false, error: 'Player B is a free agent' },
        { status: 400 }
      );
    }

    // Check if players are on the same team
    if (playerAData.team_id === playerBData.team_id) {
      return NextResponse.json(
        { success: false, error: 'Both players are on the same team' },
        { status: 400 }
      );
    }

    // Prepare player data
    const playerAInfo: NeonPlayerData = {
      id: playerAData.id || `${player_a_id}_${season_id}`,
      player_id: playerAData.player_id || player_a_id,
      player_name: playerAData.player_name || playerAData.name || 'Unknown Player A',
      team_id: playerAData.team_id,
      team: playerAData.team || playerAData.team_name,
      // Handle field name mapping: footballplayers uses acquisition_value, player_seasons uses auction_value
      auction_value: playerAData.auction_value || playerAData.acquisition_value || 0,
      star_rating: playerAData.star_rating || playerAData.overall_rating,
      salary_per_match: playerAData.salary_per_match,
      contract_start_season: playerAData.contract_start_season || season_id,
      contract_end_season: playerAData.contract_end_season || season_id,
      season_id: season_id,
      status: playerAData.status,
      type: player_type as PlayerType
    };

    const playerBInfo: NeonPlayerData = {
      id: playerBData.id || `${player_b_id}_${season_id}`,
      player_id: playerBData.player_id || player_b_id,
      player_name: playerBData.player_name || playerBData.name || 'Unknown Player B',
      team_id: playerBData.team_id,
      team: playerBData.team || playerBData.team_name,
      // Handle field name mapping: footballplayers uses acquisition_value, player_seasons uses auction_value
      auction_value: playerBData.auction_value || playerBData.acquisition_value || 0,
      star_rating: playerBData.star_rating || playerBData.overall_rating,
      salary_per_match: playerBData.salary_per_match,
      contract_start_season: playerBData.contract_start_season || season_id,
      contract_end_season: playerBData.contract_end_season || season_id,
      season_id: season_id,
      status: playerBData.status,
      type: player_type as PlayerType
    };

    // Execute swap
    const result = await swapPlayersNeon(
      playerAInfo,
      playerBInfo,
      fee_amount,
      season_id,
      swapped_by,
      swapped_by_name
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || result.message },
        { status: 500 }
      );
    }

    // Send FCM notifications to both teams
    const currencySymbol = player_type === 'football' ? '€' : '$';
    const feeText = fee_amount === 0 ? 'No fee' : 
                    fee_amount > 0 ? `You paid ${currencySymbol}${Math.abs(fee_amount)}` :
                    `You received ${currencySymbol}${Math.abs(fee_amount)}`;
    
    // Notify Team A (swapping Player A for Player B)
    try {
      await sendNotification(
        {
          title: '🔄 Player Swap Complete',
          body: `Swapped ${playerAInfo.player_name} for ${playerBInfo.player_name}. ${feeText}`,
          url: `/dashboard/team`,
          icon: '/logo.png',
          data: {
            type: 'player_swap',
            player_out: playerAInfo.player_name,
            player_in: playerBInfo.player_name,
            fee_amount: fee_amount.toString(),
            player_type,
          }
        },
        playerAInfo.team_id
      );
    } catch (notifError) {
      console.error('Failed to send swap notification to Team A:', notifError);
    }
    
    // Notify Team B (swapping Player B for Player A)
    const feeTextB = fee_amount === 0 ? 'No fee' : 
                     fee_amount > 0 ? `You received ${currencySymbol}${Math.abs(fee_amount)}` :
                     `You paid ${currencySymbol}${Math.abs(fee_amount)}`;
    try {
      await sendNotification(
        {
          title: '🔄 Player Swap Complete',
          body: `Swapped ${playerBInfo.player_name} for ${playerAInfo.player_name}. ${feeTextB}`,
          url: `/dashboard/team`,
          icon: '/logo.png',
          data: {
            type: 'player_swap',
            player_out: playerBInfo.player_name,
            player_in: playerAInfo.player_name,
            fee_amount: (-fee_amount).toString(),
            player_type,
          }
        },
        playerBInfo.team_id
      );
    } catch (notifError) {
      console.error('Failed to send swap notification to Team B:', notifError);
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      player_a: {
        name: playerAInfo.player_name,
        from_team: playerAInfo.team_id,
        to_team: playerBInfo.team_id
      },
      player_b: {
        name: playerBInfo.player_name,
        from_team: playerBInfo.team_id,
        to_team: playerAInfo.team_id
      },
      fee: {
        amount: result.fee_amount,
        paid_to: result.fee_paid_to
      },
      player_type: player_type
    });
  } catch (error: any) {
    console.error('Error in swap API:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to swap players' },
      { status: 500 }
    );
  }
}
