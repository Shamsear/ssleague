import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-helper';
import { 
  releasePlayer, 
  releaseMultiplePlayers,
  validateRelease,
  calculateRefund 
} from '@/lib/fantasy/release-processor';

/**
 * POST /api/fantasy/transfers/release
 * Release one or more players from a team's squad
 * 
 * Request Body:
 * {
 *   team_id: string;
 *   league_id: string;
 *   player_ids: string[]; // Array of player IDs to release
 *   transfer_window_id?: string;
 * }
 * 
 * Response:
 * {
 *   success: boolean;
 *   releases: Array<{
 *     release_id: string;
 *     player_id: string;
 *     purchase_price: number;
 *     refund_amount: number;
 *     refund_percentage: number;
 *     new_budget: number;
 *   }>;
 *   total_refund: number;
 *   errors?: string[];
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const auth = await verifyAuth([], request);
    if (!auth.authenticated || !auth.userId) {
      return NextResponse.json(
        { 
          success: false,
          error: auth.error || 'Unauthorized' 
        },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { team_id, league_id, player_ids, transfer_window_id } = body;

    // Validate required parameters
    if (!team_id || !league_id || !player_ids || !Array.isArray(player_ids)) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Missing or invalid required parameters: team_id, league_id, player_ids' 
        },
        { status: 400 }
      );
    }

    if (player_ids.length === 0) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Must provide at least one player to release' 
        },
        { status: 400 }
      );
    }

    // Import fantasySql here to verify team ownership
    const { fantasySql } = await import('@/lib/neon/fantasy-config');

    // Verify team ownership
    const [team] = await fantasySql`
      SELECT team_id, owner_uid, league_id
      FROM fantasy_teams
      WHERE team_id = ${team_id}
    `;

    if (!team) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Team not found' 
        },
        { status: 404 }
      );
    }

    if (team.owner_uid !== auth.userId) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Forbidden: Not your team' 
        },
        { status: 403 }
      );
    }

    if (team.league_id !== league_id) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Forbidden: Team not in this league' 
        },
        { status: 403 }
      );
    }

    // Check if transfer window is active (if provided)
    if (transfer_window_id) {
      const [window] = await fantasySql`
        SELECT window_id, status, end_time
        FROM fantasy_transfer_windows
        WHERE window_id = ${transfer_window_id}
          AND league_id = ${league_id}
      `;

      if (!window) {
        return NextResponse.json(
          { 
            success: false,
            error: 'Transfer window not found' 
          },
          { status: 404 }
        );
      }

      if (window.status !== 'active') {
        return NextResponse.json(
          { 
            success: false,
            error: 'Transfer window is not active' 
          },
          { status: 400 }
        );
      }

      const now = new Date();
      const endTime = new Date(window.end_time);
      if (now > endTime) {
        return NextResponse.json(
          { 
            success: false,
            error: 'Transfer window has closed' 
          },
          { status: 400 }
        );
      }
    }

    // Validate all releases before processing
    const validationErrors: string[] = [];
    for (const playerId of player_ids) {
      const validation = await validateRelease(team_id, playerId);
      if (!validation.valid) {
        validationErrors.push(`${playerId}: ${validation.error}`);
      }
    }

    if (validationErrors.length > 0) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Validation failed',
          details: validationErrors
        },
        { status: 400 }
      );
    }

    // Release players
    const result = await releaseMultiplePlayers(
      team_id,
      player_ids,
      league_id,
      transfer_window_id
    );

    // Log the release
    console.log('Players released:', {
      team_id,
      league_id,
      player_count: result.releases.length,
      total_refund: result.total_refund,
      transfer_window_id
    });

    // Return success response
    return NextResponse.json({
      success: result.success,
      releases: result.releases,
      total_refund: result.total_refund,
      errors: result.errors.length > 0 ? result.errors : undefined
    });

  } catch (error: any) {
    console.error('Error in release endpoint:', error);
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
 * GET /api/fantasy/transfers/release
 * Get release preview (calculate refund without releasing)
 * 
 * Query Parameters:
 * - team_id: string
 * - player_id: string
 * 
 * Response:
 * {
 *   success: boolean;
 *   player_id: string;
 *   purchase_price: number;
 *   refund_amount: number;
 *   refund_percentage: number;
 *   can_release: boolean;
 *   error?: string;
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const auth = await verifyAuth([], request);
    if (!auth.authenticated || !auth.userId) {
      return NextResponse.json(
        { 
          success: false,
          error: auth.error || 'Unauthorized' 
        },
        { status: 401 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const team_id = searchParams.get('team_id');
    const player_id = searchParams.get('player_id');

    if (!team_id || !player_id) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Missing required parameters: team_id, player_id' 
        },
        { status: 400 }
      );
    }

    // Import fantasySql
    const { fantasySql } = await import('@/lib/neon/fantasy-config');

    // Verify team ownership
    const [team] = await fantasySql`
      SELECT team_id, owner_uid
      FROM fantasy_teams
      WHERE team_id = ${team_id}
    `;

    if (!team) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Team not found' 
        },
        { status: 404 }
      );
    }

    if (team.owner_uid !== auth.userId) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Forbidden: Not your team' 
        },
        { status: 403 }
      );
    }

    // Validate release
    const validation = await validateRelease(team_id, player_id);

    // Calculate refund
    let refundInfo = null;
    if (validation.valid) {
      refundInfo = await calculateRefund(team_id, player_id);
    }

    return NextResponse.json({
      success: true,
      player_id,
      can_release: validation.valid,
      error: validation.error,
      ...refundInfo
    });

  } catch (error: any) {
    console.error('Error in release preview endpoint:', error);
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
