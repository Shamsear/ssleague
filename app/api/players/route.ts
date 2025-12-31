import { NextRequest, NextResponse } from 'next/server';
import { getAllPlayers, getTotalPlayerCountWithFilters } from '@/lib/neon/players';

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
      search: searchParams.get('search') || undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 1000, // Default limit
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0,
    };

    console.log('[Players API] Fetching with filters:', filters);

    // Get total count with same filters (excluding limit/offset)
    const countFilters = {
      position: filters.position,
      team_id: filters.team_id,
      season_id: filters.season_id,
      is_auction_eligible: filters.is_auction_eligible,
      is_sold: filters.is_sold,
      search: filters.search
    };

    // Fetch both players and total count
    const [players, totalCount] = await Promise.all([
      getAllPlayers(filters),
      getTotalPlayerCountWithFilters(countFilters)
    ]);

    return NextResponse.json({
      success: true,
      data: players,
      count: players.length,
      totalCount: totalCount,
      pagination: {
        limit: filters.limit || 1000,
        offset: filters.offset || 0,
        hasMore: players.length === (filters.limit || 1000), // If we got full page, assume more
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
