/**
 * Tournament Hooks - React Query hooks for tournament operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ============================================
// Fixtures
// ============================================

export function useFixtures(params: {
  seasonId?: string;
  status?: string;
  roundNumber?: number;
  teamId?: string;
}) {
  return useQuery({
    queryKey: ['fixtures', params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.seasonId) searchParams.append('seasonId', params.seasonId);
      if (params.status) searchParams.append('status', params.status);
      if (params.roundNumber !== undefined) 
        searchParams.append('roundNumber', params.roundNumber.toString());
      if (params.teamId) searchParams.append('teamId', params.teamId);
      
      const response = await fetch(`/api/tournament/fixtures?${searchParams}`);
      const data = await response.json();
      
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
    enabled: !!params.seasonId || !!params.teamId,
    staleTime: 10 * 60 * 1000, // 10 minutes (schedule doesn't change often)
  });
}

export function useCreateFixture() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (fixtureData: any) => {
      const response = await fetch('/api/tournament/fixtures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fixtureData),
      });
      
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixtures'] });
    },
  });
}

// ============================================
// Matches
// ============================================

export function useMatches(params: {
  seasonId?: string;
  fixtureId?: string;
  teamId?: string;
}) {
  return useQuery({
    queryKey: ['matches', params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.seasonId) searchParams.append('seasonId', params.seasonId);
      if (params.fixtureId) searchParams.append('fixtureId', params.fixtureId);
      if (params.teamId) searchParams.append('teamId', params.teamId);
      
      const response = await fetch(`/api/tournament/matches?${searchParams}`);
      const data = await response.json();
      
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useUpdateMatch() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (matchData: any) => {
      const response = await fetch('/api/tournament/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(matchData),
      });
      
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
    onSuccess: () => {
      // Invalidate related caches
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      queryClient.invalidateQueries({ queryKey: ['fixtures'] });
      queryClient.invalidateQueries({ queryKey: ['player-stats'] });
      queryClient.invalidateQueries({ queryKey: ['team-stats'] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    },
  });
}
