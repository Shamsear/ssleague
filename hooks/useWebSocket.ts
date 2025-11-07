/**
 * React Hook for Real-time Updates via Firebase Realtime Database
 * Provides easy-to-use hooks for real-time updates
 */

import { useEffect, useCallback } from 'react';
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

    return () => {
      console.log('🔌 [Realtime DB] Disconnecting from season:', seasonId);
      unsubSquads();
      unsubWallets();
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

