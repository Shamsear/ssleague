import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-helper';
import { calculateLineupPoints } from '@/lib/fantasy/points-calculator-v2';

/**
 * POST /api/fantasy/lineups/calculate-points
 * Calculate points for all lineups in a round
 * 
 * Committee-only endpoint
 * Should be called after a round completes
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
 *   lineups_processed: number;
 *   total_points_awarded: number;
 *   highest_scoring_team: {
 *     team_id: string;
 *     points: number;
 *   };
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Verify committee authorization
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

    // Calculate points for all lineups
    const result = await calculateLineupPoints(league_id, round_id);

    // Log the result
    console.log('Points calculation completed:', {
      league_id,
      round_id,
      lineups_processed: result.lineups_processed,
      total_points_awarded: result.total_points_awarded,
      highest_scoring_team: result.highest_scoring_team
    });

    // Return success response
    return NextResponse.json({
      success: true,
      ...result
    });

  } catch (error: any) {
    console.error('Error in calculate-points endpoint:', error);
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
