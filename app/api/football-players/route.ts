/**
 * Football Players API - Auction Database
 * GET: Fetch football players from auction database
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuctionDb } from '@/lib/neon/auction-config';

export async function GET(request: NextRequest) {
  try {
    const sql = getAuctionDb();
    const { searchParams } = new URL(request.url);
    
    const seasonId = searchParams.get('seasonId');
    const teamId = searchParams.get('teamId');
    const playerId = searchParams.get('playerId');
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 1000;
    
    let players;
    
    // Get specific player
    if (playerId && seasonId) {
      players = await sql`
        SELECT 
          id, player_id, name as player_name, position, position_group,
          team_id, team_name as team, season_id, round_id,
          acquisition_value as auction_value,
          contract_id, contract_start_season, contract_end_season, contract_length,
          status, is_auto_registered,
          overall_rating as star_rating,
          created_at, updated_at
        FROM footballplayers
        WHERE player_id = ${playerId} AND season_id = ${seasonId}
        LIMIT 1
      `;
      return NextResponse.json({
        success: true,
        data: players[0] || null
      });
    }
    
    // Get team players
    if (teamId && seasonId) {
      players = await sql`
        SELECT 
          id, player_id, name as player_name, position, position_group,
          team_id, team_name as team, season_id, round_id,
          acquisition_value as auction_value,
          contract_id, contract_start_season, contract_end_season, contract_length,
          status, is_auto_registered,
          overall_rating as star_rating,
          created_at, updated_at
        FROM footballplayers
        WHERE team_id = ${teamId} AND season_id = ${seasonId}
        ORDER BY name ASC
        LIMIT ${limit}
      `;
    }
    // Get all players for a season
    else if (seasonId) {
      players = await sql`
        SELECT 
          id, player_id, name as player_name, position, position_group,
          team_id, team_name as team, season_id, round_id,
          acquisition_value as auction_value,
          contract_id, contract_start_season, contract_end_season, contract_length,
          status, is_auto_registered,
          overall_rating as star_rating,
          created_at, updated_at
        FROM footballplayers
        WHERE season_id = ${seasonId}
        ORDER BY name ASC
        LIMIT ${limit}
      `;
    }
    // Get all players (no filters)
    else {
      players = await sql`
        SELECT 
          id, player_id, name as player_name, position, position_group,
          team_id, team_name as team, season_id, round_id,
          acquisition_value as auction_value,
          contract_id, contract_start_season, contract_end_season, contract_length,
          status, is_auto_registered,
          overall_rating as star_rating,
          created_at, updated_at
        FROM footballplayers
        ORDER BY name ASC
        LIMIT ${limit}
      `;
    }
    
    return NextResponse.json({
      success: true,
      data: players,
      count: players.length
    });
    
  } catch (error: any) {
    console.error('Error fetching football players:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
