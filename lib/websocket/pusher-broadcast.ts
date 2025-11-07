/**
 * Pusher Backend Broadcast
 * 
 * Server-side Pusher integration for broadcasting events.
 * Uses Pusher's REST API to trigger events to subscribed channels.
 */

import Pusher from 'pusher';

// Initialize Pusher server instance (singleton)
let pusherServer: Pusher | null = null;

function getPusherServer(): Pusher {
  if (!pusherServer) {
    const appId = process.env.PUSHER_APP_ID;
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const secret = process.env.PUSHER_SECRET;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'us2';

    if (!appId || !key || !secret) {
      throw new Error('Pusher credentials not configured. Set PUSHER_APP_ID, NEXT_PUBLIC_PUSHER_KEY, and PUSHER_SECRET');
    }

    pusherServer = new Pusher({
      appId,
      key,
      secret,
      cluster,
      useTLS: true,
    });
  }

  return pusherServer;
}

/**
 * Broadcast a message to a specific Pusher channel
 * 
 * @param channel - Pusher channel name (e.g., 'team:SSPSLT0001')
 * @param eventName - Event name (e.g., 'squad_update', 'wallet_update')
 * @param data - Event data to broadcast
 */
export async function broadcastPusher(
  channel: string,
  eventName: string,
  data: any
): Promise<{ success: boolean; subscribers?: number; error?: any }> {
  try {
    const pusher = getPusherServer();
    
    await pusher.trigger(channel, eventName, data);
    
    console.log(`📢 [Pusher] Broadcast to ${channel}: ${eventName}`);
    
    return { success: true };
  } catch (error) {
    console.error('[Pusher] Broadcast error:', error);
    // Don't throw - failing broadcast shouldn't break API requests
    return { success: false, error };
  }
}

/**
 * Broadcast to multiple channels at once (batch)
 */
export async function broadcastPusherBatch(
  channels: string[],
  eventName: string,
  data: any
): Promise<{ success: boolean; error?: any }> {
  try {
    const pusher = getPusherServer();
    
    await pusher.trigger(channels, eventName, data);
    
    console.log(`📢 [Pusher] Broadcast to ${channels.length} channels: ${eventName}`);
    
    return { success: true };
  } catch (error) {
    console.error('[Pusher] Batch broadcast error:', error);
    return { success: false, error };
  }
}

/**
 * Helper: Broadcast team update events
 */
export async function broadcastTeamUpdatePusher(
  teamId: string,
  updateType: 'wallet' | 'squad' | 'new_round' | 'tiebreaker',
  data: any
) {
  const eventMap = {
    wallet: 'wallet_update',
    squad: 'squad_update',
    new_round: 'new_round',
    tiebreaker: 'tiebreaker_created',
  };
  
  return broadcastPusher(`team:${teamId}`, eventMap[updateType], data);
}

/**
 * Helper: Broadcast tiebreaker bid
 */
export async function broadcastTiebreakerBidPusher(
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
  return broadcastPusher(`tiebreaker:${tiebreakerId}`, 'tiebreaker_bid', {
    tiebreaker_id: tiebreakerId,
    ...data,
  });
}

/**
 * Helper: Broadcast round bid
 */
export async function broadcastRoundBidPusher(
  roundId: string,
  data: {
    team_id: string;
    player_id: string;
    amount: number;
    action: 'placed' | 'cancelled';
  }
) {
  const eventName = data.action === 'placed' ? 'bid' : 'bid_cancelled';
  
  return broadcastPusher(`round:${roundId}`, eventName, {
    round_id: roundId,
    ...data,
  });
}

/**
 * Helper: Broadcast round status change
 */
export async function broadcastRoundStatusPusher(
  roundId: string,
  status: string,
  additionalData?: any
) {
  return broadcastPusher(`round:${roundId}`, 'round_status', {
    round_id: roundId,
    status,
    ...additionalData,
  });
}
