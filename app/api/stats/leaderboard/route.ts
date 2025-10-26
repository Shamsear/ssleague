/**
 * Leaderboard API - Tournament Database
 * GET: Fetch leaderboard data (cached)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

export async function GET(request: NextRequest) {
  try {
    const sql = getTournamentDb();
    const { searchParams } = new URL(request.url);
    
    const seasonId = searchParams.get('seasonId');
    const type = searchParams.get('type') || 'player'; // 'player' or 'team'
    const category = searchParams.get('category');
    
    if (!seasonId) {
      return NextResponse.json(
        { success: false, error: 'seasonId is required' },
        { status: 400 }
      );
    }
    
    // Try to get cached leaderboard first
    let leaderboard;
    
    if (category) {
      leaderboard = await sql`
        SELECT * FROM leaderboards 
        WHERE season_id = ${seasonId} AND type = ${type} AND category = ${category}
        ORDER BY updated_at DESC
        LIMIT 1
      `;
    } else {
      leaderboard = await sql`
        SELECT * FROM leaderboards 
        WHERE season_id = ${seasonId} AND type = ${type}
        ORDER BY updated_at DESC
        LIMIT 1
      `;
    }
    
    // If cached leaderboard exists and is recent (< 5 minutes old), return it
    if (leaderboard.length > 0) {
      const cacheAge = Date.now() - new Date(leaderboard[0].updated_at).getTime();
      if (cacheAge < 5 * 60 * 1000) { // 5 minutes
        return NextResponse.json({
          success: true,
          data: leaderboard[0].rankings,
          cached: true,
          updated_at: leaderboard[0].updated_at
        });
      }
    }
    
    // Generate fresh leaderboard from stats
    let rankings;
    
    if (type === 'team') {
      rankings = await sql`
        SELECT * FROM teamstats 
        WHERE season_id = ${seasonId}
        ORDER BY points DESC, goal_difference DESC, goals_for DESC
      `;
    } else {
      if (category) {
        rankings = await sql`
          SELECT * FROM realplayerstats 
          WHERE season_id = ${seasonId} AND category = ${category}
          ORDER BY points DESC, goals_scored DESC
          LIMIT 50
        `;
      } else {
        rankings = await sql`
          SELECT * FROM realplayerstats 
          WHERE season_id = ${seasonId}
          ORDER BY points DESC, goals_scored DESC
          LIMIT 50
        `;
      }
    }
    
    // Cache the leaderboard
    try {
      await sql`
        INSERT INTO leaderboards (season_id, type, category, rankings)
        VALUES (${seasonId}, ${type}, ${category}, ${JSON.stringify(rankings)})
        ON CONFLICT (season_id, type, category) DO UPDATE
        SET rankings = EXCLUDED.rankings, updated_at = NOW()
      `;
    } catch (cacheError) {
      console.error('Error caching leaderboard:', cacheError);
      // Continue anyway, caching is not critical
    }
    
    return NextResponse.json({
      success: true,
      data: rankings,
      cached: false,
      updated_at: new Date()
    });
    
  } catch (error: any) {
    console.error('Error fetching leaderboard:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
