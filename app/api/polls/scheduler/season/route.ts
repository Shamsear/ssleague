import { NextRequest, NextResponse } from 'next/server';
import { 
  triggerSeasonChampionPoll, 
  triggerSeasonMVPPoll 
} from '@/lib/polls/auto-trigger';

/**
 * POST /api/polls/scheduler/season
 * Trigger season-level poll creation (champion, MVP)
 * 
 * Body:
 * - season_id: string (required)
 * - poll_type: 'champion' | 'mvp' | 'both' (required)
 * 
 * This endpoint should be called:
 * 1. Manually by admins when playoffs/finals begin
 * 2. Manually near end of season for MVP polls
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { season_id, poll_type } = body;

    if (!season_id) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'season_id is required' 
        },
        { status: 400 }
      );
    }

    if (!poll_type || !['champion', 'mvp', 'both'].includes(poll_type)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'poll_type must be "champion", "mvp", or "both"' 
        },
        { status: 400 }
      );
    }

    console.log('🤖 Running season poll scheduler:', {
      season_id,
      poll_type,
    });

    const results: { type: string; poll_id: string | null }[] = [];

    // Create champion poll
    if (poll_type === 'champion' || poll_type === 'both') {
      const championPollId = await triggerSeasonChampionPoll(season_id);
      results.push({
        type: 'champion',
        poll_id: championPollId,
      });
    }

    // Create MVP poll
    if (poll_type === 'mvp' || poll_type === 'both') {
      const mvpPollId = await triggerSeasonMVPPoll(season_id);
      results.push({
        type: 'mvp',
        poll_id: mvpPollId,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Season polls created successfully',
      season_id,
      polls: results,
    });
  } catch (error: any) {
    console.error('Error running season poll scheduler:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to create season polls',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/polls/scheduler/season?season_id=xxx
 * Check if season polls exist
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const seasonId = searchParams.get('season_id');

    if (!seasonId) {
      return NextResponse.json(
        { error: 'season_id is required' },
        { status: 400 }
      );
    }

    const { getTournamentDb } = await import('@/lib/neon/tournament-config');
    const sql = getTournamentDb();

    // Check for existing season polls
    const polls = await sql`
      SELECT 
        id, poll_type, question_en, total_votes, is_closed, closes_at
      FROM polls
      WHERE season_id = ${seasonId}
        AND poll_type IN ('season_champion', 'season_mvp')
      ORDER BY created_at DESC
    `;

    return NextResponse.json({
      success: true,
      season_id: seasonId,
      polls_count: polls.length,
      polls: polls,
    });
  } catch (error: any) {
    console.error('Error checking season polls:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check season polls' },
      { status: 500 }
    );
  }
}
