/**
 * React Hook for WebSocket Connections
 * Provides easy-to-use hooks for real-time updates
 */

import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getPusherClient } from '@/lib/websocket/pusher-client';
// import { getWSClient } from '@/lib/websocket/client'; // Fallback to custom WebSocket

type UseWebSocketOptions = {
  channel: string;
  enabled?: boolean;
  onMessage?: (data: any) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
};

/**
 * Hook for subscribing to WebSocket channels
 * Automatically connects/disconnects based on component lifecycle
 */
export function useWebSocket({
  channel,
  enabled = true,
  onMessage,
  onConnect,
  onDisconnect,
}: UseWebSocketOptions) {
  const wsClient = useRef<ReturnType<typeof getWSClient>>(null);
  const handlerRef = useRef(onMessage);

  // Initialize Pusher client only in browser
  useEffect(() => {
    if (typeof window !== 'undefined' && !wsClient.current) {
      wsClient.current = getPusherClient();
    }
  }, []);

  // Update handler ref when it changes
  useEffect(() => {
    handlerRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    if (!enabled || !channel || !wsClient.current) {
      return;
    }
    const client = wsClient.current;

    // Connect if not already connected
    if (!client.isConnected()) {
      client.connect();
      onConnect?.();
    }

    // Subscribe to channel
    const handler = (message: any) => {
      handlerRef.current?.(message);
    };

    client.subscribe(channel, handler);

    // Cleanup on unmount
    return () => {
      client.unsubscribe(channel, handler);
      onDisconnect?.();
    };
  }, [channel, enabled, onConnect, onDisconnect]);

  return {
    isConnected: wsClient.current?.isConnected() ?? false,
  };
}

/**
 * Hook for live auction updates
 * Automatically invalidates React Query cache when bid updates arrive
 */
export function useAuctionWebSocket(roundId: string | undefined, enabled: boolean = true) {
  const queryClient = useQueryClient();

  const { isConnected } = useWebSocket({
    channel: `round:${roundId}`,
    enabled: enabled && !!roundId,
    onMessage: useCallback((message: any) => {
      console.log('[Auction WS] Received:', message);

      switch (message.type) {
        case 'bid':
          // Invalidate bids query to refetch latest data
          queryClient.invalidateQueries({ queryKey: ['bids'] });
          queryClient.invalidateQueries({ queryKey: ['round', roundId] });
          break;

        case 'player_sold':
          // Player was sold, update relevant queries
          queryClient.invalidateQueries({ queryKey: ['bids'] });
          queryClient.invalidateQueries({ queryKey: ['round', roundId] });
          queryClient.invalidateQueries({ queryKey: ['footballplayers'] });
          break;

        case 'round_status':
          // Round status changed (started, paused, completed)
          queryClient.invalidateQueries({ queryKey: ['round', roundId] });
          queryClient.invalidateQueries({ queryKey: ['roundStatus', roundId] });
          break;

        case 'round_update':
          // General round update
          queryClient.invalidateQueries({ queryKey: ['round', roundId] });
          break;
      }
    }, [queryClient, roundId]),
  });

  return { isConnected };
}

/**
 * Hook for tiebreaker updates
 */
export function useTiebreakerWebSocket(tiebreakerId: string | undefined, enabled: boolean = true) {
  const queryClient = useQueryClient();

  const { isConnected } = useWebSocket({
    channel: `tiebreaker:${tiebreakerId}`,
    enabled: enabled && !!tiebreakerId,
    onMessage: useCallback((message: any) => {
      console.log('[Tiebreaker WS] Received:', message);

      switch (message.type) {
        case 'tiebreaker_bid':
          // Team submitted a new tiebreaker bid
          console.log('[Tiebreaker WS] New bid submitted:', message.data);
          queryClient.invalidateQueries({ queryKey: ['tiebreaker', tiebreakerId] });
          queryClient.invalidateQueries({ queryKey: ['tiebreakers'] });
          break;

        case 'tiebreaker_finalized':
          // Tiebreaker was resolved
          console.log('[Tiebreaker WS] Tiebreaker finalized:', message.data);
          queryClient.invalidateQueries({ queryKey: ['tiebreaker', tiebreakerId] });
          queryClient.invalidateQueries({ queryKey: ['tiebreakers'] });
          queryClient.invalidateQueries({ queryKey: ['dashboard'] });
          break;

        default:
          // Fallback: invalidate tiebreaker queries
          queryClient.invalidateQueries({ queryKey: ['tiebreaker', tiebreakerId] });
          queryClient.invalidateQueries({ queryKey: ['tiebreakers'] });
      }
    }, [queryClient, tiebreakerId]),
  });

  return { isConnected };
}

/**
 * Hook for dashboard updates (bids, wallet, etc.)
 */
export function useDashboardWebSocket(teamId: string | undefined, enabled: boolean = true) {
  const queryClient = useQueryClient();

  const { isConnected } = useWebSocket({
    channel: `team:${teamId}`,
    enabled: enabled && !!teamId,
    onMessage: useCallback((message: any) => {
      console.log('[Dashboard WS] Received:', message);

      switch (message.type) {
        case 'squad_update':
          // Player was acquired or removed from squad
          console.log('[Dashboard WS] Squad updated:', message.data);
          queryClient.invalidateQueries({ queryKey: ['dashboard'] });
          queryClient.invalidateQueries({ queryKey: ['team-players', teamId] });
          queryClient.invalidateQueries({ queryKey: ['team-squad'] });
          queryClient.invalidateQueries({ queryKey: ['footballplayers'] });
          break;

        case 'wallet_update':
          // Team budget/balance changed
          console.log('[Dashboard WS] Wallet updated:', message.data);
          queryClient.invalidateQueries({ queryKey: ['dashboard'] });
          queryClient.invalidateQueries({ queryKey: ['team-wallet', teamId] });
          queryClient.invalidateQueries({ queryKey: ['team-seasons', teamId] });
          queryClient.invalidateQueries({ queryKey: ['transactions', teamId] });
          break;

        case 'new_round':
          // New auction round started
          console.log('[Dashboard WS] New round:', message.data);
          queryClient.invalidateQueries({ queryKey: ['dashboard'] });
          queryClient.invalidateQueries({ queryKey: ['rounds'] });
          queryClient.invalidateQueries({ queryKey: ['auction-rounds'] });
          break;

        case 'tiebreaker_created':
          // Tiebreaker created for this team
          console.log('[Dashboard WS] Tiebreaker created:', message.data);
          queryClient.invalidateQueries({ queryKey: ['dashboard'] });
          queryClient.invalidateQueries({ queryKey: ['tiebreakers'] });
          break;

        default:
          // Fallback: invalidate general dashboard queries
          queryClient.invalidateQueries({ queryKey: ['dashboard'] });
          queryClient.invalidateQueries({ queryKey: ['bids'] });
          queryClient.invalidateQueries({ queryKey: ['team-history'] });
      }
    }, [queryClient, teamId]),
  });

  return { isConnected };
}
