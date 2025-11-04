/**
 * Pusher Client for Real-Time Updates
 * Handles connections for live auction bidding, round updates, and tiebreakers
 */

import Pusher from 'pusher-js';

type WebSocketMessage = {
  type: 'bid' | 'round_update' | 'tiebreaker' | 'player_sold' | 'round_status';
  data: any;
  timestamp: number;
};

type MessageHandler = (message: WebSocketMessage) => void;

/**
 * Sanitize channel name for Pusher compatibility
 * Pusher doesn't allow colons (:) in channel names
 * Replace with hyphens (-)
 */
function sanitizeChannelName(channel: string): string {
  return channel.replace(/:/g, '-');
}

export class WSClient {
  private pusher: Pusher | null = null;
  private channels: Map<string, any> = new Map();
  private handlers: Map<string, Set<MessageHandler>> = new Map();

  constructor(private key: string, private cluster: string) {}

  connect() {
    if (this.pusher) {
      console.log('[Pusher] Already connected');
      return;
    }

    console.log('[Pusher] Connecting...');

    try {
      this.pusher = new Pusher(this.key, {
        cluster: this.cluster,
      });

      this.pusher.connection.bind('connected', () => {
        console.log('[Pusher] Connected successfully');
      });

      this.pusher.connection.bind('error', (err: any) => {
        console.error('[Pusher] Connection error:', err);
      });

      this.pusher.connection.bind('disconnected', () => {
        console.log('[Pusher] Disconnected');
      });

    } catch (error) {
      console.error('[Pusher] Connection failed:', error);
    }
  }

  disconnect() {
    if (this.pusher) {
      this.pusher.disconnect();
      this.pusher = null;
    }
    
    this.channels.clear();
    this.handlers.clear();
    
    console.log('[Pusher] Disconnected');
  }

  subscribe(channel: string, handler: MessageHandler) {
    if (!this.pusher) {
      this.connect();
    }

    // Sanitize channel name for Pusher (no colons allowed)
    const sanitizedChannel = sanitizeChannelName(channel);

    if (!this.handlers.has(channel)) {
      this.handlers.set(channel, new Set());
    }
    this.handlers.get(channel)!.add(handler);

    // Subscribe to Pusher channel if not already subscribed
    if (!this.channels.has(channel)) {
      const pusherChannel = this.pusher!.subscribe(sanitizedChannel);
      this.channels.set(channel, pusherChannel);

      // Bind to all event types that might come through this channel
      const eventTypes = [
        'bid',
        'bid_cancelled',
        'player_sold',
        'round_status',
        'round_updated',
        'round_update',
        'tiebreaker_bid',
        'tiebreaker_withdraw',
        'tiebreaker_finalized',
        'tiebreaker',
        'wallet_update',
        'squad_update',
        'new_round',
        'tiebreaker_created',
        'draft_status_update',
        'update', // generic fallback
      ];

      eventTypes.forEach((eventType) => {
        pusherChannel.bind(eventType, (data: any) => {
          const message: WebSocketMessage = {
            type: eventType as any,
            data,
            timestamp: Date.now(),
          };
          this.handleMessage(message, channel);
        });
      });

      console.log(`[Pusher] Subscribed to channel: ${sanitizedChannel}`);
    }
  }

  unsubscribe(channel: string, handler: MessageHandler) {
    const sanitizedChannel = sanitizeChannelName(channel);
    const handlers = this.handlers.get(channel);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.handlers.delete(channel);
        
        // Unsubscribe from Pusher channel
        if (this.pusher && this.channels.has(channel)) {
          this.pusher.unsubscribe(sanitizedChannel);
          this.channels.delete(channel);
        }
        
        console.log(`[Pusher] Unsubscribed from channel: ${sanitizedChannel}`);
      }
    }
  }

  private handleMessage(message: WebSocketMessage, channel: string) {
    // Notify all handlers subscribed to this specific channel
    const channelHandlers = this.handlers.get(channel);
    if (channelHandlers) {
      channelHandlers.forEach(handler => handler(message));
    }
  }

  isConnected(): boolean {
    return this.pusher?.connection.state === 'connected';
  }
}

// Singleton instance
let wsClient: WSClient | null = null;

export function getWSClient(): WSClient {
  // Only create client in browser environment
  if (typeof window === 'undefined') {
    // Return a mock client for SSR
    return {
      connect: () => {},
      disconnect: () => {},
      subscribe: () => {},
      unsubscribe: () => {},
      isConnected: () => false,
    } as any;
  }
  
  if (!wsClient) {
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY!;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER!;
    wsClient = new WSClient(key, cluster);
    wsClient.connect();
  }
  return wsClient;
}

export function closeWSClient() {
  if (wsClient) {
    wsClient.disconnect();
    wsClient = null;
  }
}
