/**
 * Hook for fetching team's historical stats from Neon
 */

import { useQuery } from '@tanstack/react-query';

export function useTeamHistory(teamId: string | undefined) {
  return useQuery({
    queryKey: ['team-history', teamId],
    queryFn: async () => {
      if (!teamId) throw new Error('Team ID required');
      
      // Add cache-busting timestamp to force fresh data
      const timestamp = Date.now();
      const response = await fetch(`/api/stats/team-history?teamId=${teamId}&_t=${timestamp}`, {
        cache: 'no-store', // Disable browser cache
      });
      const data = await response.json();
      
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
    enabled: !!teamId,
    staleTime: 30 * 1000, // 30 seconds - shorter for testing
    gcTime: 2 * 60 * 1000, // 2 minutes
    refetchOnMount: true, // Always refetch on mount
    refetchOnWindowFocus: false,
    refetchInterval: false,
  });
}
