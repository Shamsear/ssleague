import { NextRequest, NextResponse } from 'next/server';
import { awardSeasonTrophies } from '@/lib/award-season-trophies';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { season_id } = body;

    if (!season_id) {
      return NextResponse.json(
        { success: false, error: 'season_id is required' },
        { status: 400 }
      );
    }

    const result = await awardSeasonTrophies(season_id, 2);

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('Error awarding trophies:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
