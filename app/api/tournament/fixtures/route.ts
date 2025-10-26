/**
 * Fixtures API - Tournament Database
 * GET: Fetch fixtures
 * POST: Create new fixture
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

export async function GET(request: NextRequest) {
  try {
    const sql = getTournamentDb();
    const { searchParams } = new URL(request.url);
    
    const seasonId = searchParams.get('seasonId');
    const status = searchParams.get('status');
    const roundNumber = searchParams.get('roundNumber');
    const teamId = searchParams.get('teamId');
    
    let fixtures;
    
    if (seasonId && roundNumber) {
      fixtures = await sql`
        SELECT * FROM fixtures 
        WHERE season_id = ${seasonId} AND round_number = ${parseInt(roundNumber)}
        ORDER BY scheduled_date ASC
      `;
    } else if (seasonId && status) {
      fixtures = await sql`
        SELECT * FROM fixtures 
        WHERE season_id = ${seasonId} AND status = ${status}
        ORDER BY scheduled_date ASC
      `;
    } else if (seasonId) {
      fixtures = await sql`
        SELECT * FROM fixtures 
        WHERE season_id = ${seasonId}
        ORDER BY round_number ASC, scheduled_date ASC
      `;
    } else if (teamId) {
      fixtures = await sql`
        SELECT * FROM fixtures 
        WHERE home_team_id = ${teamId} OR away_team_id = ${teamId}
        ORDER BY scheduled_date DESC
      `;
    } else {
      fixtures = await sql`
        SELECT * FROM fixtures 
        ORDER BY scheduled_date DESC
        LIMIT 50
      `;
    }
    
    return NextResponse.json({
      success: true,
      data: fixtures,
      count: fixtures.length
    });
    
  } catch (error: any) {
    console.error('Error fetching fixtures:', error);
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
      season_id,
      round_number,
      leg,
      match_day,
      home_team_id,
      away_team_id,
      home_team_name,
      away_team_name,
      home_score,
      away_score,
      status = 'scheduled',
      result,
      scheduled_date,
      played_date,
      notes
    } = body;
    
    if (!season_id || !home_team_id || !away_team_id) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: season_id, home_team_id, away_team_id' },
        { status: 400 }
      );
    }
    
    const fixtureId = id || `fixture_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const result_data = await sql`
      INSERT INTO fixtures (
        id, season_id, round_number, leg, match_day,
        home_team_id, away_team_id, home_team_name, away_team_name,
        home_score, away_score, status, result, scheduled_date, played_date, notes
      )
      VALUES (
        ${fixtureId}, ${season_id}, ${round_number}, ${leg}, ${match_day},
        ${home_team_id}, ${away_team_id}, ${home_team_name}, ${away_team_name},
        ${home_score}, ${away_score}, ${status}, ${result},
        ${scheduled_date ? new Date(scheduled_date) : null},
        ${played_date ? new Date(played_date) : null},
        ${notes}
      )
      RETURNING *
    `;
    
    return NextResponse.json({
      success: true,
      data: result_data[0]
    });
    
  } catch (error: any) {
    console.error('Error creating fixture:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
