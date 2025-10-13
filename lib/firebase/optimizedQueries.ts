/**
 * Optimized Firestore Query Wrapper
 * 
 * Provides reusable functions for Firestore operations with:
 * - Automatic caching
 * - Read count tracking
 * - Cache invalidation
 * - Smart batching
 */

import { 
  collection, 
  getDocs, 
  getDoc,
  doc, 
  query, 
  Query,
  DocumentSnapshot,
  QuerySnapshot,
  CollectionReference
} from 'firebase/firestore'
import { db } from './config'
import { getSmartCache, setSmartCache, CACHE_DURATIONS } from '@/utils/smartCache'
import { incrementReadCount } from '@/utils/readCounter'

export interface CachedQueryOptions {
  /** Cache key for this query */
  cacheKey: string
  /** Cache duration in milliseconds (default: 15 minutes) */
  cacheDuration?: number
  /** Whether to track reads (default: true) */
  trackReads?: boolean
  /** Whether to log cache hits/misses (default: true in dev) */
  verbose?: boolean
}

/**
 * Execute a Firestore query with automatic caching and read tracking
 */
export async function optimizedGetDocs<T = any>(
  queryOrRef: Query | CollectionReference,
  options: CachedQueryOptions
): Promise<T[]> {
  const {
    cacheKey,
    cacheDuration = CACHE_DURATIONS.SHORT,
    trackReads = true,
    verbose = process.env.NODE_ENV === 'development'
  } = options

  // Try cache first
  const cached = getSmartCache<T[]>(cacheKey, cacheDuration)
  if (cached) {
    if (verbose) {
      console.log(`✅ Cache hit: ${cacheKey}`)
    }
    return cached
  }

  if (verbose) {
    console.log(`🔄 Cache miss: ${cacheKey} - Fetching from Firestore`)
  }

  // Fetch from Firestore
  const snapshot = await getDocs(queryOrRef)

  // Track reads
  if (trackReads) {
    incrementReadCount(snapshot.size)
    if (verbose) {
      console.log(`📊 Firestore reads: ${snapshot.size} documents`)
    }
  }

  // Process documents
  const data = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as T[]

  // Cache the results
  setSmartCache(cacheKey, data, cacheDuration)

  if (verbose) {
    console.log(`💾 Cached ${data.length} documents for ${cacheDuration}ms`)
  }

  return data
}

/**
 * Get a single document with caching and read tracking
 */
export async function optimizedGetDoc<T = any>(
  docPath: string,
  options: CachedQueryOptions
): Promise<T | null> {
  const {
    cacheKey,
    cacheDuration = CACHE_DURATIONS.SHORT,
    trackReads = true,
    verbose = process.env.NODE_ENV === 'development'
  } = options

  // Try cache first
  const cached = getSmartCache<T>(cacheKey, cacheDuration)
  if (cached) {
    if (verbose) {
      console.log(`✅ Cache hit: ${cacheKey}`)
    }
    return cached
  }

  if (verbose) {
    console.log(`🔄 Cache miss: ${cacheKey} - Fetching from Firestore`)
  }

  // Fetch from Firestore
  const docRef = doc(db, docPath)
  const docSnap = await getDoc(docRef)

  // Track reads
  if (trackReads) {
    incrementReadCount(1)
    if (verbose) {
      console.log(`📊 Firestore reads: 1 document`)
    }
  }

  if (!docSnap.exists()) {
    return null
  }

  const data = {
    id: docSnap.id,
    ...docSnap.data()
  } as T

  // Cache the result
  setSmartCache(cacheKey, data, cacheDuration)

  if (verbose) {
    console.log(`💾 Cached document for ${cacheDuration}ms`)
  }

  return data
}

/**
 * Common query presets for frequently used queries
 */
export const commonQueries = {
  /**
   * Get all players with caching
   */
  async getAllPlayers(cacheDuration = CACHE_DURATIONS.MEDIUM) {
    return optimizedGetDocs(
      collection(db, 'footballplayers'),
      {
        cacheKey: 'players_list',
        cacheDuration
      }
    )
  },

  /**
   * Get all teams with caching
   */
  async getAllTeams(cacheDuration = CACHE_DURATIONS.MEDIUM) {
    return optimizedGetDocs(
      collection(db, 'teams'),
      {
        cacheKey: 'teams_list',
        cacheDuration
      }
    )
  },

  /**
   * Get player by ID with caching
   */
  async getPlayerById(playerId: string, cacheDuration = CACHE_DURATIONS.SHORT) {
    return optimizedGetDoc(
      `footballplayers/${playerId}`,
      {
        cacheKey: `player_${playerId}`,
        cacheDuration
      }
    )
  },

  /**
   * Get team by ID with caching
   */
  async getTeamById(teamId: string, cacheDuration = CACHE_DURATIONS.SHORT) {
    return optimizedGetDoc(
      `teams/${teamId}`,
      {
        cacheKey: `team_${teamId}`,
        cacheDuration
      }
    )
  },

  /**
   * Get player stats/count with caching
   */
  async getPlayerStats(cacheDuration = CACHE_DURATIONS.SHORT) {
    const players = await optimizedGetDocs(
      collection(db, 'footballplayers'),
      {
        cacheKey: 'player_stats',
        cacheDuration
      }
    )

    const byPosition: { [key: string]: number } = {}
    players.forEach((player: any) => {
      const position = player.position || 'Unknown'
      byPosition[position] = (byPosition[position] || 0) + 1
    })

    return {
      total: players.length,
      byPosition,
      eligible: players.filter((p: any) => p.is_auction_eligible).length
    }
  }
}

/**
 * Batch operations helper
 * Use this when you need to perform multiple independent queries
 */
export async function batchQueries<T extends any[]>(
  queries: (() => Promise<any>)[]
): Promise<T> {
  console.log(`🔄 Executing ${queries.length} queries in parallel`)
  const startTime = Date.now()
  
  const results = await Promise.all(queries.map(q => q()))
  
  const duration = Date.now() - startTime
  console.log(`✅ Batch completed in ${duration}ms`)
  
  return results as T
}

/**
 * Example usage patterns
 */
export const examples = {
  // Basic query with caching
  basicQuery: async () => {
    const players = await optimizedGetDocs(
      collection(db, 'footballplayers'),
      {
        cacheKey: 'all_players',
        cacheDuration: CACHE_DURATIONS.MEDIUM
      }
    )
    return players
  },

  // Query with custom cache duration
  customCache: async () => {
    const players = await optimizedGetDocs(
      collection(db, 'footballplayers'),
      {
        cacheKey: 'players_short_cache',
        cacheDuration: 5 * 60 * 1000 // 5 minutes
      }
    )
    return players
  },

  // Multiple queries in parallel
  parallelQueries: async () => {
    const [players, teams] = await batchQueries([
      () => commonQueries.getAllPlayers(),
      () => commonQueries.getAllTeams()
    ])
    return { players, teams }
  },

  // Single document query
  singleDoc: async (playerId: string) => {
    const player = await commonQueries.getPlayerById(playerId)
    return player
  }
}
