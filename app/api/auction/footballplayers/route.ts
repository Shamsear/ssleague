/**
 * Football Players API - Auction Database
 * GET: Fetch players for auction
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuctionDb } from '@/lib/neon/auction-config';

export async function GET(request: NextRequest) {
  try {
    const sql = getAuctionDb();
    const { searchParams } = new URL(request.url);
    
    const seasonId = searchParams.get('seasonId');
    const isAuctionEligible = searchParams.get('isAuctionEligible');
    const isSold = searchParams.get('isSold');
    const position = searchParams.get('position');
    const positionGroup = searchParams.get('positionGroup');
    
    // Build query dynamically
    let query = 'SELECT * FROM footballplayers WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;
    
    if (seasonId) {
      query += ` AND season_id = $${paramIndex}`;
      params.push(seasonId);
      paramIndex++;
    }
    
    if (isAuctionEligible !== null) {
      query += ` AND is_auction_eligible = $${paramIndex}`;
      params.push(isAuctionEligible === 'true');
      paramIndex++;
    }
    
    if (isSold !== null) {
      query += ` AND is_sold = $${paramIndex}`;
      params.push(isSold === 'true');
      paramIndex++;
    }
    
    if (position) {
      query += ` AND position = $${paramIndex}`;
      params.push(position);
      paramIndex++;
    }
    
    if (positionGroup) {
      query += ` AND position_group = $${paramIndex}`;
      params.push(positionGroup);
      paramIndex++;
    }
    
    query += ' ORDER BY overall_rating DESC, name ASC';
    
    // Execute query with parameters
    const { Pool } = await import('@neondatabase/serverless');
    const pool = new Pool({ connectionString: process.env.NEON_AUCTION_DB_URL });
    
    try {
      const result = await pool.query(query, params);
      return NextResponse.json({
        success: true,
        data: result.rows,
        count: result.rows.length
      });
    } finally {
      await pool.end();
    }
    
  } catch (error: any) {
    console.error('Error fetching football players:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
