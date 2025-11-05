/**
 * WebSocket Broadcast Helper
 * 
 * Sends real-time updates to WebSocket clients via HTTP endpoint.
 * Used by API routes to notify connected clients of data changes.
 */

/**
 * Broadcast a message to all clients subscribed to a channel
 * 
 * @param channel - WebSocket channel (e.g., 'tiebreaker:123', 'team:456')
 * @param data - Message data to broadcast
 * @returns Broadcast result with success status and subscriber count
 */
export async function broadcastWebSocket(
  channel: string, 
  data: any
): Promise<{ success: boolean; subscribers?: number; error?: any }> {
  try {
    const wsPort = process.env.WS_PORT || 3001;
    const response = await fetch(`http://localhost:${wsPort}/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel, data }),
    });
    
    if (!response.ok) {
      throw new Error(`Broadcast failed: ${response.statusText}`);
    }
    
    const result = await response.json();
    console.log(`📢 [WebSocket] Broadcast to ${channel}: ${result.subscribers || 0} subscribers`);
    return result;
  } catch (error) {
    console.error('[WebSocket] Broadcast error:', error);
    // Don't throw - failing broadcast shouldn't break API requests
    return { success: false, error };
  }
}

/**
 * Common broadcast message types
 */
export const BroadcastType = {
  // Tiebreaker events
  TIEBREAKER_BID: 'tiebreaker_bid',
  TIEBREAKER_WITHDRAW: 'tiebreaker_withdraw',
  TIEBREAKER_FINALIZED: 'tiebreaker_finalized',
  
  // Auction round events
  BID_PLACED: 'bid',
  BID_CANCELLED: 'bid_cancelled',
  PLAYER_SOLD: 'player_sold',
  ROUND_STATUS: 'round_status',
  ROUND_UPDATED: 'round_updated',
  
  // Team dashboard events
  WALLET_UPDATE: 'wallet_update',
  SQUAD_UPDATE: 'squad_update',
  NEW_ROUND: 'new_round',
  TIEBREAKER_CREATED: 'tiebreaker_created',
  
  // Admin events
  TEAM_BID_UPDATE: 'team_bid_update',
  ROUND_EXTENDED: 'round_extended',
  
  // Fixture events
  SCORE_UPDATE: 'score_update',
  GOAL_SCORED: 'goal_scored',
} as const;

/**
 * Helper functions for common broadcast patterns
 */

/** Broadcast tiebreaker bid update */
export async function broadcastTiebreakerBid(
  tiebreakerId: string,
  data: {
    team_id: string;
    team_name: string;
    bid_amount: number;
    player_name?: string;
    teams_remaining?: number;
    is_winner?: boolean;
  }
) {
  return broadcastWebSocket(`tiebreaker:${tiebreakerId}`, {
    type: BroadcastType.TIEBREAKER_BID,
    data: {
      tiebreaker_id: tiebreakerId,
      ...data,
    },
  });
}

/** Broadcast round bid update */
export async function broadcastRoundBid(
  roundId: string,
  data: {
    team_id: string;
    player_id: string;
    amount: number;
    action: 'placed' | 'cancelled';
  }
) {
  return broadcastWebSocket(`round:${roundId}`, {
    type: data.action === 'placed' ? BroadcastType.BID_PLACED : BroadcastType.BID_CANCELLED,
    data: {
      round_id: roundId,
      ...data,
    },
  });
}

/** Broadcast team dashboard update */
export async function broadcastTeamUpdate(
  teamId: string,
  updateType: 'wallet' | 'squad' | 'new_round' | 'tiebreaker',
  data: any
) {
  const typeMap = {
    wallet: BroadcastType.WALLET_UPDATE,
    squad: BroadcastType.SQUAD_UPDATE,
    new_round: BroadcastType.NEW_ROUND,
    tiebreaker: BroadcastType.TIEBREAKER_CREATED,
  };
  
  return broadcastWebSocket(`team:${teamId}`, {
    type: typeMap[updateType],
    data,
  });
}

/** Broadcast round status change */
export async function broadcastRoundStatus(
  roundId: string,
  status: string,
  additionalData?: any
) {
  return broadcastWebSocket(`round:${roundId}`, {
    type: BroadcastType.ROUND_STATUS,
    data: {
      round_id: roundId,
      status,
      ...additionalData,
    },
  });
}
