/**
 * Cache Invalidation Helpers
 * 
 * Call these functions after write operations to keep cache fresh
 */

import { invalidateCache } from '@/lib/firebase/cache';
import { 
  invalidateFirebaseCache, 
  invalidateActiveSeason,
  invalidateUserTeamMapping,
  invalidateTeamCaches 
} from '@/lib/firebase/smart-cache';

/**
 * Invalidate when a new transaction is created
 * Call this after creating any transaction (bid, salary, bonus, etc.)
 */
export function invalidateTransactionCache(teamId: string, seasonId: string): void {
  const cacheKey = `${teamId}_${seasonId}`;
  invalidateCache('transactions', cacheKey);
  console.log(`🗑️ [Invalidated] transactions cache for team ${teamId}`);
}

/**
 * Invalidate when team budget changes
 * Call this after bids, purchases, salary payments, etc.
 */
export function invalidateBudgetCache(teamId: string, userId: string, seasonId: string): void {
  // Invalidate team_season (contains budget info)
  invalidateTeamCaches(teamId, userId, seasonId);
  
  // Also invalidate transactions (balance_after might have changed)
  invalidateTransactionCache(teamId, seasonId);
  
  console.log(`🗑️ [Invalidated] budget caches for team ${teamId}`);
}

/**
 * Invalidate when a bid is placed
 * Call this in /api/team/bids POST
 */
export function invalidateOnBidPlaced(teamId: string, userId: string, seasonId: string): void {
  invalidateBudgetCache(teamId, userId, seasonId);
  invalidateTransactionCache(teamId, seasonId);
  console.log(`🗑️ [Invalidated] caches after bid placed`);
}

/**
 * Invalidate when a bid is deleted
 * Call this in /api/team/bids DELETE
 */
export function invalidateOnBidDeleted(teamId: string, userId: string, seasonId: string): void {
  invalidateBudgetCache(teamId, userId, seasonId);
  invalidateTransactionCache(teamId, seasonId);
  console.log(`🗑️ [Invalidated] caches after bid deleted`);
}

/**
 * Invalidate when season status changes
 * Call this when creating new season or changing isActive
 */
export function invalidateOnSeasonChanged(seasonId: string): void {
  invalidateFirebaseCache('seasons', seasonId);
  invalidateActiveSeason();
  console.log(`🗑️ [Invalidated] season caches for ${seasonId}`);
}

/**
 * Invalidate when user profile changes
 * Call this when updating user profile
 */
export function invalidateOnProfileChanged(userId: string, teamId?: string): void {
  invalidateFirebaseCache('users', userId);
  
  if (teamId) {
    invalidateFirebaseCache('teams', teamId);
    invalidateUserTeamMapping(userId);
  }
  
  console.log(`🗑️ [Invalidated] profile caches for user ${userId}`);
}

/**
 * Invalidate when team registration changes
 * Call this when team registers for a season
 */
export function invalidateOnTeamRegistered(teamId: string, userId: string, seasonId: string): void {
  // Invalidate team_season
  const teamSeasonId = `${teamId}_${seasonId}`;
  invalidateFirebaseCache('team_seasons', teamSeasonId);
  
  // Also try userId variant
  const altTeamSeasonId = `${userId}_${seasonId}`;
  invalidateFirebaseCache('team_seasons', altTeamSeasonId);
  
  // Invalidate user-to-team mapping
  invalidateUserTeamMapping(userId);
  
  console.log(`🗑️ [Invalidated] caches after team registration`);
}

/**
 * Example: Use in API route after creating transaction
 * 
 * ```typescript
 * // In /api/team/bids/route.ts
 * import { invalidateOnBidPlaced } from '@/lib/firebase/invalidate-helpers';
 * 
 * export async function POST(request: NextRequest) {
 *   // ... place bid logic ...
 *   
 *   // Invalidate caches so next request sees fresh data
 *   invalidateOnBidPlaced(teamId, userId, seasonId);
 *   
 *   return NextResponse.json({ success: true });
 * }
 * ```
 */
