/**
 * Bids API - Auction Database
 * GET: Fetch bids
 * POST: Place a bid
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuctionDb } from '@/lib/neon/auction-config';

// WebSocket broadcast function (set by WebSocket server)
declare global {
  var wsBroadcast: ((channel: string, data: any) => void) | undefined;
}

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
    if (!team_id || !player_id || !round_id || !amount) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: team_id, player_id, round_id, amount' },
        { status: 400 }
      );
    }
    
    const result = await sql`
      INSERT INTO bids (team_id, player_id, round_id, amount, status, phase, encrypted_bid_data)
      VALUES (${team_id}, ${player_id}, ${round_id}, ${amount}, ${status}, ${phase}, ${encrypted_bid_data})
      RETURNING *
    `;
    
    const newBid = result[0];
    
    // ✅ Broadcast to WebSocket clients for real-time updates
    if (global.wsBroadcast) {
      global.wsBroadcast(`round:${round_id}`, {
        type: 'bid',
        data: {
          bid: newBid,
          player_id,
          team_id,
          amount,
        },
      });
      console.log(`📢 [WebSocket] Broadcast bid to round:${round_id}`);
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
