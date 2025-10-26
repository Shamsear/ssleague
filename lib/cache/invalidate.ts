/**
 * Cache Invalidation Utilities
 * Use these to invalidate React Query caches when data changes
 */

import { QueryClient } from '@tanstack/react-query';

/**
 * Invalidate all season-related caches
 */
export function invalidateSeasonCaches(queryClient: QueryClient, seasonId?: string) {
  queryClient.invalidateQueries({ queryKey: ['seasons'] });
  queryClient.invalidateQueries({ queryKey: ['cached-seasons'] });
  if (seasonId) {
    queryClient.invalidateQueries({ queryKey: ['season', seasonId] });
  }
}

/**
 * Invalidate team history caches
 */
export function invalidateTeamHistoryCaches(queryClient: QueryClient, teamId?: string) {
  queryClient.invalidateQueries({ queryKey: ['team-history'] });
  if (teamId) {
    queryClient.invalidateQueries({ queryKey: ['team-history', teamId] });
  }
  queryClient.invalidateQueries({ queryKey: ['team-stats'] });
}

/**
 * Invalidate player stats caches
 */
export function invalidatePlayerStatsCaches(queryClient: QueryClient, playerId?: string, seasonId?: string) {
  queryClient.invalidateQueries({ queryKey: ['player-stats'] });
  if (playerId) {
    queryClient.invalidateQueries({ queryKey: ['player-stats', playerId] });
  }
  if (seasonId) {
    queryClient.invalidateQueries({ queryKey: ['player-stats', { seasonId }] });
  }
  queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
}

/**
 * Invalidate auction caches
 */
export function invalidateAuctionCaches(queryClient: QueryClient, roundId?: string) {
  queryClient.invalidateQueries({ queryKey: ['auction-players'] });
  queryClient.invalidateQueries({ queryKey: ['auction-rounds'] });
  queryClient.invalidateQueries({ queryKey: ['bids'] });
  if (roundId) {
    queryClient.invalidateQueries({ queryKey: ['bids', { roundId }] });
  }
}

/**
 * Invalidate all caches (nuclear option)
 */
export function invalidateAllCaches(queryClient: QueryClient) {
  queryClient.invalidateQueries();
}
