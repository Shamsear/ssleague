/**
 * WebSocket Client for Real-Time Updates
 * Handles connections for live auction bidding, round updates, and tiebreakers
 */

type WebSocketMessage = {
  type: 'bid' | 'round_update' | 'tiebreaker' | 'player_sold' | 'round_status';
  data: any;
  timestamp: number;
};

type MessageHandler = (message: WebSocketMessage) => void;

export class WSClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private handlers: Map<string, Set<MessageHandler>> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private isIntentionallyClosed = false;

  constructor(private url: string) {}

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('[WebSocket] Already connected');
      return;
    }

    this.isIntentionallyClosed = false;
    console.log('[WebSocket] Connecting to:', this.url);

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('[WebSocket] Connected successfully');
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        
        // Subscribe to all registered channels
        this.handlers.forEach((_, channel) => {
          this.send({
            type: 'subscribe',
            channel,
          });
          console.log(`[WebSocket] Subscribed to channel: ${channel}`);
        });
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('[WebSocket] Failed to parse message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('[WebSocket] Error:', error);
      };

      this.ws.onclose = (event) => {
        console.log('[WebSocket] Connection closed:', event.code, event.reason);
        this.stopHeartbeat();

        // Only attempt reconnection if not intentionally closed
        if (!this.isIntentionallyClosed && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
          console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
          
          setTimeout(() => this.connect(), delay);
        }
      };
    } catch (error) {
      console.error('[WebSocket] Connection failed:', error);
    }
  }

  disconnect() {
    this.isIntentionallyClosed = true;
    this.stopHeartbeat();
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnecting');
      this.ws = null;
    }
    
    console.log('[WebSocket] Disconnected');
  }

  subscribe(channel: string, handler: MessageHandler) {
    if (!this.handlers.has(channel)) {
      this.handlers.set(channel, new Set());
    }
    this.handlers.get(channel)!.add(handler);

    // Send subscription message to server only if connected
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send({
        type: 'subscribe',
        channel,
      });
      console.log(`[WebSocket] Subscribed to channel: ${channel}`);
    } else {
      // Queue subscription for when connection is established
      console.log(`[WebSocket] Queued subscription to channel: ${channel}`);
    }
  }

  unsubscribe(channel: string, handler: MessageHandler) {
    const handlers = this.handlers.get(channel);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.handlers.delete(channel);
        
        // Send unsubscribe message to server
        this.send({
          type: 'unsubscribe',
          channel,
        });
        
        console.log(`[WebSocket] Unsubscribed from channel: ${channel}`);
      }
    }
  }

  private handleMessage(message: WebSocketMessage) {
    const { type, data } = message;
    
    // Handle global messages
    const globalHandlers = this.handlers.get('*');
    if (globalHandlers) {
      globalHandlers.forEach(handler => handler(message));
    }

    // Handle type-specific messages
    const typeHandlers = this.handlers.get(type);
    if (typeHandlers) {
      typeHandlers.forEach(handler => handler(message));
    }

    // Handle channel-specific messages (e.g., round:123)
    if (data?.channel) {
      const channelHandlers = this.handlers.get(data.channel);
      if (channelHandlers) {
        channelHandlers.forEach(handler => handler(message));
      }
    }
  }

  private send(data: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn('[WebSocket] Cannot send, not connected');
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping' });
      }
    }, 30000); // Ping every 30 seconds
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// Singleton instance
let wsClient: WSClient | null = null;

export function getWSClient(): WSClient | null {
  // Only create WebSocket client in browser environment
  if (typeof window === 'undefined') {
    return null;
  }
  
  if (!wsClient) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = process.env.NEXT_PUBLIC_WS_URL || `${protocol}//${window.location.host}`;
    wsClient = new WSClient(`${host}/api/ws`);
  }
  return wsClient;
}

export function closeWSClient() {
  if (wsClient) {
    wsClient.disconnect();
    wsClient = null;
  }
}
