import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

// GET - Get fixtures with optional filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const seasonId = searchParams.get('season_id');
    const tournamentId = searchParams.get('tournament_id');
    const status = searchParams.get('status');
    const roundNumber = searchParams.get('round_number');
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : null;

    // Build query using tagged template syntax
    let fixtures;

    if (seasonId && status && limit) {
      // Most common case: season + status + limit
      fixtures = await sql`
        SELECT 
          f.*,
          ht.name as home_team_name,
          at.name as away_team_name
        FROM fixtures f
        LEFT JOIN teams ht ON f.home_team_id = ht.id
        LEFT JOIN teams at ON f.away_team_id = at.id
        WHERE f.season_id = ${seasonId}
          AND f.status = ${status}
        ORDER BY f.round_number DESC, f.match_number ASC
        LIMIT ${limit}
      `;
    } else if (seasonId && status) {
      fixtures = await sql`
        SELECT 
          f.*,
          ht.name as home_team_name,
          at.name as away_team_name
        FROM fixtures f
        LEFT JOIN teams ht ON f.home_team_id = ht.id
        LEFT JOIN teams at ON f.away_team_id = at.id
        WHERE f.season_id = ${seasonId}
          AND f.status = ${status}
        ORDER BY f.round_number DESC, f.match_number ASC
      `;
    } else if (tournamentId && roundNumber) {
      fixtures = await sql`
        SELECT 
          f.*,
          ht.name as home_team_name,
          at.name as away_team_name
        FROM fixtures f
        LEFT JOIN teams ht ON f.home_team_id = ht.id
        LEFT JOIN teams at ON f.away_team_id = at.id
        WHERE f.tournament_id = ${tournamentId}
          AND f.round_number = ${parseInt(roundNumber)}
        ORDER BY f.match_number ASC
      `;
    } else if (tournamentId) {
      fixtures = await sql`
        SELECT 
          f.*,
          ht.name as home_team_name,
          at.name as away_team_name
        FROM fixtures f
        LEFT JOIN teams ht ON f.home_team_id = ht.id
        LEFT JOIN teams at ON f.away_team_id = at.id
        WHERE f.tournament_id = ${tournamentId}
        ORDER BY f.round_number ASC, f.match_number ASC
      `;
    } else if (seasonId) {
      fixtures = await sql`
        SELECT 
          f.*,
          ht.name as home_team_name,
          at.name as away_team_name
        FROM fixtures f
        LEFT JOIN teams ht ON f.home_team_id = ht.id
        LEFT JOIN teams at ON f.away_team_id = at.id
        WHERE f.season_id = ${seasonId}
        ORDER BY f.round_number ASC, f.match_number ASC
      `;
    } else {
      // No filters - return recent fixtures
      fixtures = await sql`
        SELECT 
          f.*,
          ht.name as home_team_name,
          at.name as away_team_name
        FROM fixtures f
        LEFT JOIN teams ht ON f.home_team_id = ht.id
        LEFT JOIN teams at ON f.away_team_id = at.id
        ORDER BY f.created_at DESC
        LIMIT 100
      `;
    }

    return NextResponse.json({
      success: true,
      fixtures,
      count: fixtures.length
    });

  } catch (error: any) {
    console.error('Error fetching fixtures:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch fixtures'
    }, { status: 500 });
  }
}
