/**
 * Matches API - Tournament Database
 * GET: Fetch match results
 * POST: Create/update match result
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

export async function GET(request: NextRequest) {
  try {
    const sql = getTournamentDb();
    const { searchParams } = new URL(request.url);
    
    const seasonId = searchParams.get('seasonId');
    const fixtureId = searchParams.get('fixtureId');
    const teamId = searchParams.get('teamId');
    
    let matches;
    
    if (fixtureId) {
      matches = await sql`
        SELECT * FROM matches 
        WHERE fixture_id = ${fixtureId}
      `;
    } else if (seasonId && teamId) {
      matches = await sql`
        SELECT * FROM matches 
        WHERE season_id = ${seasonId} 
        AND (home_team_id = ${teamId} OR away_team_id = ${teamId})
        ORDER BY match_date DESC
      `;
    } else if (seasonId) {
      matches = await sql`
        SELECT * FROM matches 
        WHERE season_id = ${seasonId}
        ORDER BY match_date DESC
      `;
    } else {
      matches = await sql`
        SELECT * FROM matches 
        ORDER BY match_date DESC
        LIMIT 50
      `;
    }
    
    return NextResponse.json({
      success: true,
      data: matches,
      count: matches.length
    });
    
  } catch (error: any) {
    console.error('Error fetching matches:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const sql = getTournamentDb();
    const body = await request.json();
    
    const {
      id,
      fixture_id,
      season_id,
      round_number,
      home_team_id,
      away_team_id,
      home_score,
      away_score,
      winner_id,
      result_type,
      match_date,
      details
    } = body;
    
    if (!fixture_id || !season_id || !home_team_id || !away_team_id) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    const matchId = id || `match_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const result = await sql`
      INSERT INTO matches (
        id, fixture_id, season_id, round_number,
        home_team_id, away_team_id, home_score, away_score,
        winner_id, result_type, match_date, details
      )
      VALUES (
        ${matchId}, ${fixture_id}, ${season_id}, ${round_number},
        ${home_team_id}, ${away_team_id}, ${home_score}, ${away_score},
        ${winner_id}, ${result_type},
        ${match_date ? new Date(match_date) : new Date()},
        ${details ? JSON.stringify(details) : null}
      )
      ON CONFLICT (id) DO UPDATE
      SET home_score = EXCLUDED.home_score,
          away_score = EXCLUDED.away_score,
          winner_id = EXCLUDED.winner_id,
          result_type = EXCLUDED.result_type,
          updated_at = NOW()
      RETURNING *
    `;
    
    return NextResponse.json({
      success: true,
      data: result[0]
    });
    
  } catch (error: any) {
    console.error('Error creating/updating match:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
