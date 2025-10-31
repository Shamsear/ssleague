import { NextRequest, NextResponse } from 'next/server';
import { runWeeklyPollTriggers } from '@/lib/polls/auto-trigger';

/**
 * POST /api/polls/scheduler/weekly
 * Trigger weekly poll creation (top player, top team)
 * 
 * Body:
 * - season_id: string (required)
 * - week_number: number (required)
 * 
 * This endpoint should be called:
 * 1. Via a cron job at the end of each week (Sunday night)
 * 2. Manually by admins to create polls for specific weeks
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { season_id, week_number } = body;

    if (!season_id) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'season_id is required' 
        },
        { status: 400 }
      );
    }

    if (!week_number || typeof week_number !== 'number') {
      return NextResponse.json(
        { 
          success: false, 
          error: 'week_number is required and must be a number' 
        },
        { status: 400 }
      );
    }

    console.log('🤖 Running weekly poll scheduler:', {
      season_id,
      week_number,
    });

    // Run weekly poll triggers
    await runWeeklyPollTriggers(season_id, week_number);

    return NextResponse.json({
      success: true,
      message: 'Weekly polls created successfully',
      season_id,
      week_number,
    });
  } catch (error: any) {
    console.error('Error running weekly poll scheduler:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to create weekly polls',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/polls/scheduler/weekly?season_id=xxx&week_number=N
 * Check if weekly polls exist for a specific week
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const seasonId = searchParams.get('season_id');
    const weekNumber = searchParams.get('week_number');

    if (!seasonId) {
      return NextResponse.json(
        { error: 'season_id is required' },
        { status: 400 }
      );
    }

    if (!weekNumber) {
      return NextResponse.json(
        { error: 'week_number is required' },
        { status: 400 }
      );
    }

    const { getTournamentDb } = await import('@/lib/neon/tournament-config');
    const sql = getTournamentDb();

    // Check for existing weekly polls
    const polls = await sql`
      SELECT 
        id, poll_type, question_en, total_votes, is_closed
      FROM polls
      WHERE season_id = ${seasonId}
        AND poll_type IN ('weekly_top_player', 'weekly_top_team')
        AND metadata->>'week_number' = ${weekNumber}
      ORDER BY created_at DESC
    `;

    return NextResponse.json({
      success: true,
      season_id: seasonId,
      week_number: parseInt(weekNumber),
      polls_count: polls.length,
      polls: polls,
    });
  } catch (error: any) {
    console.error('Error checking weekly polls:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check weekly polls' },
      { status: 500 }
    );
  }
}
