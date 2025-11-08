/**
 * React Hook for Real-time Updates via Firebase Realtime Database
 * Provides easy-to-use hooks for real-time updates
 */

import { useEffect, useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  listenToSquadUpdates,
  listenToWalletUpdates,
  listenToTiebreakerBids,
  type SquadUpdateEvent,
  type WalletUpdateEvent,
  type TiebreakerBidEvent,
} from '@/lib/realtime/listeners';
import {
  invalidateSquadCaches,
  invalidateWalletCaches,
  invalidateTiebreakerCaches,
} from '@/lib/cache/invalidate';

/**
 * Hook for dashboard updates (squad and wallet changes)
 * Uses Firebase Realtime Database for instant notifications
 */
export function useDashboardWebSocket(seasonId: string | null, teamId: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!seasonId) return;

    console.log('🔌 [Realtime DB] Connecting to season:', seasonId);

    // Listen to squad updates
    const unsubSquads = listenToSquadUpdates(seasonId, (event: SquadUpdateEvent) => {
      console.log('📦 [Squad Update] Received:', event);
      invalidateSquadCaches(queryClient, seasonId, event.team_id);
    });

    // Listen to wallet updates
    const unsubWallets = listenToWalletUpdates(seasonId, (event: WalletUpdateEvent) => {
      console.log('💰 [Wallet Update] Received:', event);
      invalidateWalletCaches(queryClient, seasonId, event.team_id);
    });

    // Listen to round updates (new rounds, status changes)
    const { ref, onValue } = require('firebase/database');
    const { realtimeDb } = require('@/lib/firebase/config');
    
    const seasonRoundsRef = ref(realtimeDb, `seasons/${seasonId}/rounds`);
    
    const unsubRounds = onValue(seasonRoundsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        console.log('🎯 [Round Update] Received for season:', seasonId);
        // Invalidate dashboard queries to refetch active rounds
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['active-rounds'] });
        queryClient.invalidateQueries({ queryKey: ['team-dashboard'] });
      }
    });

    return () => {
      console.log('🔌 [Realtime DB] Disconnecting from season:', seasonId);
      unsubSquads();
      unsubWallets();
      unsubRounds();
    };
  }, [seasonId, queryClient]);

  return {
    isConnected: !!seasonId,
  };
}

/**
 * Hook for tiebreaker updates
 * Uses Firebase Realtime Database for instant bid notifications
 */
export function useTiebreakerWebSocket(
  seasonId: string | null,
  tiebreakerRound: string | null
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!seasonId || !tiebreakerRound) return;

    console.log('🔌 [Realtime DB] Connecting to tiebreaker:', tiebreakerRound);

    const unsubscribe = listenToTiebreakerBids(
      seasonId,
      tiebreakerRound,
      (event: TiebreakerBidEvent) => {
        console.log('⚖️ [Tiebreaker Bid] Received:', event);
        invalidateTiebreakerCaches(queryClient, tiebreakerRound);
      }
    );

    return () => {
      console.log('🔌 [Realtime DB] Disconnecting from tiebreaker:', tiebreakerRound);
      unsubscribe();
    };
  }, [seasonId, tiebreakerRound, queryClient]);
}

/**
 * Hook for auction/round updates
 * Uses Firebase Realtime Database for instant round updates
 */
export function useAuctionWebSocket(roundId: string | null, enabled: boolean = true) {
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!enabled || !roundId) return;

    console.log('🔌 [Realtime DB] Connecting to round:', roundId);
    setIsConnected(true);

    // Listen to round status updates
    const { ref, onValue } = require('firebase/database');
    const { realtimeDb } = require('@/lib/firebase/config');
    
    const roundRef = ref(realtimeDb, `rounds/${roundId}`);
    
    const unsubscribe = onValue(roundRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        console.log('📊 [Round Update] Received:', data);
        
        // Invalidate round-related caches
        queryClient.invalidateQueries({ queryKey: ['round-data', roundId] });
        queryClient.invalidateQueries({ queryKey: ['round-status', roundId] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      }
    });

    return () => {
      console.log('🔌 [Realtime DB] Disconnecting from round:', roundId);
      unsubscribe();
      setIsConnected(false);
    };
  }, [roundId, enabled, queryClient]);

  return {
    isConnected,
    lastMessage: null,
  };
}

/**
 * Generic WebSocket hook for custom channels
 * Uses Firebase Realtime Database
 */
export function useWebSocket(options: {
  channel: string;
  enabled?: boolean;
  onMessage?: (message: any) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!options.enabled) return;

    console.log('🔌 [Realtime DB] Connecting to channel:', options.channel);
    setIsConnected(true);
    options.onConnect?.();

    // Listen to the channel path in Firebase Realtime DB
    const { ref, onValue } = require('firebase/database');
    const { realtimeDb } = require('@/lib/firebase/config');
    
    const channelRef = ref(realtimeDb, options.channel.replace(/:/g, '/'));
    
    const unsubscribe = onValue(channelRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        console.log('📨 [Channel Update] Received:', data);
        setLastMessage(JSON.stringify(data));
        options.onMessage?.(data);
      }
    });

    return () => {
      console.log('🔌 [Realtime DB] Disconnecting from channel:', options.channel);
      unsubscribe();
      setIsConnected(false);
      options.onDisconnect?.();
    };
  }, [options.channel, options.enabled]);

  return {
    isConnected,
    lastMessage,
  };
}

