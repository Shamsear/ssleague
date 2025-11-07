import { NextRequest, NextResponse } from 'next/server';
import { releasePlayerNeon, NeonPlayerData, PlayerType } from '@/lib/player-transfers-neon';
import { getTournamentDb } from '@/lib/neon/tournament-config';
import { getAuctionDb } from '@/lib/neon/auction-config';
import { sendNotification } from '@/lib/notifications/send-notification';

/**
 * POST /api/players/release
 * Release a player to free agent with refund to team
 * 
 * Body:
 * {
 *   player_id: string,
 *   season_id: string,
 *   player_type: 'real' | 'football',
 *   released_by: string,
 *   released_by_name: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { player_id, season_id, player_type = 'real', released_by, released_by_name } = body;

    // Validate required fields
    if (!player_id || !season_id || !released_by || !released_by_name) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required fields: player_id, season_id, released_by, released_by_name' 
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

    // Get appropriate database
    const sql = player_type === 'real' ? getTournamentDb() : getAuctionDb();
    
    // Fetch player data from Neon
    let playerData;
    
    if (player_type === 'real') {
      const compositeId = `${player_id}_${season_id}`;
      const result = await sql`
        SELECT * FROM player_seasons
        WHERE id = ${compositeId}
        LIMIT 1
      `;
      
      if (result.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Player not found' },
          { status: 404 }
        );
      }
      
      playerData = result[0];
    } else {
      const result = await sql`
        SELECT * FROM footballplayers
        WHERE player_id = ${player_id} AND season_id = ${season_id}
        LIMIT 1
      `;
      
      if (result.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Player not found' },
          { status: 404 }
        );
      }
      
      playerData = result[0];
    }

    // Check if player is already a free agent
    if (playerData.status === 'free_agent' || !playerData.team_id) {
      return NextResponse.json(
        { success: false, error: 'Player is already a free agent' },
        { status: 400 }
      );
    }

    // Prepare player data for transfer function
    const playerInfo: NeonPlayerData = {
      id: playerData.id || `${player_id}_${season_id}`,
      player_id: playerData.player_id || player_id,
      player_name: playerData.player_name || playerData.name || 'Unknown Player',
      team_id: playerData.team_id,
      team: playerData.team || playerData.team_name,
      // Handle field name mapping: footballplayers uses acquisition_value, player_seasons uses auction_value
      auction_value: playerData.auction_value || playerData.acquisition_value || 0,
      star_rating: playerData.star_rating || playerData.overall_rating,
      salary_per_match: playerData.salary_per_match,
      contract_start_season: playerData.contract_start_season || season_id,
      contract_end_season: playerData.contract_end_season || season_id,
      season_id: season_id,
      status: playerData.status,
      type: player_type as PlayerType
    };

    // Execute release
    const result = await releasePlayerNeon(
      playerInfo,
      season_id,
      released_by,
      released_by_name
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || result.message },
        { status: 500 }
      );
    }

    // Send FCM notification to the team
    try {
      const currencySymbol = player_type === 'football' ? '€' : '$';
      await sendNotification(
        {
          title: '👋 Player Released',
          body: `${playerInfo.player_name} has been released. Refund: ${currencySymbol}${result.refund_amount}`,
          url: `/dashboard/team`,
          icon: '/logo.png',
          data: {
            type: 'player_released',
            player_id,
            player_name: playerInfo.player_name,
            refund_amount: result.refund_amount?.toString() || '0',
            player_type,
          }
        },
        playerInfo.team_id
      );
    } catch (notifError) {
      console.error('Failed to send release notification:', notifError);
      // Don't fail the request
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      refund_amount: result.refund_amount,
      player_name: playerInfo.player_name,
      previous_team_id: playerInfo.team_id,
      player_type: player_type
    });
  } catch (error: any) {
    console.error('Error in release API:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to release player' },
      { status: 500 }
    );
  }
}
