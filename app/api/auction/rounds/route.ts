/**
 * Auction Rounds API - Auction Database
 * GET: Fetch auction rounds
 * POST: Create new auction round
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuctionDb } from '@/lib/neon/auction-config';

export async function GET(request: NextRequest) {
  try {
    const sql = getAuctionDb();
    const { searchParams } = new URL(request.url);
    
    const seasonId = searchParams.get('seasonId');
    const status = searchParams.get('status');
    
    let rounds;
    
    if (seasonId && status) {
      rounds = await sql`
        SELECT * FROM rounds 
        WHERE season_id = ${seasonId} AND status = ${status}
        ORDER BY created_at DESC
      `;
    } else if (seasonId) {
      rounds = await sql`
        SELECT * FROM rounds 
        WHERE season_id = ${seasonId}
        ORDER BY created_at DESC
      `;
    } else if (status) {
      rounds = await sql`
        SELECT * FROM rounds 
        WHERE status = ${status}
        ORDER BY created_at DESC
      `;
    } else {
      rounds = await sql`
        SELECT * FROM rounds 
        ORDER BY created_at DESC
      `;
    }
    
    return NextResponse.json({
      success: true,
      data: rounds,
      count: rounds.length
    });
    
  } catch (error: any) {
    console.error('Error fetching rounds:', error);
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
      season_id,
      position,
      position_group,
      round_number,
      round_type = 'normal',
      max_bids_per_team = 5,
      base_price = 10,
      duration_seconds = 300,
      start_time,
      end_time,
      status = 'active'
    } = body;
    
    if (!season_id) {
      return NextResponse.json(
        { success: false, error: 'season_id is required' },
        { status: 400 }
      );
    }
    
    const result = await sql`
      INSERT INTO rounds (
        season_id, position, position_group, round_number, round_type,
        max_bids_per_team, base_price, duration_seconds, start_time, end_time, status
      )
      VALUES (
        ${season_id}, ${position}, ${position_group}, ${round_number}, ${round_type},
        ${max_bids_per_team}, ${base_price}, ${duration_seconds}, 
        ${start_time ? new Date(start_time) : null}, 
        ${end_time ? new Date(end_time) : null}, 
        ${status}
      )
      RETURNING *
    `;
    
    return NextResponse.json({
      success: true,
      data: result[0]
    });
    
  } catch (error: any) {
    console.error('Error creating round:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
