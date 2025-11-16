import { neon } from '@neondatabase/serverless';
import React from 'react';

// Cache for team names to avoid repeated DB queries
const teamNameCache = new Map<string, { name: string; expiresAt: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get the current team name from Neon database
 * Always returns the team's current name, regardless of historical names
 * 
 * @param firebaseUid - The Firebase UID of the team
 * @param sql - Optional Neon SQL instance (if already initialized)
 * @returns Current team name or original name if not found
 */
export async function getCurrentTeamName(
  firebaseUid: string,
  sql?: ReturnType<typeof neon>
): Promise<string> {
  // Check cache first
  const cached = teamNameCache.get(firebaseUid);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.name;
  }

  // Initialize SQL if not provided
  const db = sql || neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

  try {
    const result = await db`
      SELECT name FROM teams 
      WHERE firebase_uid = ${firebaseUid} 
      LIMIT 1
    `;

    if (result.length > 0 && result[0].name) {
      const name = result[0].name;
      // Cache the result
      teamNameCache.set(firebaseUid, {
        name,
        expiresAt: Date.now() + CACHE_TTL
      });
      return name;
    }
  } catch (error) {
    console.error('Error fetching current team name:', error);
  }

  return 'Unknown Team';
}

/**
 * Get current team names for multiple Firebase UIDs
 * More efficient than calling getCurrentTeamName multiple times
 * 
 * @param firebaseUids - Array of Firebase UIDs
 * @param sql - Optional Neon SQL instance
 * @returns Map of firebaseUid -> current team name
 */
export async function getCurrentTeamNames(
  firebaseUids: string[],
  sql?: ReturnType<typeof neon>
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  
  // Check which UIDs are in cache
  const uncachedUids: string[] = [];
  for (const uid of firebaseUids) {
    const cached = teamNameCache.get(uid);
    if (cached && cached.expiresAt > Date.now()) {
      result.set(uid, cached.name);
    } else {
      uncachedUids.push(uid);
    }
  }

  // If all are cached, return immediately
  if (uncachedUids.length === 0) {
    return result;
  }

  // Initialize SQL if not provided
  const db = sql || neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

  try {
    const teams = await db`
      SELECT firebase_uid, name 
      FROM teams 
      WHERE firebase_uid = ANY(${uncachedUids})
    `;

    for (const team of teams) {
      if (team.firebase_uid && team.name) {
        result.set(team.firebase_uid, team.name);
        // Cache the result
        teamNameCache.set(team.firebase_uid, {
          name: team.name,
          expiresAt: Date.now() + CACHE_TTL
        });
      }
    }

    // Set unknown for any that weren't found
    for (const uid of uncachedUids) {
      if (!result.has(uid)) {
        result.set(uid, 'Unknown Team');
      }
    }
  } catch (error) {
    console.error('Error fetching current team names:', error);
    // Set unknown for all uncached UIDs on error
    for (const uid of uncachedUids) {
      if (!result.has(uid)) {
        result.set(uid, 'Unknown Team');
      }
    }
  }

  return result;
}

/**
 * Resolve team names in an array of objects
 * Replaces historical team_name with current name from Neon
 * 
 * @param items - Array of objects containing team_id and team_name
 * @param teamIdField - Field name containing Firebase UID (default: 'team_id')
 * @param teamNameField - Field name to update with current name (default: 'team_name')
 * @returns Array with updated team names
 */
export async function resolveTeamNames<T extends Record<string, any>>(
  items: T[],
  teamIdField: string = 'team_id',
  teamNameField: string = 'team_name'
): Promise<T[]> {
  if (!items || items.length === 0) {
    return items;
  }

  // Extract unique team UIDs
  const teamUids = [...new Set(
    items
      .map(item => item[teamIdField])
      .filter(uid => uid && typeof uid === 'string')
  )];

  if (teamUids.length === 0) {
    return items;
  }

  // Fetch current names
  const nameMap = await getCurrentTeamNames(teamUids);

  // Update items with current names
  return items.map(item => {
    const teamUid = item[teamIdField];
    if (teamUid && nameMap.has(teamUid)) {
      return {
        ...item,
        [teamNameField]: nameMap.get(teamUid)
      };
    }
    return item;
  });
}

/**
 * Clear the team name cache (useful after team renames)
 * @param firebaseUid - Optional specific UID to clear, or clear all if not provided
 */
export function clearTeamNameCache(firebaseUid?: string): void {
  if (firebaseUid) {
    teamNameCache.delete(firebaseUid);
  } else {
    teamNameCache.clear();
  }
}

