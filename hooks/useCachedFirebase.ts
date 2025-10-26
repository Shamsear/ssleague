import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

interface CachedResponse<T> {
  success: boolean;
  data: T;
  cached: boolean;
  timestamp: string;
  error?: string;
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

export function useCachedSeasons(params?: { seasonId?: string; isActive?: string }) {
  return useQuery({
    queryKey: ['cached-seasons', params],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (params?.seasonId) queryParams.append('seasonId', params.seasonId);
      if (params?.isActive) queryParams.append('isActive', params.isActive);
      // Add cache-busting timestamp
      queryParams.append('_t', Date.now().toString());
      
      const url = `/api/cached/firebase/seasons?${queryParams.toString()}`;
      const response = await fetch(url, { cache: 'no-store' });
      const data = await response.json();
      
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
    enabled: true,
    staleTime: 10 * 1000, // 10 seconds - very short for active season checks
    gcTime: 30 * 1000,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });
}

export function useCachedFixtures(params: { seasonId: string; teamId?: string; roundNumber?: string }) {
  return useCachedFirebase<any[]>('/api/cached/firebase/fixtures', params);
}

export function useCachedMatchData(params: { seasonId: string; type?: 'match_days' | 'round_deadlines' | 'both' }) {
  return useCachedFirebase<{ match_days?: any[]; round_deadlines?: any[] }>('/api/cached/firebase/match-data', params);
}
