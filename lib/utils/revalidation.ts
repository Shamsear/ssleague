/**
 * Utility functions for triggering cache revalidation
 * Use these after updating Firestore data to instantly refresh cached data
 */

export type RevalidationType = 'teams' | 'players' | 'stats' | 'all';

/**
 * Trigger cache revalidation for specific data type
 * Call this after updating teams, players, or stats in Firestore
 * 
 * @param type - What data to revalidate ('teams', 'players', 'stats', or 'all')
 * @returns Promise that resolves when revalidation is complete
 * 
 * @example
 * // After updating a team
 * await updateTeam(teamId, data);
 * await revalidateCache('teams'); // Refresh teams cache immediately
 * 
 * @example
 * // After bulk updates
 * await bulkUpdatePlayers(updates);
 * await revalidateCache('all'); // Refresh all caches
 */
export async function revalidateCache(type: RevalidationType = 'all'): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    const response = await fetch('/api/revalidate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        secret: process.env.NEXT_PUBLIC_REVALIDATE_SECRET || process.env.REVALIDATE_SECRET,
        type,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Cache revalidation failed:', error);
      return {
        success: false,
        error: error.error || 'Failed to revalidate cache',
      };
    }

    const result = await response.json();
    console.log('Cache revalidated successfully:', result);
    
    return {
      success: true,
      message: result.message || 'Cache revalidated successfully',
    };
  } catch (error) {
    console.error('Error triggering cache revalidation:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * React hook for triggering cache revalidation with loading state
 * 
 * @example
 * function MyComponent() {
 *   const { revalidate, isRevalidating } = useRevalidation();
 *   
 *   async function handleUpdate() {
 *     await updateTeam(data);
 *     await revalidate('teams');
 *   }
 * }
 */
export function useRevalidation() {
  const [isRevalidating, setIsRevalidating] = React.useState(false);

  const revalidate = async (type: RevalidationType = 'all') => {
    setIsRevalidating(true);
    try {
      const result = await revalidateCache(type);
      return result;
    } finally {
      setIsRevalidating(false);
    }
  };

  return { revalidate, isRevalidating };
}

/**
 * Revalidate multiple cache types
 * 
 * @param types - Array of cache types to revalidate
 * 
 * @example
 * // Revalidate both teams and players
 * await revalidateMultiple(['teams', 'players']);
 */
export async function revalidateMultiple(types: RevalidationType[]): Promise<{
  success: boolean;
  results: Array<{ type: RevalidationType; success: boolean; error?: string }>;
}> {
  const results = await Promise.all(
    types.map(async (type) => {
      const result = await revalidateCache(type);
      return { type, ...result };
    })
  );

  const allSuccessful = results.every(r => r.success);

  return {
    success: allSuccessful,
    results,
  };
}

// Add React import for hook
import React from 'react';
