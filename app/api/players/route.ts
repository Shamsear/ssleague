import { NextRequest, NextResponse } from 'next/server';
import { getAllPlayers } from '@/lib/neon/players';

export const maxDuration = 30;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters with default limit to prevent timeouts
    const filters = {
      position: searchParams.get('position') || undefined,
      team_id: searchParams.get('team_id') || undefined,
      season_id: searchParams.get('season_id') || undefined,
      is_auction_eligible: searchParams.get('is_auction_eligible') === 'true' ? true : 
                          searchParams.get('is_auction_eligible') === 'false' ? false : undefined,
      is_sold: searchParams.get('is_sold') === 'true' ? true :
               searchParams.get('is_sold') === 'false' ? false : undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 1000, // Default limit
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0,
    };
    
    console.log('[Players API] Fetching with filters:', filters);

    // Fetch players and total count in parallel
    const [players, totalResult] = await Promise.all([
      getAllPlayers(filters),
      // Get total count for pagination
      (async () => {
        try {
          const { neon } = await import('@neondatabase/serverless');
          const sql = neon(process.env.NEON_DATABASE_URL!);
          
          // Build count query with same filters
          let countQuery = 'SELECT COUNT(*) as total FROM footballplayers WHERE 1=1';
          const params: any[] = [];
          
          if (filters.position) {
            countQuery += ' AND position = $' + (params.length + 1);
            params.push(filters.position);
          }
          if (filters.team_id) {
            countQuery += ' AND team_id = $' + (params.length + 1);
            params.push(filters.team_id);
          }
          if (filters.season_id) {
            countQuery += ' AND season_id = $' + (params.length + 1);
            params.push(filters.season_id);
          }
          if (filters.is_auction_eligible !== undefined) {
            countQuery += ' AND is_auction_eligible = $' + (params.length + 1);
            params.push(filters.is_auction_eligible);
          }
          if (filters.is_sold !== undefined) {
            countQuery += ' AND is_sold = $' + (params.length + 1);
            params.push(filters.is_sold);
          }
          
          const result = await sql(countQuery, params);
          return parseInt(result[0]?.total || '0');
        } catch (error) {
          console.error('Error getting count:', error);
          return 0;
        }
      })()
    ]);
    
    const total = totalResult || players.length;
    
    return NextResponse.json({
      success: true,
      data: players,
      count: players.length,
      pagination: {
        limit: filters.limit || 1000,
        offset: filters.offset || 0,
        total: total,
        hasMore: (filters.offset || 0) + players.length < total,
        nextOffset: (filters.offset || 0) + players.length
      }
    });
  } catch (error: any) {
    console.error('Error fetching players:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
