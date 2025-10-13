import { NextRequest, NextResponse } from 'next/server';
import { getAllPlayers } from '@/lib/neon/players';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const filters = {
      position: searchParams.get('position') || undefined,
      team_id: searchParams.get('team_id') || undefined,
      season_id: searchParams.get('season_id') || undefined,
      is_auction_eligible: searchParams.get('is_auction_eligible') === 'true' ? true : 
                          searchParams.get('is_auction_eligible') === 'false' ? false : undefined,
      is_sold: searchParams.get('is_sold') === 'true' ? true :
               searchParams.get('is_sold') === 'false' ? false : undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : undefined,
    };

    const players = await getAllPlayers(filters);
    
    return NextResponse.json({
      success: true,
      data: players,
      count: players.length
    });
  } catch (error: any) {
    console.error('Error fetching players:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
