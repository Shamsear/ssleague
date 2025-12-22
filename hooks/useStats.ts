/**
 * Stats Hooks - React Query hooks for statistics
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ============================================
// Player Stats
// ============================================

export function usePlayerStats(params: {
  seasonId?: string;
  tournamentId?: string;
  playerId?: string;
  teamId?: string;
  category?: string;
  sortBy?: 'points' | 'goals_scored' | 'assists' | 'motm_awards' | 'matches_played';
  limit?: number;
  startRound?: number;
  endRound?: number;
  useMatchups?: boolean;
}) {
  return useQuery({
    queryKey: ['player-stats', params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.tournamentId) searchParams.append('tournamentId', params.tournamentId);
      if (params.seasonId) searchParams.append('seasonId', params.seasonId);
      if (params.playerId) searchParams.append('playerId', params.playerId);
      if (params.teamId) searchParams.append('teamId', params.teamId);
      if (params.category) searchParams.append('category', params.category);
      if (params.sortBy) searchParams.append('sortBy', params.sortBy);
      if (params.limit) searchParams.append('limit', params.limit.toString());
      if (params.startRound) searchParams.append('startRound', params.startRound.toString());
      if (params.endRound) searchParams.append('endRound', params.endRound.toString());
      if (params.useMatchups) searchParams.append('useMatchups', 'true');
      
      const url = `/api/stats/players?${searchParams}`;
      console.log('[usePlayerStats] Fetching:', url);
      
      const response = await fetch(url);
      const data = await response.json();
      
      console.log('[usePlayerStats] Response:', { success: data.success, count: data.count || data.data?.length || 0 });
      
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
    enabled: !!(params.tournamentId || params.seasonId || params.playerId), // Enable if tournamentId, seasonId, or playerId is provided
    staleTime: 0, // Always refetch to ensure round range changes are reflected
    refetchOnMount: 'always', // Always refetch when component mounts
  });
}

export function useUpdatePlayerStats() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (statsData: {
      player_id: string;
      season_id: string;
      tournament_id: string;
      player_name: string;
      team?: string;
      team_id?: string;
      category?: string;
      matches_played?: number;
      goals_scored?: number;
      assists?: number;
      wins?: number;
      draws?: number;
      losses?: number;
      clean_sheets?: number;
      motm_awards?: number;
      points?: number;
      star_rating?: number;
    }) => {
      const response = await fetch('/api/stats/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(statsData),
      });
      
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['player-stats'] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    },
  });
}

// ============================================
// Team Stats
// ============================================

export function useTeamStats(params: {
  seasonId?: string;
  tournamentId?: string;
  teamId?: string;
}) {
  return useQuery({
    queryKey: ['team-stats', params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.tournamentId) searchParams.append('tournamentId', params.tournamentId);
      if (params.seasonId) searchParams.append('seasonId', params.seasonId);
      if (params.teamId) searchParams.append('teamId', params.teamId);
      
      const response = await fetch(`/api/stats/teams?${searchParams}`);
      const data = await response.json();
      
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
    enabled: !!(params.tournamentId || params.seasonId),
    staleTime: 5 * 60 * 1000, // 5 minutes - consistent caching
    refetchInterval: false, // Disabled - stats don't need constant updates
  });
}

export function useUpdateTeamStats() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (statsData: {
      team_id: string;
      season_id: string;
      tournament_id: string;
      team_name: string;
      matches_played?: number;
      wins?: number;
      draws?: number;
      losses?: number;
      goals_for?: number;
      goals_against?: number;
      goal_difference?: number;
      points?: number;
      position?: number;
    }) => {
      const response = await fetch('/api/stats/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(statsData),
      });
      
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-stats'] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
    },
  });
}

// ============================================
// Leaderboard
// ============================================

export function useLeaderboard(params: {
  seasonId?: string;
  tournamentId?: string;
  type?: 'player' | 'team';
  category?: string;
}) {
  return useQuery({
    queryKey: ['leaderboard', params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.tournamentId) searchParams.append('tournamentId', params.tournamentId);
      if (params.seasonId) searchParams.append('seasonId', params.seasonId);
      if (params.type) searchParams.append('type', params.type);
      if (params.category) searchParams.append('category', params.category);
      
      const response = await fetch(`/api/stats/leaderboard?${searchParams}`);
      const data = await response.json();
      
      if (!data.success) throw new Error(data.error);
      return {
        data: data.data,
        cached: data.cached,
        updated_at: data.updated_at
      };
    },
    enabled: !!(params.tournamentId || params.seasonId),
    staleTime: 5 * 60 * 1000, // 5 minutes - consistent with server cache
    refetchInterval: false,
  });
}
