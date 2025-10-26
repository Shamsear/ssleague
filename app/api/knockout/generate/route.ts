import { NextRequest, NextResponse } from 'next/server';
import { generateKnockoutOnly } from '@/lib/firebase/knockoutBracket';

// POST - Generate knockout-only tournament bracket
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { season_id, tournament_id, teams } = body;

    if (!season_id || !tournament_id || !teams || !Array.isArray(teams)) {
      return NextResponse.json(
        { success: false, error: 'season_id, tournament_id, and teams array are required' },
        { status: 400 }
      );
    }

    if (teams.length < 2) {
      return NextResponse.json(
        { success: false, error: 'Need at least 2 teams for knockout tournament' },
        { status: 400 }
      );
    }

    const result = await generateKnockoutOnly(season_id, tournament_id, teams);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Knockout bracket generated successfully',
      matchesCount: result.matches?.length || 0,
      stage: result.matches && result.matches.length > 0 ? result.matches[0].stage : null
    });
  } catch (error) {
    console.error('Error generating knockout bracket:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate knockout bracket' },
      { status: 500 }
    );
  }
}
