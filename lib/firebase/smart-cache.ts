/**
 * Smart Firebase Cache with Event-Based Invalidation
 * 
 * This module provides:
 * - Long cache durations for static data (hours/days)
 * - Automatic invalidation when data changes
 * - Helper functions for common Firebase operations
 */

import { adminDb } from '@/lib/firebase/admin';
import { getCached, setCached, invalidateCache as baseInvalidateCache } from '@/lib/firebase/cache';

// Cache durations for different data types
export const CACHE_DURATIONS = {
  // Permanent data - rarely changes
  SEASON: 24 * 60 * 60 * 1000,           // 24 hours
  TEAM: 12 * 60 * 60 * 1000,             // 12 hours
  USER: 12 * 60 * 60 * 1000,             // 12 hours
  
  // Semi-permanent - changes occasionally
  TEAM_SEASON: 6 * 60 * 60 * 1000,       // 6 hours
  ACTIVE_SEASON: 2 * 60 * 60 * 1000,     // 2 hours
  USER_TO_TEAM: 2 * 60 * 60 * 1000,      // 2 hours (mapping userId → teamId)
  
  // Short-term - changes more frequently
  TRANSACTIONS: 15 * 60 * 1000,          // 15 minutes
  TEAM_LIST: 10 * 60 * 1000,             // 10 minutes
  PLAYER_STATS: 10 * 60 * 1000,          // 10 minutes
};

/**
 * Get a Firebase document with smart caching
 * Uses long TTL but invalidates immediately when data changes
 */
export async function getCachedFirebaseDoc<T = any>(
  collection: string,
  docId: string,
  ttl: number
): Promise<T | null> {
  // Try cache first
  const cached = getCached<T>(collection, docId, ttl);
  if (cached !== null) {
    console.log(`✅ [Cache HIT] ${collection}/${docId}`);
    return cached;
  }
  
  // Cache miss - fetch from Firebase
  console.log(`❌ [Cache MISS] ${collection}/${docId} - fetching from Firebase`);
  
  try {
    const doc = await adminDb.collection(collection).doc(docId).get();
    
    if (!doc.exists) {
      console.log(`⚠️ Document not found: ${collection}/${docId}`);
      return null;
    }
    
    const data = doc.data() as T;
    
    // Cache the result
    setCached(collection, docId, data);
    console.log(`💾 [Cached] ${collection}/${docId}`);
    
    return data;
  } catch (error) {
    console.error(`❌ Error fetching ${collection}/${docId}:`, error);
    return null;
  }
}

/**
 * Get active season with caching
 * Caches the result of the "where isActive == true" query
 */
export async function getCachedActiveSeason(): Promise<{ id: string; data: any } | null> {
  const cacheKey = 'active_season_query';
  
  // Try cache first
  const cached = getCached<{ id: string; data: any }>('seasons', cacheKey, CACHE_DURATIONS.ACTIVE_SEASON);
  if (cached !== null) {
    console.log(`✅ [Cache HIT] active season: ${cached.id}`);
    return cached;
  }
  
  // Cache miss - query Firebase
  console.log(`❌ [Cache MISS] active season - querying Firebase`);
  
  try {
    const snapshot = await adminDb.collection('seasons')
      .where('isActive', '==', true)
      .limit(1)
      .get();
    
    if (snapshot.empty) {
      console.log(`⚠️ No active season found`);
      return null;
    }
    
    const doc = snapshot.docs[0];
    const result = {
      id: doc.id,
      data: doc.data()
    };
    
    // Cache the result
    setCached('seasons', cacheKey, result);
    console.log(`💾 [Cached] active season: ${result.id}`);
    
    return result;
  } catch (error) {
    console.error(`❌ Error fetching active season:`, error);
    return null;
  }
}

/**
 * Get team ID from user ID with caching
 * Handles multiple field name variations and caches the mapping
 */
export async function getCachedUserTeamId(userId: string): Promise<string | null> {
  const cacheKey = 'user_to_team_mapping';
  
  // Try cache first
  const cached = getCached<string>(cacheKey, userId, CACHE_DURATIONS.USER_TO_TEAM);
  if (cached !== null) {
    console.log(`✅ [Cache HIT] userId → teamId: ${userId} → ${cached}`);
    return cached;
  }
  
  // Cache miss - query Firebase
  console.log(`❌ [Cache MISS] userId → teamId mapping for ${userId}`);
  
  try {
    // Try firebase_uid field first (most common)
    let snapshot = await adminDb.collection('teams')
      .where('firebase_uid', '==', userId)
      .limit(1)
      .get();
    
    if (!snapshot.empty) {
      const teamId = snapshot.docs[0].id;
      setCached(cacheKey, userId, teamId);
      console.log(`💾 [Cached] userId → teamId: ${userId} → ${teamId}`);
      return teamId;
    }
    
    // Fallback: Try other field names (for legacy data)
    const fieldNames = ['userId', 'uid', 'owner_uid'];
    for (const fieldName of fieldNames) {
      snapshot = await adminDb.collection('teams')
        .where(fieldName, '==', userId)
        .limit(1)
        .get();
      
      if (!snapshot.empty) {
        const teamId = snapshot.docs[0].id;
        setCached(cacheKey, userId, teamId);
        console.log(`💾 [Cached] userId → teamId (via ${fieldName}): ${userId} → ${teamId}`);
        return teamId;
      }
    }
    
    console.log(`⚠️ No team found for userId: ${userId}`);
    return null;
  } catch (error) {
    console.error(`❌ Error getting team for user ${userId}:`, error);
    return null;
  }
}

/**
 * Get team_season document with caching
 * Handles both direct doc ID and query-based lookup
 */
export async function getCachedTeamSeason(
  userId: string,
  seasonId: string
): Promise<{ id: string; data: any } | null> {
  // Try direct lookup first: userId_seasonId
  const directId = `${userId}_${seasonId}`;
  
  let data = await getCachedFirebaseDoc('team_seasons', directId, CACHE_DURATIONS.TEAM_SEASON);
  if (data !== null) {
    return { id: directId, data };
  }
  
  // Cache miss - try query by user_id field
  console.log(`❌ [Cache MISS] team_season ${directId} - trying query`);
  
  try {
    const snapshot = await adminDb.collection('team_seasons')
      .where('user_id', '==', userId)
      .where('season_id', '==', seasonId)
      .where('status', '==', 'registered')
      .limit(1)
      .get();
    
    if (snapshot.empty) {
      console.log(`⚠️ No team_season found for user ${userId}, season ${seasonId}`);
      return null;
    }
    
    const doc = snapshot.docs[0];
    data = doc.data();
    
    // Cache with the actual document ID
    setCached('team_seasons', doc.id, data);
    console.log(`💾 [Cached] team_season: ${doc.id}`);
    
    return { id: doc.id, data };
  } catch (error) {
    console.error(`❌ Error fetching team_season:`, error);
    return null;
  }
}

/**
 * Invalidate cache when data changes
 * Call this after any write operation
 */
export function invalidateFirebaseCache(collection: string, docId: string): void {
  baseInvalidateCache(collection, docId);
  console.log(`🗑️ [Cache INVALIDATED] ${collection}/${docId}`);
}

/**
 * Invalidate active season cache
 * Call when season status changes
 */
export function invalidateActiveSeason(): void {
  baseInvalidateCache('seasons', 'active_season_query');
  console.log(`🗑️ [Cache INVALIDATED] active season query`);
}

/**
 * Invalidate user-to-team mapping
 * Call when team ownership changes
 */
export function invalidateUserTeamMapping(userId: string): void {
  baseInvalidateCache('user_to_team_mapping', userId);
  console.log(`🗑️ [Cache INVALIDATED] user→team mapping for ${userId}`);
}

/**
 * Invalidate all caches related to a team
 * Call when team data changes
 */
export function invalidateTeamCaches(teamId: string, userId: string, seasonId: string): void {
  // Invalidate team document
  invalidateFirebaseCache('teams', teamId);
  
  // Invalidate user-to-team mapping
  invalidateUserTeamMapping(userId);
  
  // Invalidate team_season
  const teamSeasonId = `${teamId}_${seasonId}`;
  invalidateFirebaseCache('team_seasons', teamSeasonId);
  
  // Also try userId_seasonId variant
  const altTeamSeasonId = `${userId}_${seasonId}`;
  invalidateFirebaseCache('team_seasons', altTeamSeasonId);
  
  console.log(`🗑️ [Cache INVALIDATED] all caches for team ${teamId}`);
}
