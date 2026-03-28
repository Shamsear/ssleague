import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-helper';
import { 
  proposeTrade,
  validateTradeProposal,
  calculateTradeValue
} from '@/lib/fantasy/trade-processor';

/**
 * POST /api/fantasy/trades/propose
 * Propose a trade between two teams
 * 
 * Request Body:
 * {
 *   league_id: string;
 *   team_a_id: string; // Proposer (must be authenticated user's team)
 *   team_b_id: string; // Receiver
 *   trade_type: 'sale' | 'swap';
 *   team_a_players: string[]; // Players from proposer
 *   team_b_players: string[]; // Players from receiver
 *   team_a_cash: number; // Cash from proposer
 *   team_b_cash: number; // Cash from receiver
 *   expires_in_hours: number; // 1-168 hours (1 hour to 7 days)
 * }
 * 
 * Response:
 * {
 *   success: boolean;
 *   trade_id: string;
 *   expires_at: string;
 *   trade_value: {
 *     team_a_value: number;
 *     team_b_value: number;
 *     difference: number;
 *     fairness_percentage: number;
 *   };
 *   message: string;
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
    const { 
      league_id,
      team_a_id,
      team_b_id,
      trade_type,
      team_a_players,
      team_b_players,
      team_a_cash,
      team_b_cash,
      expires_in_hours
    } = body;

    // Validate required parameters
    if (!league_id || !team_a_id || !team_b_id || !trade_type) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Missing required parameters: league_id, team_a_id, team_b_id, trade_type' 
        },
        { status: 400 }
      );
    }

    if (!['sale', 'swap'].includes(trade_type)) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Invalid trade_type. Must be "sale" or "swap"' 
        },
        { status: 400 }
      );
    }

    if (!Array.isArray(team_a_players) || !Array.isArray(team_b_players)) {
      return NextResponse.json(
        { 
          success: false,
          error: 'team_a_players and team_b_players must be arrays' 
        },
        { status: 400 }
      );
    }

    if (typeof team_a_cash !== 'number' || typeof team_b_cash !== 'number') {
      return NextResponse.json(
        { 
          success: false,
          error: 'team_a_cash and team_b_cash must be numbers' 
        },
        { status: 400 }
      );
    }

    if (!expires_in_hours || typeof expires_in_hours !== 'number') {
      return NextResponse.json(
        { 
          success: false,
          error: 'expires_in_hours is required and must be a number' 
        },
        { status: 400 }
      );
    }

    // Import fantasySql
    const { fantasySql } = await import('@/lib/neon/fantasy-config');

    // Verify team ownership (proposer must own team_a)
    const [teamA] = await fantasySql`
      SELECT team_id, owner_uid, league_id, team_name
      FROM fantasy_teams
      WHERE team_id = ${team_a_id}
    `;

    if (!teamA) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Proposer team not found' 
        },
        { status: 404 }
      );
    }

    if (teamA.owner_uid !== auth.userId) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Forbidden: You can only propose trades from your own team' 
        },
        { status: 403 }
      );
    }

    if (teamA.league_id !== league_id) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Forbidden: Team not in this league' 
        },
        { status: 403 }
      );
    }

    // Verify receiver team exists
    const [teamB] = await fantasySql`
      SELECT team_id, league_id, team_name
      FROM fantasy_teams
      WHERE team_id = ${team_b_id}
    `;

    if (!teamB) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Receiver team not found' 
        },
        { status: 404 }
      );
    }

    if (teamB.league_id !== league_id) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Both teams must be in the same league' 
        },
        { status: 400 }
      );
    }

    // Validate players exist in proposer's squad
    if (team_a_players.length > 0) {
      const teamAPlayersInSquad = await fantasySql`
        SELECT real_player_id
        FROM fantasy_squad
        WHERE team_id = ${team_a_id}
          AND real_player_id = ANY(${team_a_players})
      `;

      if (teamAPlayersInSquad.length !== team_a_players.length) {
        return NextResponse.json(
          { 
            success: false,
            error: 'Some players are not in your squad' 
          },
          { status: 400 }
        );
      }
    }

    // Validate players exist in receiver's squad
    if (team_b_players.length > 0) {
      const teamBPlayersInSquad = await fantasySql`
        SELECT real_player_id
        FROM fantasy_squad
        WHERE team_id = ${team_b_id}
          AND real_player_id = ANY(${team_b_players})
      `;

      if (teamBPlayersInSquad.length !== team_b_players.length) {
        return NextResponse.json(
          { 
            success: false,
            error: 'Some players are not in the receiver\'s squad' 
          },
          { status: 400 }
        );
      }
    }

    // Propose the trade
    const result = await proposeTrade({
      league_id,
      team_a_id,
      team_b_id,
      trade_type,
      team_a_players,
      team_b_players,
      team_a_cash,
      team_b_cash,
      expires_in_hours
    });

    // Log the trade proposal
    console.log('Trade proposed:', {
      trade_id: result.trade_id,
      from: teamA.team_name,
      to: teamB.team_name,
      trade_type,
      expires_at: result.expires_at
    });

    // TODO: Send notification to team B (implement in future)
    // await sendTradeNotification(team_b_id, result.trade_id);

    // Return success response
    return NextResponse.json({
      success: result.success,
      trade_id: result.trade_id,
      expires_at: result.expires_at,
      trade_value: result.trade_value,
      message: result.message
    });

  } catch (error: any) {
    console.error('Error in propose trade endpoint:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to propose trade',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/fantasy/trades/propose
 * Preview trade value before proposing
 * 
 * Query Parameters:
 * - league_id: string
 * - team_a_id: string
 * - team_b_id: string
 * - trade_type: 'sale' | 'swap'
 * - team_a_players: string (comma-separated player IDs)
 * - team_b_players: string (comma-separated player IDs)
 * - team_a_cash: number
 * - team_b_cash: number
 * 
 * Response:
 * {
 *   success: boolean;
 *   trade_value: {
 *     team_a_value: number;
 *     team_b_value: number;
 *     difference: number;
 *     fairness_percentage: number;
 *   };
 *   validation: {
 *     valid: boolean;
 *     error?: string;
 *   };
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
    const league_id = searchParams.get('league_id');
    const team_a_id = searchParams.get('team_a_id');
    const team_b_id = searchParams.get('team_b_id');
    const trade_type = searchParams.get('trade_type') as 'sale' | 'swap';
    const team_a_players_str = searchParams.get('team_a_players') || '';
    const team_b_players_str = searchParams.get('team_b_players') || '';
    const team_a_cash = parseFloat(searchParams.get('team_a_cash') || '0');
    const team_b_cash = parseFloat(searchParams.get('team_b_cash') || '0');

    if (!league_id || !team_a_id || !team_b_id || !trade_type) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Missing required parameters' 
        },
        { status: 400 }
      );
    }

    // Parse player arrays
    const team_a_players = team_a_players_str ? team_a_players_str.split(',') : [];
    const team_b_players = team_b_players_str ? team_b_players_str.split(',') : [];

    // Import fantasySql
    const { fantasySql } = await import('@/lib/neon/fantasy-config');

    // Verify team ownership
    const [teamA] = await fantasySql`
      SELECT team_id, owner_uid
      FROM fantasy_teams
      WHERE team_id = ${team_a_id}
    `;

    if (!teamA) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Team not found' 
        },
        { status: 404 }
      );
    }

    if (teamA.owner_uid !== auth.userId) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Forbidden: Not your team' 
        },
        { status: 403 }
      );
    }

    // Validate trade proposal
    const validation = await validateTradeProposal({
      league_id,
      team_a_id,
      team_b_id,
      trade_type,
      team_a_players,
      team_b_players,
      team_a_cash,
      team_b_cash,
      expires_in_hours: 48 // Default for preview
    });

    // Calculate trade value
    let tradeValue = null;
    if (validation.valid) {
      tradeValue = await calculateTradeValue({
        league_id,
        team_a_id,
        team_b_id,
        trade_type,
        team_a_players,
        team_b_players,
        team_a_cash,
        team_b_cash,
        expires_in_hours: 48
      });
    }

    return NextResponse.json({
      success: true,
      validation,
      trade_value: tradeValue
    });

  } catch (error: any) {
    console.error('Error in trade preview endpoint:', error);
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
