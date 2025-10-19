import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.NEON_DATABASE_URL!);

/**
 * GET /api/cached/firebase/fixtures
 * Returns fixtures data with ISR caching FROM NEON
 * 
 * Query params:
 * - seasonId: Filter by season (required for most queries)
 * - teamId: Filter by team (optional)
 * - roundNumber: Filter by round (optional)
 * - status: Filter by status (optional)
 * 
 * Cache: 30 seconds (live match results)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const seasonId = searchParams.get('seasonId');
    const teamId = searchParams.get('teamId');
    const roundNumber = searchParams.get('roundNumber');
    const status = searchParams.get('status');
    
    // Build SQL query
    let conditions = [];
    let params: any[] = [];
    
    if (seasonId) {
      conditions.push('season_id = $' + (params.length + 1));
      params.push(seasonId);
    }
    
    if (teamId) {
      conditions.push('(home_team_id = $' + (params.length + 1) + ' OR away_team_id = $' + (params.length + 1) + ')');
      params.push(teamId);
    }
    
    if (roundNumber) {
      conditions.push('round_number = $' + (params.length + 1));
      params.push(parseInt(roundNumber));
    }
    
    if (status) {
      conditions.push('status = $' + (params.length + 1));
      params.push(status);
    }
    
    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    const query = `SELECT * FROM fixtures ${whereClause} ORDER BY round_number DESC, match_number ASC`;
    
    const fixtures = await sql(query, params);
    
    return NextResponse.json(
      {
        success: true,
        data: fixtures,
        cached: true,
        timestamp: new Date().toISOString(),
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
          'CDN-Cache-Control': 'public, s-maxage=30',
          'Vercel-CDN-Cache-Control': 'public, s-maxage=30',
        },
      }
    );
  } catch (error) {
    console.error('Error fetching fixtures:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch fixtures',
      },
      { status: 500 }
    );
  }
}

export const revalidate = 30; // Revalidate every 30 seconds
export const dynamic = 'force-static';
