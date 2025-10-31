import { NextRequest, NextResponse } from 'next/server';
import { previewSeasonTrophies } from '@/lib/award-season-trophies';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const seasonId = searchParams.get('season_id');

    if (!seasonId) {
      return NextResponse.json(
        { success: false, error: 'season_id is required' },
        { status: 400 }
      );
    }

    const result = await previewSeasonTrophies(seasonId, 2);

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('Error previewing trophies:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
