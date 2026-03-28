import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-helper';
import { autoLockLineups } from '@/lib/fantasy/lineup-locker';

/**
 * POST /api/fantasy/lineups/auto-lock
 * Auto-lock all lineups that have passed their deadline
 * 
 * This endpoint should be called by a cron job every hour
 * Can also be triggered manually by committee members
 * 
 * Request Body:
 * {
 *   league_id: string;
 *   round_id: string;
 * }
 * 
 * Response:
 * {
 *   success: boolean;
 *   lineups_locked: number;
 *   default_lineups_created: number;
 *   teams_without_lineup: string[];
 *   locked_at: string;
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Check for cron secret or committee authorization
    const cronSecret = request.headers.get('x-cron-secret');
    const isValidCron = cronSecret === process.env.CRON_SECRET;

    if (!isValidCron) {
      // If not a valid cron request, require committee authorization
      const auth = await verifyAuth(['committee'], request);
      if (!auth.authenticated) {
        return NextResponse.json(
          { 
            success: false,
            error: auth.error || 'Unauthorized - Committee access required' 
          },
          { status: 401 }
        );
      }
    }

    // Parse request body
    const body = await request.json();
    const { league_id, round_id } = body;

    // Validate required parameters
    if (!league_id || !round_id) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Missing required parameters: league_id, round_id' 
        },
        { status: 400 }
      );
    }

    // Execute auto-lock
    const result = await autoLockLineups(league_id, round_id);

    // Log the result
    console.log('Auto-lock completed:', {
      league_id,
      round_id,
      lineups_locked: result.lineups_locked,
      default_lineups_created: result.default_lineups_created,
      timestamp: result.locked_at
    });

    // Return success response
    return NextResponse.json({
      success: true,
      ...result
    });

  } catch (error: any) {
    console.error('Error in auto-lock endpoint:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal server error',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/fantasy/lineups/auto-lock
 * Get auto-lock status for a round
 * 
 * Query Parameters:
 * - league_id: string
 * - round_id: string
 * 
 * Response:
 * {
 *   total_teams: number;
 *   lineups_submitted: number;
 *   lineups_locked: number;
 *   lineups_unlocked: number;
 *   teams_without_lineup: number;
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const auth = await verifyAuth([], request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const league_id = searchParams.get('league_id');
    const round_id = searchParams.get('round_id');

    if (!league_id || !round_id) {
      return NextResponse.json(
        { error: 'Missing required parameters: league_id, round_id' },
        { status: 400 }
      );
    }

    // Import fantasySql here to avoid circular dependency
    const { fantasySql } = await import('@/lib/neon/fantasy-config');

    // Get total teams in league
    const [{ count: totalTeams }] = await fantasySql`
      SELECT COUNT(*) as count
      FROM fantasy_teams
      WHERE league_id = ${league_id}
        AND status = 'active'
    `;

    // Get lineup statistics
    const [stats] = await fantasySql`
      SELECT 
        COUNT(*) as lineups_submitted,
        COUNT(*) FILTER (WHERE is_locked = true) as lineups_locked,
        COUNT(*) FILTER (WHERE is_locked = false) as lineups_unlocked
      FROM fantasy_lineups
      WHERE league_id = ${league_id}
        AND round_id = ${round_id}
    `;

    const teamsWithoutLineup = parseInt(totalTeams) - parseInt(stats.lineups_submitted);

    return NextResponse.json({
      success: true,
      total_teams: parseInt(totalTeams),
      lineups_submitted: parseInt(stats.lineups_submitted),
      lineups_locked: parseInt(stats.lineups_locked),
      lineups_unlocked: parseInt(stats.lineups_unlocked),
      teams_without_lineup: teamsWithoutLineup
    });

  } catch (error: any) {
    console.error('Error getting auto-lock status:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
