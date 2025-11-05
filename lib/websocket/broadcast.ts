/**
 * WebSocket Broadcast Helper - Now using Pusher
 * 
 * Sends real-time updates to connected clients via Pusher Channels.
 * Used by API routes to notify connected clients of data changes.
 */

import Pusher from 'pusher';

// Initialize Pusher (singleton pattern)
let pusherInstance: Pusher | null = null;

function getPusherInstance(): Pusher {
  if (!pusherInstance) {
    // Check if credentials are available
    const creds = {
      appId: process.env.PUSHER_APP_ID,
      key: process.env.PUSHER_KEY,
      secret: process.env.PUSHER_SECRET,
      cluster: process.env.PUSHER_CLUSTER,
    };
    
    console.log('[Pusher] Initializing with credentials:', {
      hasAppId: !!creds.appId,
      hasKey: !!creds.key,
      hasSecret: !!creds.secret,
      hasCluster: !!creds.cluster,
      cluster: creds.cluster,
      // Show first 4 chars of each credential for debugging
      appIdPrefix: creds.appId?.substring(0, 4),
      keyPrefix: creds.key?.substring(0, 4),
      secretPrefix: creds.secret?.substring(0, 4),
    });
    
    // Validate all credentials are present
    if (!creds.appId || !creds.key || !creds.secret || !creds.cluster) {
      const missing = [];
      if (!creds.appId) missing.push('PUSHER_APP_ID');
      if (!creds.key) missing.push('PUSHER_KEY');
      if (!creds.secret) missing.push('PUSHER_SECRET');
      if (!creds.cluster) missing.push('PUSHER_CLUSTER');
      
      console.error(`❌ [Pusher] Missing credentials: ${missing.join(', ')}`);
      console.error('❌ [Pusher] CRITICAL: Broadcasts will FAIL. Restart dev server to load .env.local');
      throw new Error(`Missing Pusher credentials: ${missing.join(', ')}`);
    }
    
    pusherInstance = new Pusher({
      appId: creds.appId,
      key: creds.key,
      secret: creds.secret,
      cluster: creds.cluster,
      useTLS: true,
    });
    
    console.log('✅ [Pusher] Instance created successfully');
  }
  return pusherInstance;
}

/**
 * Sanitize channel name for Pusher compatibility
 * Pusher doesn't allow colons (:) in channel names
 * Replace with hyphens (-)
 */
function sanitizeChannelName(channel: string): string {
  return channel.replace(/:/g, '-');
}

/**
 * Broadcast a message to all clients subscribed to a channel
 * 
 * @param channel - Pusher channel (e.g., 'tiebreaker:123', 'team:456')
 * @param data - Message data to broadcast (should include 'type' and 'data' fields)
 * @returns Broadcast result with success status
 */
export async function broadcastWebSocket(
  channel: string, 
  data: any
): Promise<{ success: boolean; error?: any }> {
  try {
    const pusher = getPusherInstance();
    
    // Sanitize channel name for Pusher (no colons allowed)
    const sanitizedChannel = sanitizeChannelName(channel);
    
    // Extract event type from data, default to 'update'
    const eventType = data.type || 'update';
    const eventData = data.data || data;
    
    // Trigger event on Pusher
    await pusher.trigger(sanitizedChannel, eventType, eventData);
    
    console.log(`📢 [Pusher] Broadcast to ${sanitizedChannel}, event: ${eventType}`);
    return { success: true };
  } catch (error) {
    console.error('[Pusher] Broadcast error:', error);
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
