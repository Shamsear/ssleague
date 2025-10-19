import { useState, useEffect } from 'react';

interface CachedResponse<T> {
  success: boolean;
  data: T;
  cached: boolean;
  timestamp: string;
}

interface UseCachedFirebaseOptions {
  enabled?: boolean;
  refetchInterval?: number;
}

/**
 * Hook to fetch cached Firebase data from API endpoints
 * Automatically benefits from ISR caching
 */
export function useCachedFirebase<T>(
  endpoint: string,
  params?: Record<string, string>,
  options: UseCachedFirebaseOptions = {}
) {
  const { enabled = true, refetchInterval } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    let intervalId: NodeJS.Timeout | null = null;

    const fetchData = async () => {
      try {
        const url = new URL(endpoint, window.location.origin);
        if (params) {
          Object.entries(params).forEach(([key, value]) => {
            if (value !== null && value !== undefined) {
              url.searchParams.append(key, value);
            }
          });
        }

        const response = await fetch(url.toString());
        const result: CachedResponse<T> = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to fetch data');
        }

        if (isMounted) {
          setData(result.data);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Unknown error');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    // Initial fetch
    fetchData();

    // Set up refetch interval if specified
    if (refetchInterval) {
      intervalId = setInterval(fetchData, refetchInterval);
    }

    return () => {
      isMounted = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [endpoint, JSON.stringify(params), enabled, refetchInterval]);

  return { data, loading, error, refetch: () => setLoading(true) };
}

/**
 * Specialized hooks for common Firebase collections
 */

export function useCachedTeamSeasons(params?: { seasonId?: string; teamId?: string }) {
  return useCachedFirebase<any[]>('/api/cached/firebase/team-seasons', params);
}

export function useCachedSeasons(params?: { isActive?: string; seasonId?: string }) {
  return useCachedFirebase<any[] | any>('/api/cached/firebase/seasons', params);
}

export function useCachedFixtures(params: { seasonId: string; teamId?: string; roundNumber?: string }) {
  return useCachedFirebase<any[]>('/api/cached/firebase/fixtures', params);
}

export function useCachedMatchData(params: { seasonId: string; type?: 'match_days' | 'round_deadlines' | 'both' }) {
  return useCachedFirebase<{ match_days?: any[]; round_deadlines?: any[] }>('/api/cached/firebase/match-data', params);
}
