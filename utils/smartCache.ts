// Smart Cache System with Automatic Invalidation
// Automatically invalidates cache when data is created, updated, or deleted

import { getCachedData, setCachedData, clearCache, clearCacheByPrefix } from './cache';

// Cache key prefixes for different data types
export const CACHE_KEYS = {
  PLAYERS_LIST: 'players_list',
  PLAYERS_BY_POSITION: 'players_position_',
  PLAYERS_BY_TEAM: 'players_team_',
  PLAYERS_ELIGIBLE: 'players_eligible',
  PLAYERS_SEARCH: 'players_search_',
  TEAMS_LIST: 'teams_list',
  TEAMS_BY_SEASON: 'teams_season_',
  SEASONS_LIST: 'seasons_list',
  INVITES_LIST: 'invites_list',
  USERS_LIST: 'users_list',
  AGGREGATIONS: 'aggregations_',
} as const;

// Cache durations (in milliseconds)
export const CACHE_DURATIONS = {
  SHORT: 5 * 60 * 1000,      // 5 minutes - for frequently changing data
  MEDIUM: 30 * 60 * 1000,    // 30 minutes - for moderately changing data
  LONG: 60 * 60 * 1000,      // 1 hour - for rarely changing data
  VERY_LONG: 24 * 60 * 60 * 1000, // 24 hours - for static data
} as const;

/**
 * Get cached data with smart key generation
 */
export function getSmartCache<T>(
  key: string,
  duration: number = CACHE_DURATIONS.LONG
): T | null {
  return getCachedData<T>(key, duration);
}

/**
 * Set cached data with smart key generation
 */
export function setSmartCache<T>(
  key: string,
  data: T,
  duration: number = CACHE_DURATIONS.LONG
): void {
  setCachedData(key, data, duration);
}

/**
 * Invalidate all player-related caches
 * Call this after creating, updating, or deleting players
 */
export function invalidatePlayerCaches(): void {
  clearCacheByPrefix('players_');
  clearCacheByPrefix('aggregations_players');
  console.log('✅ Player caches invalidated');
}

/**
 * Invalidate specific player cache by filter
 */
export function invalidatePlayerCache(filter?: {
  position?: string;
  teamId?: string;
  eligibility?: boolean;
}): void {
  // Invalidate main list
  clearCache(CACHE_KEYS.PLAYERS_LIST);
  
  // Invalidate filtered caches
  if (filter?.position) {
    clearCache(`${CACHE_KEYS.PLAYERS_BY_POSITION}${filter.position}`);
  }
  if (filter?.teamId) {
    clearCache(`${CACHE_KEYS.PLAYERS_BY_TEAM}${filter.teamId}`);
  }
  if (filter?.eligibility !== undefined) {
    clearCache(CACHE_KEYS.PLAYERS_ELIGIBLE);
  }
  
  // Clear search caches
  clearCacheByPrefix(CACHE_KEYS.PLAYERS_SEARCH);
  
  console.log('✅ Player cache invalidated:', filter);
}

/**
 * Invalidate all team-related caches
 */
export function invalidateTeamCaches(): void {
  clearCacheByPrefix('teams_');
  clearCacheByPrefix('aggregations_teams');
  console.log('✅ Team caches invalidated');
}

/**
 * Invalidate specific team cache
 */
export function invalidateTeamCache(seasonId?: string): void {
  clearCache(CACHE_KEYS.TEAMS_LIST);
  if (seasonId) {
    clearCache(`${CACHE_KEYS.TEAMS_BY_SEASON}${seasonId}`);
  }
  console.log('✅ Team cache invalidated:', seasonId);
}

/**
 * Invalidate all season-related caches
 */
export function invalidateSeasonCaches(): void {
  clearCacheByPrefix('seasons_');
  console.log('✅ Season caches invalidated');
}

/**
 * Invalidate all invite-related caches
 */
export function invalidateInviteCaches(): void {
  clearCacheByPrefix('invites_');
  console.log('✅ Invite caches invalidated');
}

/**
 * Invalidate all user-related caches
 */
export function invalidateUserCaches(): void {
  clearCacheByPrefix('users_');
  console.log('✅ User caches invalidated');
}

/**
 * Invalidate ALL caches (nuclear option)
 */
export function invalidateAllCaches(): void {
  if (typeof window === 'undefined') return;
  
  const keys = Object.keys(localStorage);
  let count = 0;
  
  keys.forEach(key => {
    if (key.includes('players_') || 
        key.includes('teams_') || 
        key.includes('seasons_') ||
        key.includes('invites_') ||
        key.includes('users_') ||
        key.includes('aggregations_')) {
      localStorage.removeItem(key);
      count++;
    }
  });
  
  console.log(`✅ All caches cleared (${count} items)`);
}

/**
 * Create a cache key for search results
 */
export function createSearchCacheKey(
  searchTerm: string,
  filters?: Record<string, any>
): string {
  const filterStr = filters ? JSON.stringify(filters) : '';
  return `${CACHE_KEYS.PLAYERS_SEARCH}${searchTerm}_${filterStr}`;
}

/**
 * Create a cache key for paginated data
 */
export function createPaginationCacheKey(
  baseKey: string,
  page: number,
  pageSize: number,
  filters?: Record<string, any>
): string {
  const filterStr = filters ? JSON.stringify(filters) : '';
  return `${baseKey}_page${page}_size${pageSize}_${filterStr}`;
}

/**
 * Wrapper for Firestore write operations that auto-invalidates cache
 */
export async function withCacheInvalidation<T>(
  operation: () => Promise<T>,
  cacheType: 'players' | 'teams' | 'seasons' | 'invites' | 'users' | 'all',
  options?: {
    position?: string;
    teamId?: string;
    seasonId?: string;
    eligibility?: boolean;
  }
): Promise<T> {
  try {
    // Perform the operation
    const result = await operation();
    
    // Invalidate relevant caches after successful operation
    switch (cacheType) {
      case 'players':
        invalidatePlayerCache(options);
        break;
      case 'teams':
        invalidateTeamCache(options?.seasonId);
        break;
      case 'seasons':
        invalidateSeasonCaches();
        break;
      case 'invites':
        invalidateInviteCaches();
        break;
      case 'users':
        invalidateUserCaches();
        break;
      case 'all':
        invalidateAllCaches();
        break;
    }
    
    return result;
  } catch (error) {
    console.error('Operation failed, cache not invalidated:', error);
    throw error;
  }
}

/**
 * Get cache statistics
 */
export function getCacheStatistics(): {
  totalCaches: number;
  playerCaches: number;
  teamCaches: number;
  seasonCaches: number;
  inviteCaches: number;
  userCaches: number;
  aggregationCaches: number;
  totalSize: number;
  oldestCache: { key: string; age: number } | null;
  newestCache: { key: string; age: number } | null;
} {
  if (typeof window === 'undefined') {
    return {
      totalCaches: 0,
      playerCaches: 0,
      teamCaches: 0,
      seasonCaches: 0,
      inviteCaches: 0,
      userCaches: 0,
      aggregationCaches: 0,
      totalSize: 0,
      oldestCache: null,
      newestCache: null,
    };
  }
  
  const keys = Object.keys(localStorage);
  let totalSize = 0;
  let playerCaches = 0;
  let teamCaches = 0;
  let seasonCaches = 0;
  let inviteCaches = 0;
  let userCaches = 0;
  let aggregationCaches = 0;
  let oldestCache: { key: string; age: number } | null = null;
  let newestCache: { key: string; age: number } | null = null;
  
  const now = Date.now();
  
  keys.forEach(key => {
    try {
      const value = localStorage.getItem(key);
      if (!value) return;
      
      totalSize += key.length + value.length;
      
      const cached = JSON.parse(value);
      if (!cached.timestamp) return;
      
      const age = now - cached.timestamp;
      
      if (!oldestCache || age > oldestCache.age) {
        oldestCache = { key, age };
      }
      if (!newestCache || age < newestCache.age) {
        newestCache = { key, age };
      }
      
      if (key.includes('players_')) playerCaches++;
      else if (key.includes('teams_')) teamCaches++;
      else if (key.includes('seasons_')) seasonCaches++;
      else if (key.includes('invites_')) inviteCaches++;
      else if (key.includes('users_')) userCaches++;
      else if (key.includes('aggregations_')) aggregationCaches++;
    } catch (error) {
      // Not a cache entry
    }
  });
  
  return {
    totalCaches: playerCaches + teamCaches + seasonCaches + inviteCaches + userCaches + aggregationCaches,
    playerCaches,
    teamCaches,
    seasonCaches,
    inviteCaches,
    userCaches,
    aggregationCaches,
    totalSize,
    oldestCache,
    newestCache,
  };
}

/**
 * Auto-invalidate cache on visibility change (tab becomes visible)
 * This ensures users see fresh data when they return to the tab
 */
export function setupAutoInvalidation(
  maxAge: number = 5 * 60 * 1000 // 5 minutes
): void {
  if (typeof window === 'undefined') return;
  
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      const stats = getCacheStatistics();
      
      // If oldest cache is older than maxAge, invalidate all
      if (stats.oldestCache && stats.oldestCache.age > maxAge) {
        console.log('⚠️ Cache too old, invalidating...');
        invalidateAllCaches();
      }
    }
  });
}
