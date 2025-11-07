/**
 * Bids API - Auction Database
 * GET: Fetch bids
 * POST: Place a bid
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuctionDb } from '@/lib/neon/auction-config';
import { broadcastAuctionBid } from '@/lib/realtime/broadcast';

export async function GET(request: NextRequest) {
  try {
    const sql = getAuctionDb();
    const { searchParams } = new URL(request.url);
    
    const roundId = searchParams.get('roundId');
    const teamId = searchParams.get('teamId');
    const playerId = searchParams.get('playerId');
    const status = searchParams.get('status');
    
    let bids;
    
    if (roundId) {
      bids = await sql`
        SELECT * FROM bids 
        WHERE round_id = ${roundId}
        ORDER BY created_at DESC
      `;
    } else if (teamId) {
      bids = await sql`
        SELECT * FROM bids 
        WHERE team_id = ${teamId}
        ORDER BY created_at DESC
      `;
    } else if (playerId) {
      bids = await sql`
        SELECT * FROM bids 
        WHERE player_id = ${playerId}
        ORDER BY amount DESC
      `;
    } else {
      bids = await sql`
        SELECT * FROM bids 
        ORDER BY created_at DESC
        LIMIT 100
      `;
    }
    
    return NextResponse.json({
      success: true,
      data: bids,
      count: bids.length
    });
    
  } catch (error: any) {
    console.error('Error fetching bids:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const sql = getAuctionDb();
    const body = await request.json();
    
    const {
      team_id,
      player_id,
      round_id,
      amount,
      status = 'active',
      phase,
      encrypted_bid_data
    } = body;
    
    // Validate required fields
    // Note: amount is optional here if encrypted_bid_data is provided (for blind bidding)
    if (!team_id || !player_id || !round_id) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: team_id, player_id, round_id' },
        { status: 400 }
      );
    }
    
    // For blind bidding, store amount as NULL and only use encrypted_bid_data
    // Amount will be populated after round finalization
    const bidAmount = encrypted_bid_data ? null : amount;
    
    const result = await sql`
      INSERT INTO bids (team_id, player_id, round_id, amount, status, phase, encrypted_bid_data)
      VALUES (${team_id}, ${player_id}, ${round_id}, ${bidAmount}, ${status}, ${phase}, ${encrypted_bid_data})
      RETURNING *
    `;
    
    const newBid = result[0];
    
    // ✅ Broadcast to Firebase Realtime DB for real-time updates
    // Get season_id from the round
    const seasonResult = await sql`SELECT season_id FROM rounds WHERE id = ${round_id}`;
    const seasonId = seasonResult[0]?.season_id;
    
    if (seasonId) {
      await broadcastAuctionBid(seasonId, round_id, {
        player_id,
        team_id,
        amount,
      });
    }
    
    return NextResponse.json({
      success: true,
      data: newBid
    });
    
  } catch (error: any) {
    console.error('Error placing bid:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
