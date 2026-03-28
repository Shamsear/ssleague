import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth-helper';
import { 
  respondToTrade,
  getTradeDetails
} from '@/lib/fantasy/trade-processor';

/**
 * POST /api/fantasy/trades/respond
 * Accept or reject a trade proposal
 * 
 * Request Body:
 * {
 *   trade_id: string;
 *   team_id: string; // Receiver team (must be authenticated user's team)
 *   action: 'accept' | 'reject';
 *   response_message?: string;
 * }
 * 
 * Response:
 * {
 *   success: boolean;
 *   action: 'accepted' | 'rejected';
 *   message: string;
 *   trade_details?: {
 *     team_a_players: string[];
 *     team_b_players: string[];
 *     team_a_cash: number;
 *     team_b_cash: number;
 *   };
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
    const { trade_id, team_id, action, response_message } = body;

    // Validate required parameters
    if (!trade_id || !team_id || !action) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Missing required parameters: trade_id, team_id, action' 
        },
        { status: 400 }
      );
    }

    if (!['accept', 'reject'].includes(action)) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Invalid action. Must be "accept" or "reject"' 
        },
        { status: 400 }
      );
    }

    // Import fantasySql
    const { fantasySql } = await import('@/lib/neon/fantasy-config');

    // Verify team ownership (responder must own team_id)
    const [team] = await fantasySql`
      SELECT team_id, owner_uid, league_id, team_name
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
          error: 'Forbidden: You can only respond to trades for your own team' 
        },
        { status: 403 }
      );
    }

    // Get trade details to verify team is receiver
    const trade = await getTradeDetails(trade_id);

    if (trade.team_b_id !== team_id) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Forbidden: Only the receiver can respond to this trade' 
        },
        { status: 403 }
      );
    }

    if (trade.league_id !== team.league_id) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Trade not in your league' 
        },
        { status: 400 }
      );
    }

    // Respond to the trade
    const result = await respondToTrade(
      trade_id,
      team_id,
      action,
      response_message
    );

    // Log the response
    console.log('Trade response:', {
      trade_id,
      action,
      team: team.team_name,
      success: result.success
    });

    // TODO: Send notification to team A (implement in future)
    // await sendTradeResponseNotification(trade.team_a_id, trade_id, action);

    // Return success response
    return NextResponse.json({
      success: result.success,
      action: result.action,
      message: result.message,
      trade_details: result.trade_details
    });

  } catch (error: any) {
    console.error('Error in respond to trade endpoint:', error);
    
    // Return appropriate error status
    const status = error.message.includes('not found') ? 404 :
                   error.message.includes('expired') ? 410 :
                   error.message.includes('no longer valid') ? 400 :
                   500;

    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Failed to respond to trade',
        details: error.message 
      },
      { status }
    );
  }
}

/**
 * GET /api/fantasy/trades/respond
 * Get trade details for review before responding
 * 
 * Query Parameters:
 * - trade_id: string
 * - team_id: string
 * 
 * Response:
 * {
 *   success: boolean;
 *   trade: {
 *     trade_id: string;
 *     league_id: string;
 *     team_a_id: string;
 *     team_b_id: string;
 *     team_a_name: string;
 *     team_b_name: string;
 *     trade_type: 'sale' | 'swap';
 *     team_a_players: string[];
 *     team_b_players: string[];
 *     team_a_cash: number;
 *     team_b_cash: number;
 *     status: string;
 *     proposed_at: string;
 *     expires_at: string;
 *   };
 *   can_respond: boolean;
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
    const trade_id = searchParams.get('trade_id');
    const team_id = searchParams.get('team_id');

    if (!trade_id || !team_id) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Missing required parameters: trade_id, team_id' 
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

    // Get trade details
    const trade = await getTradeDetails(trade_id);

    // Check if user can respond
    const canRespond = 
      trade.team_b_id === team_id &&
      trade.status === 'pending' &&
      new Date() < new Date(trade.expires_at);

    return NextResponse.json({
      success: true,
      trade: {
        trade_id: trade.trade_id,
        league_id: trade.league_id,
        team_a_id: trade.team_a_id,
        team_b_id: trade.team_b_id,
        team_a_name: trade.team_a_name,
        team_b_name: trade.team_b_name,
        trade_type: trade.trade_type,
        team_a_players: trade.team_a_players,
        team_b_players: trade.team_b_players,
        team_a_cash: parseFloat(trade.team_a_cash),
        team_b_cash: parseFloat(trade.team_b_cash),
        status: trade.status,
        proposed_at: trade.proposed_at,
        expires_at: trade.expires_at,
        responded_at: trade.responded_at,
        response_message: trade.response_message
      },
      can_respond: canRespond
    });

  } catch (error: any) {
    console.error('Error in get trade details endpoint:', error);
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
