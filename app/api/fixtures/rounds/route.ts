/**
 * Fixtures Rounds API
 * GET: Get round information for a season
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

export async function GET(request: NextRequest) {
  try {
    const sql = getTournamentDb();
    const { searchParams } = new URL(request.url);
    
    const seasonId = searchParams.get('seasonId');
    
    if (!seasonId) {
      return NextResponse.json(
        { success: false, error: 'seasonId is required' },
        { status: 400 }
      );
    }
    
    // Get max round number for the season
    const result = await sql`
      SELECT 
        MAX(round_number) as max_round,
        MIN(round_number) as min_round,
        COUNT(DISTINCT round_number) as total_rounds
      FROM fixtures
      WHERE season_id = ${seasonId}
        AND round_number IS NOT NULL
    `;
    
    if (result.length === 0 || !result[0].max_round) {
      return NextResponse.json({
        success: true,
        maxRound: 0,
        minRound: 0,
        totalRounds: 0
      });
    }
    
    return NextResponse.json({
      success: true,
      maxRound: result[0].max_round,
      minRound: result[0].min_round,
      totalRounds: result[0].total_rounds
    });
    
  } catch (error: any) {
    console.error('Error fetching rounds:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
