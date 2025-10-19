import { useQuery } from '@tanstack/react-query';
import { TeamSummary, PlayerSummary, LeagueStatsSummary } from '@/lib/firebase/aggregates';

/**
 * Custom hooks for fetching cached data from optimized API endpoints
 * These hooks use React Query for client-side caching and automatic refetching
 * 
 * Benefits:
 * - No direct Firestore reads from client
 * - Data cached on both server (ISR) and client (React Query)
 * - Automatic background refetching
 * - Optimistic updates support
 */

interface ApiResponse<T> {
  success: boolean;
  data: T;
  cached: boolean;
  timestamp: string;
}

/**
 * Fetch teams summary with caching
 * 
 * @param seasonId - Optional season filter
 * @returns Teams data with React Query state
 * 
 * @example
 * const { data: teams, isLoading, error } = useCachedTeams();
 * const { data: seasonTeams } = useCachedTeams('season123');
 */
export function useCachedTeams(seasonId?: string) {
  return useQuery({
    queryKey: ['teams', 'cached', seasonId],
    queryFn: async () => {
      const url = new URL('/api/cached/teams', window.location.origin);
      if (seasonId) {
        url.searchParams.set('seasonId', seasonId);
      }
      
      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error('Failed to fetch teams');
      }
      
      const result: ApiResponse<TeamSummary[]> = await response.json();
      return result.data;
    },
    staleTime: 10 * 60 * 1000, // Consider data fresh for 10 minutes
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes (formerly cacheTime)
    refetchOnWindowFocus: false, // Don't refetch on window focus
    refetchOnMount: false, // Don't refetch on component mount if data exists
  });
}

/**
 * Fetch players summary with caching
 * 
 * @param seasonId - Optional season filter
 * @returns Players data with React Query state
 * 
 * @example
 * const { data: players, isLoading } = useCachedPlayers();
 * const { data: players, refetch } = useCachedPlayers('season123');
 */
export function useCachedPlayers(seasonId?: string) {
  return useQuery({
    queryKey: ['players', 'cached', seasonId],
    queryFn: async () => {
      const url = new URL('/api/cached/players', window.location.origin);
      if (seasonId) {
        url.searchParams.set('seasonId', seasonId);
      }
      
      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error('Failed to fetch players');
      }
      
      const result: ApiResponse<PlayerSummary[]> = await response.json();
      return result.data;
    },
    staleTime: 10 * 60 * 1000, // Consider data fresh for 10 minutes
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

/**
 * Fetch league statistics with caching
 * 
 * @param seasonId - Optional season filter
 * @returns League stats with React Query state
 * 
 * @example
 * const { data: stats, isLoading } = useCachedLeagueStats();
 */
export function useCachedLeagueStats(seasonId?: string) {
  return useQuery({
    queryKey: ['stats', 'cached', seasonId],
    queryFn: async () => {
      const url = new URL('/api/cached/stats', window.location.origin);
      if (seasonId) {
        url.searchParams.set('seasonId', seasonId);
      }
      
      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error('Failed to fetch league stats');
      }
      
      const result: ApiResponse<LeagueStatsSummary> = await response.json();
      return result.data;
    },
    staleTime: 10 * 60 * 1000, // Consider data fresh for 10 minutes
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

/**
 * Hook to get team standings (sorted teams)
 * Convenience wrapper around useCachedLeagueStats
 * 
 * @example
 * const { data: standings, isLoading } = useStandings();
 */
export function useStandings(seasonId?: string) {
  const { data: stats, ...rest } = useCachedLeagueStats(seasonId);
  
  return {
    data: stats?.standings || [],
    ...rest,
  };
}

/**
 * Hook to get top scorers
 * Convenience wrapper around useCachedLeagueStats
 * 
 * @example
 * const { data: topScorers } = useTopScorers();
 */
export function useTopScorers(seasonId?: string) {
  const { data: stats, ...rest } = useCachedLeagueStats(seasonId);
  
  return {
    data: stats?.topScorers || [],
    ...rest,
  };
}

/**
 * Hook to get players by team
 * Filters cached players by team_id
 * 
 * @example
 * const { data: teamPlayers } = useTeamPlayers('team0001');
 */
export function useTeamPlayers(teamId: string, seasonId?: string) {
  const { data: players, ...rest } = useCachedPlayers(seasonId);
  
  const teamPlayers = players?.filter(p => p.team_id === teamId) || [];
  
  return {
    data: teamPlayers,
    ...rest,
  };
}

/**
 * Hook to trigger manual cache refresh
 * Useful after admin updates
 * 
 * @example
 * const { refetchAll } = useRefreshCache();
 * // After updating a team
 * await refetchAll();
 */
export function useRefreshCache() {
  const teamsQuery = useCachedTeams();
  const playersQuery = useCachedPlayers();
  const statsQuery = useCachedLeagueStats();
  
  const refetchAll = async () => {
    await Promise.all([
      teamsQuery.refetch(),
      playersQuery.refetch(),
      statsQuery.refetch(),
    ]);
  };
  
  const refetchTeams = () => teamsQuery.refetch();
  const refetchPlayers = () => playersQuery.refetch();
  const refetchStats = () => statsQuery.refetch();
  
  return {
    refetchAll,
    refetchTeams,
    refetchPlayers,
    refetchStats,
  };
}
