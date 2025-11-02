import { useEffect, useRef, useCallback } from 'react';
import { getWSClient } from '@/lib/websocket/client';

interface DraftStatusUpdate {
  league_id: string;
  draft_status: 'pending' | 'active' | 'closed';
  draft_opens_at?: string | null;
  draft_closes_at?: string | null;
  auto_opened?: boolean;
  auto_closed?: boolean;
}

/**
 * Hook to listen for real-time draft status updates via WebSocket
 * Automatically subscribes to the league's draft channel
 * Calls onStatusChange callback when draft status changes
 */
export function useDraftWebSocket(
  leagueId?: string,
  onStatusChange?: (update: DraftStatusUpdate) => void
) {
  const wsClient = useRef(getWSClient());
  const handlerRef = useRef<((message: any) => void) | null>(null);

  const handleMessage = useCallback((message: any) => {
    if (message.type === 'draft_status_update') {
      console.log('🔔 Draft status update received:', message.data);
      
      if (onStatusChange) {
        onStatusChange(message.data);
      }
      // Note: If no callback provided, do nothing. Pages should provide callbacks.
    }
  }, [onStatusChange]);

  useEffect(() => {
    if (!leagueId || !wsClient.current) return;

    const client = wsClient.current;
    const channel = `league:${leagueId}:draft`;

    // Connect if not already connected
    if (!client.isConnected()) {
      client.connect();
    }

    // Store handler reference
    handlerRef.current = handleMessage;

    // Subscribe to league draft channel
    client.subscribe(channel, handleMessage);

    console.log(`📡 Subscribed to WebSocket channel: ${channel}`);

    // Cleanup on unmount
    return () => {
      if (client && handlerRef.current) {
        client.unsubscribe(channel, handlerRef.current);
        console.log(`📡 Unsubscribed from WebSocket channel: ${channel}`);
      }
    };
  }, [leagueId, handleMessage]);

  return wsClient.current;
}
