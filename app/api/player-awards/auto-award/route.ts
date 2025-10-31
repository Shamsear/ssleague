import { NextRequest, NextResponse } from 'next/server';
import { autoAwardPlayerAwards } from '@/lib/award-player-awards';

// POST - Auto-award player awards based on season statistics
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

    const result = await autoAwardPlayerAwards(season_id);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      awardsGiven: result.awardsGiven,
      awards: result.awards,
      message: `Successfully awarded ${result.awardsGiven} player awards`
    });
  } catch (error: any) {
    console.error('Error auto-awarding player awards:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to auto-award player awards' },
      { status: 500 }
    );
  }
}
