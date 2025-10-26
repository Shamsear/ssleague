import { NextRequest, NextResponse } from 'next/server';
import { calculateGroupStandings } from '@/lib/firebase/groupStage';

// GET - Get group standings for a tournament
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const seasonId = searchParams.get('season_id');
    const tournamentId = searchParams.get('tournament_id');

    if (!seasonId || !tournamentId) {
      return NextResponse.json(
        { success: false, error: 'season_id and tournament_id are required' },
        { status: 400 }
      );
    }

    const standings = await calculateGroupStandings(seasonId, tournamentId);

    return NextResponse.json({ 
      success: true, 
      standings 
    });
  } catch (error) {
    console.error('Error fetching group standings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch group standings' },
      { status: 500 }
    );
  }
}
