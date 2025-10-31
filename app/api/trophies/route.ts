import { NextRequest, NextResponse } from 'next/server';
import { getTournamentDb } from '@/lib/neon/tournament-config';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const seasonId = searchParams.get('season_id');
    const teamId = searchParams.get('team_id');

    const sql = getTournamentDb();

    let trophies;
    
    if (seasonId && teamId) {
      // Filter by both season and team
      trophies = await sql`
        SELECT *
        FROM team_trophies
        WHERE season_id = ${seasonId} AND team_id = ${teamId}
        ORDER BY 
          CASE trophy_type
            WHEN 'league' THEN 1
            WHEN 'runner_up' THEN 2
            WHEN 'cup' THEN 3
            ELSE 4
          END,
          position ASC
      `;
    } else if (seasonId) {
      // Filter by season only
      trophies = await sql`
        SELECT *
        FROM team_trophies
        WHERE season_id = ${seasonId}
        ORDER BY 
          CASE trophy_type
            WHEN 'league' THEN 1
            WHEN 'runner_up' THEN 2
            WHEN 'cup' THEN 3
            ELSE 4
          END,
          position ASC,
          team_name ASC
      `;
    } else if (teamId) {
      // Filter by team only
      trophies = await sql`
        SELECT *
        FROM team_trophies
        WHERE team_id = ${teamId}
        ORDER BY season_id DESC,
          CASE trophy_type
            WHEN 'league' THEN 1
            WHEN 'runner_up' THEN 2
            WHEN 'cup' THEN 3
            ELSE 4
          END,
          position ASC
      `;
    } else {
      // Get all trophies (limited to recent ones)
      trophies = await sql`
        SELECT *
        FROM team_trophies
        ORDER BY season_id DESC,
          CASE trophy_type
            WHEN 'league' THEN 1
            WHEN 'runner_up' THEN 2
            WHEN 'cup' THEN 3
            ELSE 4
          END,
          position ASC,
          team_name ASC
        LIMIT 100
      `;
    }

    return NextResponse.json({
      success: true,
      trophies
    });

  } catch (error: any) {
    console.error('Error fetching trophies:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
