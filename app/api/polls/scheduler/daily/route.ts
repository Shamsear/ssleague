import { NextRequest, NextResponse } from 'next/server';
import { runDailyPollTriggers } from '@/lib/polls/auto-trigger';

/**
 * POST /api/polls/scheduler/daily
 * Trigger daily poll creation (best player, best team)
 * 
 * Body:
 * - season_id: string (required)
 * - date?: string (optional, defaults to today in YYYY-MM-DD format)
 * 
 * This endpoint should be called:
 * 1. Via a cron job at the end of each day (11:59 PM)
 * 2. Manually by admins to create polls for specific dates
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { season_id, date } = body;

    if (!season_id) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'season_id is required' 
        },
        { status: 400 }
      );
    }

    // Parse date or use today
    const targetDate = date ? new Date(date) : new Date();
    
    console.log('🤖 Running daily poll scheduler:', {
      season_id,
      date: targetDate.toISOString().split('T')[0],
    });

    // Run daily poll triggers
    await runDailyPollTriggers(season_id, targetDate);

    return NextResponse.json({
      success: true,
      message: 'Daily polls created successfully',
      season_id,
      date: targetDate.toISOString().split('T')[0],
    });
  } catch (error: any) {
    console.error('Error running daily poll scheduler:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to create daily polls',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/polls/scheduler/daily?season_id=xxx&date=YYYY-MM-DD
 * Check if daily polls exist for a specific date
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const seasonId = searchParams.get('season_id');
    const dateStr = searchParams.get('date') || new Date().toISOString().split('T')[0];

    if (!seasonId) {
      return NextResponse.json(
        { error: 'season_id is required' },
        { status: 400 }
      );
    }

    const { getTournamentDb } = await import('@/lib/neon/tournament-config');
    const sql = getTournamentDb();

    // Check for existing daily polls
    const polls = await sql`
      SELECT 
        id, poll_type, question_en, total_votes, is_closed
      FROM polls
      WHERE season_id = ${seasonId}
        AND poll_type IN ('daily_best_player', 'daily_best_team')
        AND metadata->>'date' = ${dateStr}
      ORDER BY created_at DESC
    `;

    return NextResponse.json({
      success: true,
      season_id: seasonId,
      date: dateStr,
      polls_count: polls.length,
      polls: polls,
    });
  } catch (error: any) {
    console.error('Error checking daily polls:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check daily polls' },
      { status: 500 }
    );
  }
}
