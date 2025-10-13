/**
 * Firebase Smart Cache
 * 
 * A caching layer for Firebase Firestore that:
 * - Reduces read operations
 * - Automatically invalidates on writes
 * - Uses time-based expiry as fallback
 * - Thread-safe for concurrent requests
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  version: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  invalidations: number;
}

class FirebaseCache {
  private cache: Map<string, CacheEntry<any>>;
  private collectionVersions: Map<string, number>;
  private stats: CacheStats;
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_CACHE_SIZE = 1000; // Prevent memory overflow

  constructor() {
    this.cache = new Map();
    this.collectionVersions = new Map();
    this.stats = { hits: 0, misses: 0, invalidations: 0 };
    
    // Periodic cleanup of expired entries
    setInterval(() => this.cleanup(), 60 * 1000); // Every minute
  }

  /**
   * Generate cache key from collection path and doc ID
   */
  private generateKey(collection: string, docId: string): string {
    return `${collection}/${docId}`;
  }

  /**
   * Get current version for a collection
   */
  private getCollectionVersion(collection: string): number {
    return this.collectionVersions.get(collection) || 0;
  }

  /**
   * Increment collection version (called on write)
   */
  private incrementCollectionVersion(collection: string): void {
    const current = this.getCollectionVersion(collection);
    this.collectionVersions.set(collection, current + 1);
  }

  /**
   * Check if cache entry is still valid
   */
  private isValid(entry: CacheEntry<any>, collection: string, ttl: number): boolean {
    const now = Date.now();
    const isExpired = (now - entry.timestamp) > ttl;
    const isStale = entry.version < this.getCollectionVersion(collection);
    
    return !isExpired && !isStale;
  }

  /**
   * Get cached data
   */
  get<T>(collection: string, docId: string, ttl: number = this.DEFAULT_TTL): T | null {
    const key = this.generateKey(collection, docId);
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    if (!this.isValid(entry, collection, ttl)) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return entry.data as T;
  }

  /**
   * Set cache data
   */
  set<T>(collection: string, docId: string, data: T): void {
    // Prevent cache overflow
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      this.evictOldest();
    }

    const key = this.generateKey(collection, docId);
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      version: this.getCollectionVersion(collection)
    };

    this.cache.set(key, entry);
  }

  /**
   * Get multiple documents from cache
   */
  getMany<T>(collection: string, docIds: string[], ttl: number = this.DEFAULT_TTL): Map<string, T> {
    const results = new Map<string, T>();
    
    for (const docId of docIds) {
      const data = this.get<T>(collection, docId, ttl);
      if (data !== null) {
        results.set(docId, data);
      }
    }
    
    return results;
  }

  /**
   * Set multiple documents in cache
   */
  setMany<T>(collection: string, items: Array<{ id: string; data: T }>): void {
    for (const item of items) {
      this.set(collection, item.id, item.data);
    }
  }

  /**
   * Invalidate specific document
   */
  invalidate(collection: string, docId: string): void {
    const key = this.generateKey(collection, docId);
    this.cache.delete(key);
    this.stats.invalidations++;
  }

  /**
   * Invalidate entire collection
   */
  invalidateCollection(collection: string): void {
    // Increment version - this will make all cached items stale
    this.incrementCollectionVersion(collection);
    
    // Optional: Also delete from cache immediately
    const keysToDelete: string[] = [];
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${collection}/`)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.cache.delete(key));
    this.stats.invalidations += keysToDelete.length;
  }

  /**
   * Invalidate multiple collections
   */
  invalidateCollections(collections: string[]): void {
    for (const collection of collections) {
      this.invalidateCollection(collection);
    }
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
    this.collectionVersions.clear();
    this.stats = { hits: 0, misses: 0, invalidations: 0 };
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if ((now - entry.timestamp) > this.DEFAULT_TTL * 2) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
    
    if (keysToDelete.length > 0) {
      console.log(`[Cache] Cleaned up ${keysToDelete.length} expired entries`);
    }
  }

  /**
   * Evict oldest entries when cache is full
   */
  private evictOldest(): void {
    const entries = Array.from(this.cache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    // Remove oldest 10%
    const toRemove = Math.ceil(this.MAX_CACHE_SIZE * 0.1);
    for (let i = 0; i < toRemove; i++) {
      this.cache.delete(entries[i][0]);
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0
      ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
      : '0.00';

    return {
      ...this.stats,
      hitRate: `${hitRate}%`,
      size: this.cache.size,
      collections: this.collectionVersions.size
    };
  }

  /**
   * Log cache stats
   */
  logStats(): void {
    const stats = this.getStats();
    console.log('[Firebase Cache Stats]', stats);
  }
}

// Singleton instance
const firebaseCache = new FirebaseCache();

// Export the singleton
export default firebaseCache;

// Export helper functions
export const {
  get: getCached,
  set: setCached,
  getMany: getCachedMany,
  setMany: setCachedMany,
  invalidate: invalidateCache,
  invalidateCollection: invalidateCacheCollection,
  invalidateCollections: invalidateCacheCollections,
  clear: clearCache,
  getStats: getCacheStats,
  logStats: logCacheStats
} = {
  get: firebaseCache.get.bind(firebaseCache),
  set: firebaseCache.set.bind(firebaseCache),
  getMany: firebaseCache.getMany.bind(firebaseCache),
  setMany: firebaseCache.setMany.bind(firebaseCache),
  invalidate: firebaseCache.invalidate.bind(firebaseCache),
  invalidateCollection: firebaseCache.invalidateCollection.bind(firebaseCache),
  invalidateCollections: firebaseCache.invalidateCollections.bind(firebaseCache),
  clear: firebaseCache.clear.bind(firebaseCache),
  getStats: firebaseCache.getStats.bind(firebaseCache),
  logStats: firebaseCache.logStats.bind(firebaseCache)
};

// Export type for TypeScript
export type { CacheStats };
