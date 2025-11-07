/**
 * Pusher Client Adapter
 * 
 * Adapts Pusher to work with our existing WebSocket hook system.
 * This allows us to use Pusher's infrastructure while keeping our
 * existing hook APIs unchanged.
 */

import Pusher from 'pusher-js';

type WebSocketMessage = {
  type: 'bid' | 'round_update' | 'tiebreaker' | 'player_sold' | 'round_status' | 
        'squad_update' | 'wallet_update' | 'tiebreaker_bid' | 'new_round' | 'tiebreaker_created';
  data: any;
  timestamp?: number;
};

type MessageHandler = (message: WebSocketMessage) => void;

export class PusherWSClient {
  private pusher: Pusher | null = null;
  private channels: Map<string, any> = new Map();
  private handlers: Map<string, Set<MessageHandler>> = new Map();
  private isConnectedFlag = false;

  constructor(
    private appKey: string,
    private cluster: string = 'us2'
  ) {}

  connect() {
    if (this.pusher) {
      console.log('[Pusher] Already connected');
      return;
    }

    console.log('[Pusher] Connecting...');

    this.pusher = new Pusher(this.appKey, {
      cluster: this.cluster,
      encrypted: true,
    });

    this.pusher.connection.bind('connected', () => {
      console.log('[Pusher] Connected successfully');
      this.isConnectedFlag = true;
      
      // Resubscribe to all channels
      this.handlers.forEach((_, channelName) => {
        this.subscribeChannel(channelName);
      });
    });

    this.pusher.connection.bind('disconnected', () => {
      console.log('[Pusher] Disconnected');
      this.isConnectedFlag = false;
    });

    this.pusher.connection.bind('error', (err: any) => {
      console.error('[Pusher] Error:', err);
    });
  }

  disconnect() {
    if (this.pusher) {
      this.channels.forEach(channel => {
        channel.unbind_all();
      });
      this.pusher.disconnect();
      this.pusher = null;
      this.channels.clear();
      this.isConnectedFlag = false;
      console.log('[Pusher] Disconnected');
    }
  }

  subscribe(channelName: string, handler: MessageHandler) {
    if (!this.handlers.has(channelName)) {
      this.handlers.set(channelName, new Set());
    }
    this.handlers.get(channelName)!.add(handler);

    // Subscribe to Pusher channel if connected
    if (this.pusher) {
      this.subscribeChannel(channelName);
    } else {
      console.log(`[Pusher] Queued subscription to: ${channelName}`);
    }
  }

  unsubscribe(channelName: string, handler: MessageHandler) {
    const handlers = this.handlers.get(channelName);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.handlers.delete(channelName);
        
        // Unsubscribe from Pusher channel
        const channel = this.channels.get(channelName);
        if (channel) {
          channel.unbind_all();
          this.pusher?.unsubscribe(channelName);
          this.channels.delete(channelName);
          console.log(`[Pusher] Unsubscribed from: ${channelName}`);
        }
      }
    }
  }

  private subscribeChannel(channelName: string) {
    if (this.channels.has(channelName)) {
      return; // Already subscribed
    }

    const channel = this.pusher!.subscribe(channelName);
    this.channels.set(channelName, channel);

    // Bind to all event types
    const eventTypes = [
      'squad_update',
      'wallet_update',
      'tiebreaker_bid',
      'new_round',
      'tiebreaker_created',
      'bid',
      'player_sold',
      'round_status',
      'round_update',
    ];

    eventTypes.forEach(eventType => {
      channel.bind(eventType, (data: any) => {
        const message: WebSocketMessage = {
          type: eventType as any,
          data,
          timestamp: Date.now(),
        };
        this.handleMessage(channelName, message);
      });
    });

    console.log(`[Pusher] Subscribed to: ${channelName}`);
  }

  private handleMessage(channelName: string, message: WebSocketMessage) {
    const handlers = this.handlers.get(channelName);
    if (handlers) {
      handlers.forEach(handler => handler(message));
    }
  }

  isConnected(): boolean {
    return this.isConnectedFlag;
  }
}

// Singleton instance
let pusherClient: PusherWSClient | null = null;

export function getPusherClient(): PusherWSClient | null {
  // Only create Pusher client in browser environment
  if (typeof window === 'undefined') {
    return null;
  }
  
  if (!pusherClient) {
    const appKey = process.env.NEXT_PUBLIC_PUSHER_KEY;
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || 'us2';
    
    if (!appKey) {
      console.error('[Pusher] NEXT_PUBLIC_PUSHER_KEY not configured');
      return null;
    }
    
    pusherClient = new PusherWSClient(appKey, cluster);
  }
  
  return pusherClient;
}

export function closePusherClient() {
  if (pusherClient) {
    pusherClient.disconnect();
    pusherClient = null;
  }
}
