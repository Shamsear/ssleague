// Cache utility for localStorage with expiration

interface CacheData<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

/**
 * Get cached data from localStorage
 * @param key Cache key
 * @param maxAge Maximum age in milliseconds (default: 1 hour)
 * @returns Cached data or null if expired/not found
 */
export function getCachedData<T>(key: string, maxAge: number = 3600000): T | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;

    const cacheData: CacheData<T> = JSON.parse(cached);
    const now = Date.now();

    // Check if cache has expired
    if (now > cacheData.expiresAt) {
      localStorage.removeItem(key);
      return null;
    }

    return cacheData.data;
  } catch (error) {
    console.error(`Error reading cache for key "${key}":`, error);
    return null;
  }
}

/**
 * Set data in localStorage cache with expiration
 * @param key Cache key
 * @param data Data to cache
 * @param maxAge Maximum age in milliseconds (default: 1 hour)
 */
export function setCachedData<T>(key: string, data: T, maxAge: number = 3600000): void {
  if (typeof window === 'undefined') return;
  
  try {
    const now = Date.now();
    const cacheData: CacheData<T> = {
      data,
      timestamp: now,
      expiresAt: now + maxAge
    };

    localStorage.setItem(key, JSON.stringify(cacheData));
  } catch (error) {
    console.error(`Error setting cache for key "${key}":`, error);
    // If localStorage is full, clear old caches
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      clearOldCaches();
      // Try again
      try {
        const now = Date.now();
        const cacheData: CacheData<T> = {
          data,
          timestamp: now,
          expiresAt: now + maxAge
        };
        localStorage.setItem(key, JSON.stringify(cacheData));
      } catch (retryError) {
        console.error('Failed to set cache even after cleanup:', retryError);
      }
    }
  }
}

/**
 * Clear a specific cache entry
 * @param key Cache key to clear
 */
export function clearCache(key: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(key);
}

/**
 * Clear all caches with a specific prefix
 * @param prefix Prefix to match (e.g., 'players_')
 */
export function clearCacheByPrefix(prefix: string): void {
  if (typeof window === 'undefined') return;
  
  const keys = Object.keys(localStorage);
  keys.forEach(key => {
    if (key.startsWith(prefix)) {
      localStorage.removeItem(key);
    }
  });
}

/**
 * Clear expired caches
 */
export function clearExpiredCaches(): void {
  if (typeof window === 'undefined') return;
  
  const keys = Object.keys(localStorage);
  const now = Date.now();
  
  keys.forEach(key => {
    try {
      const value = localStorage.getItem(key);
      if (!value) return;
      
      const cached: CacheData<any> = JSON.parse(value);
      if (cached.expiresAt && now > cached.expiresAt) {
        localStorage.removeItem(key);
      }
    } catch (error) {
      // Not a cache entry or invalid JSON, skip
    }
  });
}

/**
 * Clear old caches to free up space (keeps only last 24 hours)
 */
function clearOldCaches(): void {
  if (typeof window === 'undefined') return;
  
  const keys = Object.keys(localStorage);
  const dayAgo = Date.now() - (24 * 60 * 60 * 1000);
  
  keys.forEach(key => {
    try {
      const value = localStorage.getItem(key);
      if (!value) return;
      
      const cached: CacheData<any> = JSON.parse(value);
      if (cached.timestamp && cached.timestamp < dayAgo) {
        localStorage.removeItem(key);
      }
    } catch (error) {
      // Not a cache entry, skip
    }
  });
}

/**
 * Get cache info (for debugging)
 */
export function getCacheInfo(): {
  totalKeys: number;
  cacheKeys: string[];
  totalSize: number;
  expiredKeys: string[];
} {
  if (typeof window === 'undefined') {
    return { totalKeys: 0, cacheKeys: [], totalSize: 0, expiredKeys: [] };
  }
  
  const keys = Object.keys(localStorage);
  const cacheKeys: string[] = [];
  const expiredKeys: string[] = [];
  let totalSize = 0;
  const now = Date.now();
  
  keys.forEach(key => {
    try {
      const value = localStorage.getItem(key);
      if (!value) return;
      
      totalSize += key.length + value.length;
      
      const cached: CacheData<any> = JSON.parse(value);
      if (cached.expiresAt) {
        cacheKeys.push(key);
        if (now > cached.expiresAt) {
          expiredKeys.push(key);
        }
      }
    } catch (error) {
      // Not a cache entry, skip
    }
  });
  
  return {
    totalKeys: keys.length,
    cacheKeys,
    totalSize,
    expiredKeys
  };
}

// Auto-clear expired caches on module load
if (typeof window !== 'undefined') {
  clearExpiredCaches();
}
