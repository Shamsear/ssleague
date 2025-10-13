/**
 * Cached Firebase Operations
 * 
 * Wrapper functions that add caching to Firebase Firestore operations
 * Automatically invalidates cache on writes
 */

import { 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  query,
  Query,
  DocumentReference,
  DocumentSnapshot,
  QuerySnapshot,
  Firestore
} from 'firebase/firestore';
import firebaseCache, { 
  getCached, 
  setCached, 
  invalidateCache, 
  invalidateCacheCollection 
} from './cache';

/**
 * Cached getDoc - reads from cache first, then Firebase
 */
export async function cachedGetDoc<T = any>(
  docRef: DocumentReference,
  ttl?: number
): Promise<DocumentSnapshot<T>> {
  const collectionPath = docRef.parent.path;
  const docId = docRef.id;

  // Try cache first
  const cached = getCached<DocumentSnapshot<T>>(collectionPath, docId, ttl);
  if (cached) {
    console.log(`[Cache HIT] ${collectionPath}/${docId}`);
    return cached;
  }

  // Cache miss - fetch from Firebase
  console.log(`[Cache MISS] ${collectionPath}/${docId}`);
  const snapshot = await getDoc(docRef);

  // Cache the result
  if (snapshot.exists()) {
    setCached(collectionPath, docId, snapshot);
  }

  return snapshot as DocumentSnapshot<T>;
}

/**
 * Cached getDocs - for query results
 * Note: Only caches if query has no dynamic filters
 */
export async function cachedGetDocs<T = any>(
  q: Query,
  cacheKey?: string,
  ttl?: number
): Promise<QuerySnapshot<T>> {
  // For queries, we need a unique cache key
  if (!cacheKey) {
    // If no cache key provided, don't cache (queries are complex)
    return getDocs(q) as Promise<QuerySnapshot<T>>;
  }

  const cached = getCached<QuerySnapshot<T>>('queries', cacheKey, ttl);
  if (cached) {
    console.log(`[Cache HIT] query/${cacheKey}`);
    return cached;
  }

  console.log(`[Cache MISS] query/${cacheKey}`);
  const snapshot = await getDocs(q);

  // Cache the result
  setCached('queries', cacheKey, snapshot);

  return snapshot as QuerySnapshot<T>;
}

/**
 * Cached setDoc - writes to Firebase and invalidates cache
 */
export async function cachedSetDoc<T = any>(
  docRef: DocumentReference,
  data: T,
  options?: any
): Promise<void> {
  const collectionPath = docRef.parent.path;
  const docId = docRef.id;

  // Write to Firebase
  await setDoc(docRef, data, options);

  // Invalidate cache for this document
  invalidateCache(collectionPath, docId);
  
  // Also invalidate queries cache for this collection
  invalidateCacheCollection('queries');

  console.log(`[Cache INVALIDATED] ${collectionPath}/${docId}`);
}

/**
 * Cached updateDoc - updates Firebase and invalidates cache
 */
export async function cachedUpdateDoc(
  docRef: DocumentReference,
  data: any
): Promise<void> {
  const collectionPath = docRef.parent.path;
  const docId = docRef.id;

  // Update Firebase
  await updateDoc(docRef, data);

  // Invalidate cache
  invalidateCache(collectionPath, docId);
  invalidateCacheCollection('queries');

  console.log(`[Cache INVALIDATED] ${collectionPath}/${docId}`);
}

/**
 * Cached deleteDoc - deletes from Firebase and invalidates cache
 */
export async function cachedDeleteDoc(
  docRef: DocumentReference
): Promise<void> {
  const collectionPath = docRef.parent.path;
  const docId = docRef.id;

  // Delete from Firebase
  await deleteDoc(docRef);

  // Invalidate cache
  invalidateCache(collectionPath, docId);
  invalidateCacheCollection('queries');

  console.log(`[Cache INVALIDATED] ${collectionPath}/${docId}`);
}

/**
 * Batch invalidate cache for multiple operations
 */
export function invalidateBatch(operations: Array<{ collection: string; docId: string }>) {
  operations.forEach(({ collection, docId }) => {
    invalidateCache(collection, docId);
  });
  invalidateCacheCollection('queries');
  console.log(`[Cache INVALIDATED] Batch of ${operations.length} documents`);
}

/**
 * Helper: Get cached season data
 */
export async function getCachedSeason(db: Firestore, seasonId: string) {
  const seasonRef = doc(db, 'seasons', seasonId);
  return cachedGetDoc(seasonRef, 10 * 60 * 1000); // 10 minute TTL for seasons
}

/**
 * Helper: Get cached player data
 */
export async function getCachedPlayer(db: Firestore, playerId: string) {
  const playerRef = doc(db, 'realplayers', playerId);
  return cachedGetDoc(playerRef, 5 * 60 * 1000); // 5 minute TTL for players
}

/**
 * Helper: Get cached team data
 */
export async function getCachedTeam(db: Firestore, teamId: string) {
  const teamRef = doc(db, 'teams', teamId);
  return cachedGetDoc(teamRef, 5 * 60 * 1000); // 5 minute TTL for teams
}

/**
 * Invalidate cache after season update
 */
export function invalidateSeasonCache(seasonId: string) {
  invalidateCache('seasons', seasonId);
  invalidateCacheCollection('realplayerstats'); // Season updates may affect player stats
  invalidateCacheCollection('queries');
}

/**
 * Invalidate cache after player update
 */
export function invalidatePlayerCache(playerId: string) {
  invalidateCache('realplayers', playerId);
  invalidateCacheCollection('realplayerstats'); // Player updates may affect stats
  invalidateCacheCollection('queries');
}

/**
 * Invalidate cache after team update
 */
export function invalidateTeamCache(teamId: string) {
  invalidateCache('teams', teamId);
  invalidateCacheCollection('queries');
}

// Re-export cache utilities for direct use
export { firebaseCache };
export * from './cache';
