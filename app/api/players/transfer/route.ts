import { NextRequest, NextResponse } from 'next/server';
import { transferPlayerNeon, NeonPlayerData, PlayerType } from '@/lib/player-transfers-neon';
import { getTournamentDb } from '@/lib/neon/tournament-config';
import { getAuctionDb } from '@/lib/neon/auction-config';
import { sendNotification } from '@/lib/notifications/send-notification';

/**
 * POST /api/players/transfer
 * Transfer a player from one team to another
 * 
 * Body:
 * {
 *   player_id: string,
 *   new_team_id: string,
 *   new_team_name: string,
 *   new_contract_value: number,
 *   new_contract_duration: number (0.5, 1, 1.5, 2 seasons),
 *   season_id: string,
 *   player_type: 'real' | 'football',
 *   transferred_by: string,
 *   transferred_by_name: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      player_id, 
      new_team_id,
      new_team_name,
      new_contract_value,
      new_contract_duration = 2,
      season_id,
      player_type = 'real',
      transferred_by, 
      transferred_by_name 
    } = body;

    // Validate contract duration
    const validDurations = [0.5, 1, 1.5, 2];
    if (!validDurations.includes(new_contract_duration)) {
      return NextResponse.json(
        { success: false, error: 'Invalid contract duration. Must be 0.5, 1, 1.5, or 2 seasons' },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!player_id || !new_team_id || !new_team_name || !new_contract_value || !season_id || !transferred_by || !transferred_by_name) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required fields' 
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

    // Check if player is free agent or has no team
    if (playerData.status === 'free_agent' || !playerData.team_id) {
      return NextResponse.json(
        { success: false, error: 'Player is a free agent. Assign them to a team first.' },
        { status: 400 }
      );
    }

    // Check if new team is same as current team
    if (playerData.team_id === new_team_id) {
      return NextResponse.json(
        { success: false, error: 'Player is already in this team' },
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

    // Execute transfer
    const result = await transferPlayerNeon(
      playerInfo,
      new_team_id,
      new_team_name,
      new_contract_value,
      new_contract_duration,
      season_id,
      transferred_by,
      transferred_by_name
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || result.message },
        { status: 500 }
      );
    }

    // Send FCM notifications to both teams
    const currencySymbol = player_type === 'football' ? '€' : '$';
    
    // Notify old team (losing player)
    try {
      await sendNotification(
        {
          title: '🔄 Player Transferred Out',
          body: `${playerInfo.player_name} has been transferred to ${new_team_name} for ${currencySymbol}${new_contract_value}`,
          url: `/dashboard/team`,
          icon: '/logo.png',
          data: {
            type: 'player_transfer_out',
            player_id,
            player_name: playerInfo.player_name,
            new_team_id,
            new_team_name,
            player_type,
          }
        },
        playerInfo.team_id
      );
    } catch (notifError) {
      console.error('Failed to send transfer out notification:', notifError);
    }
    
    // Notify new team (receiving player)
    try {
      await sendNotification(
        {
          title: '⭐ Player Transferred In',
          body: `${playerInfo.player_name} has joined your team! Contract: ${currencySymbol}${new_contract_value} (${new_contract_duration} seasons)`,
          url: `/dashboard/team`,
          icon: '/logo.png',
          data: {
            type: 'player_transfer_in',
            player_id,
            player_name: playerInfo.player_name,
            contract_value: new_contract_value.toString(),
            contract_duration: new_contract_duration.toString(),
            player_type,
          }
        },
        new_team_id
      );
    } catch (notifError) {
      console.error('Failed to send transfer in notification:', notifError);
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      old_team_id: playerInfo.team_id,
      new_team_id: new_team_id,
      old_team_refund: result.compensation,
      new_team_cost: result.new_contract_value,
      new_contract_duration: new_contract_duration,
      player_name: playerInfo.player_name,
      player_type: player_type
    });
  } catch (error: any) {
    console.error('Error in transfer API:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to transfer player' },
      { status: 500 }
    );
  }
}
