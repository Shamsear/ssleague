/**
 * WebSocket Integration Examples
 * Copy these patterns into your API routes to enable real-time updates
 * 
 * NOTE: These are examples only - not meant to be imported.
 * Copy the relevant code into your actual API route files.
 */

// ============================================
// EXAMPLE 1: Auction Bid API
// ============================================

// File: app/api/team/bids/route.ts or app/api/auction/bids/route.ts

import { NextRequest, NextResponse } from 'next/server';

// Add this at the top of the file
declare global {
  var wsBroadcast: ((channel: string, data: any) => void) | undefined;
}

async function exampleBidPost(request: NextRequest) {
  try {
    const body = await request.json();
    const { team_id, player_id, round_id, amount } = body;

    // Your existing bid placement logic here
    // ... validate, check wallet, save to database, etc.

    const newBid = {
      id: 'bid_123',
      team_id,
      player_id,
      round_id,
      amount,
      created_at: new Date().toISOString(),
    };

    // ✅ ADD THIS: Broadcast to WebSocket clients
    if (global.wsBroadcast) {
      global.wsBroadcast(`round:${round_id}`, {
        type: 'bid',
        data: {
          bid: newBid,
          player: { id: player_id, name: 'Player Name' },
          team: { id: team_id, name: 'Team Name' },
        },
      });
      console.log(`📢 Broadcast bid to round:${round_id}`);
    }

    return NextResponse.json({ success: true, data: newBid });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// ============================================
// EXAMPLE 2: Tiebreaker Bid API
// ============================================

// File: app/api/tiebreakers/[id]/bid/route.ts

async function exampleTiebreakerPost(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const tiebreakerId = params.id;
    const body = await request.json();
    const { team_id, amount } = body;

    // Your existing tiebreaker bid logic
    const newBid = {
      id: 'tiebreaker_bid_123',
      tiebreaker_id: tiebreakerId,
      team_id,
      amount,
      created_at: new Date().toISOString(),
    };

    // ✅ ADD THIS: Broadcast to WebSocket clients
    if (global.wsBroadcast) {
      global.wsBroadcast(`tiebreaker:${tiebreakerId}`, {
        type: 'tiebreaker',
        data: {
          bid: newBid,
          team: { id: team_id, name: 'Team Name' },
        },
      });
      console.log(`📢 Broadcast tiebreaker bid to tiebreaker:${tiebreakerId}`);
    }

    return NextResponse.json({ success: true, data: newBid });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// ============================================
// EXAMPLE 3: Round Status Update
// ============================================

// File: app/api/auction/rounds/[id]/status/route.ts

async function exampleRoundStatusPatch(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const roundId = params.id;
    const body = await request.json();
    const { status } = body; // 'active', 'paused', 'completed'

    // Your existing status update logic
    const updatedRound = {
      id: roundId,
      status,
      updated_at: new Date().toISOString(),
    };

    // ✅ ADD THIS: Broadcast to WebSocket clients
    if (global.wsBroadcast) {
      global.wsBroadcast(`round:${roundId}`, {
        type: 'round_status',
        data: {
          status,
          round: updatedRound,
          message: `Round ${status}`,
        },
      });
      console.log(`📢 Broadcast status change to round:${roundId}`);
    }

    return NextResponse.json({ success: true, data: updatedRound });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// ============================================
// EXAMPLE 4: Player Sold
// ============================================

// File: app/api/auction/players/[id]/sell/route.ts

async function examplePlayerSoldPost(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const playerId = params.id;
    const body = await request.json();
    const { team_id, round_id, final_amount } = body;

    // Your existing player sold logic
    const soldPlayer = {
      player_id: playerId,
      team_id,
      amount: final_amount,
      sold_at: new Date().toISOString(),
    };

    // ✅ ADD THIS: Broadcast to WebSocket clients
    if (global.wsBroadcast) {
      global.wsBroadcast(`round:${round_id}`, {
        type: 'player_sold',
        data: {
          player: { id: playerId, name: 'Player Name' },
          team: { id: team_id, name: 'Winning Team' },
          amount: final_amount,
        },
      });
      console.log(`📢 Broadcast player sold to round:${round_id}`);
    }

    return NextResponse.json({ success: true, data: soldPlayer });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// ============================================
// EXAMPLE 5: Dashboard Wallet Update
// ============================================

// File: app/api/team/wallet/route.ts

async function exampleWalletPatch(request: NextRequest) {
  try {
    const body = await request.json();
    const { team_id, amount, transaction_type } = body;

    // Your existing wallet update logic
    const updatedWallet = {
      team_id,
      balance: 1000, // new balance
      transaction: {
        type: transaction_type,
        amount,
        timestamp: new Date().toISOString(),
      },
    };

    // ✅ ADD THIS: Broadcast to WebSocket clients
    if (global.wsBroadcast) {
      global.wsBroadcast(`team:${team_id}`, {
        type: 'wallet_update',
        data: {
          balance: updatedWallet.balance,
          transaction: updatedWallet.transaction,
        },
      });
      console.log(`📢 Broadcast wallet update to team:${team_id}`);
    }

    return NextResponse.json({ success: true, data: updatedWallet });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// ============================================
// EXAMPLE 6: General Notification
// ============================================

// File: Any API route where you want to send notifications

function sendNotification(teamId: string, message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') {
  if (global.wsBroadcast) {
    global.wsBroadcast(`team:${teamId}`, {
      type: 'notification',
      data: {
        message,
        type,
        timestamp: new Date().toISOString(),
      },
    });
  }
}

// Usage:
// sendNotification(team_id, 'Your bid was successful!', 'success');
// sendNotification(team_id, 'Round is starting in 2 minutes', 'info');

// ============================================
// EXAMPLE 7: Batch Broadcast (Multiple Channels)
// ============================================

function broadcastToMultipleChannels(channels: string[], data: any) {
  if (!global.wsBroadcast) return;
  
  channels.forEach(channel => {
    global.wsBroadcast!(channel, data);
  });
  
  console.log(`📢 Broadcast to ${channels.length} channels`);
}

// Usage:
// broadcastToMultipleChannels(
//   ['round:123', 'team:456', 'team:789'],
//   {
//     type: 'round_update',
//     data: { message: 'Round ending soon!' }
//   }
// );

// ============================================
// HELPER: Safe Broadcast Function
// ============================================

/**
 * Safely broadcast to WebSocket without throwing errors
 */
function safeBroadcast(channel: string, data: any) {
  try {
    if (global.wsBroadcast) {
      global.wsBroadcast(channel, {
        ...data,
        timestamp: data.timestamp || Date.now(),
      });
      return true;
    }
    return false;
  } catch (error) {
    console.error('Failed to broadcast:', error);
    return false;
  }
}

// ============================================
// CHANNEL NAMING CONVENTIONS
// ============================================

/*
Use these channel patterns for consistency:

1. Round updates:       `round:${roundId}`
2. Tiebreaker updates:  `tiebreaker:${tiebreakerId}`
3. Team updates:        `team:${teamId}`
4. Season updates:      `season:${seasonId}`
5. Global updates:      `global` or `*`

Examples:
- `round:123` - All updates for auction round 123
- `tiebreaker:456` - All updates for tiebreaker 456
- `team:789` - Dashboard updates for team 789
- `season:16` - Season-wide announcements
- `*` - Broadcast to everyone (use sparingly!)
*/

// ============================================
// MESSAGE TYPE CONVENTIONS
// ============================================

/*
Use these message types for consistency:

Auction:
- 'bid' - New bid placed
- 'player_sold' - Player sold to team
- 'round_status' - Round started/paused/ended
- 'round_update' - General round update

Tiebreaker:
- 'tiebreaker' - Tiebreaker bid placed
- 'tiebreaker_winner' - Winner announced

Dashboard:
- 'wallet_update' - Wallet balance changed
- 'notification' - General notification
- 'player_update' - Player roster change

System:
- 'connected' - Client connected (auto-sent)
- 'subscribed' - Subscribed to channel (auto-sent)
- 'ping'/'pong' - Heartbeat (auto-handled)
*/

export {};
