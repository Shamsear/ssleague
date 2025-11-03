'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

interface DashboardData {
  team: any;
  activeRounds: any[];
  activeBids: any[];
  players: any[];
  tiebreakers: any[];
  bulkTiebreakers: any[];
  activeBulkRounds: any[];
  roundResults: any[];
  seasonParticipation?: any;
  stats: any;
}

// Hook to fetch dashboard data
export function useTeamDashboard(seasonId: string | undefined, enabled: boolean = true) {
  return useQuery<DashboardData>({
    queryKey: ['teamDashboard', seasonId],
    queryFn: async () => {
      if (!seasonId) throw new Error('Season ID required');
      
      const params = new URLSearchParams({ season_id: seasonId });
      const response = await fetchWithTokenRefresh(`/api/team/dashboard?${params}`, {
        headers: { 'Cache-Control': 'no-cache' },
      });
      
      const { success, data } = await response.json();
      
      if (!success) throw new Error('Failed to fetch dashboard');
      
      return data;
    },
    enabled: enabled && !!seasonId,
    staleTime: 5 * 60 * 1000, // 5 minutes - use WebSocket for live updates
    refetchInterval: false, // Disabled - use WebSocket for real-time
    refetchIntervalInBackground: false
  });
}

// Hook to delete a bid with optimistic update
export function useDeleteBid() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (bidId: number) => {
      const response = await fetchWithTokenRefresh(`/api/team/bids/${bidId}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to delete bid');
      }
      
      return data;
    },
    onMutate: async (bidId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['teamDashboard'] });

      // Snapshot the previous value
      const previousData = queryClient.getQueryData<DashboardData>(['teamDashboard']);

      // Optimistically update
      if (previousData) {
        const bidToDelete = previousData.activeBids.find(b => b.id === bidId);
        
        if (bidToDelete) {
          queryClient.setQueryData<DashboardData>(['teamDashboard'], {
            ...previousData,
            activeBids: previousData.activeBids.filter(bid => bid.id !== bidId),
            team: {
              ...previousData.team,
              balance: previousData.team.balance + bidToDelete.amount,
            },
            stats: {
              ...previousData.stats,
              balance: previousData.stats.balance + bidToDelete.amount,
              activeBidsCount: previousData.stats.activeBidsCount - 1,
            },
          });
        }
      }

      return { previousData };
    },
    onError: (err, bidId, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(['teamDashboard'], context.previousData);
      }
    },
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['teamDashboard'] });
    },
  });
}

// Hook to fetch round data
export function useRoundData(roundId: string | undefined, enabled: boolean = true) {
  return useQuery({
    queryKey: ['round', roundId],
    queryFn: async () => {
      if (!roundId) throw new Error('Round ID required');
      
      // Add cache-busting timestamp to force fresh data
      const timestamp = Date.now();
      const response = await fetchWithTokenRefresh(`/api/team/round/${roundId}?_t=${timestamp}`);
      const data = await response.json();

      if (!data.success) {
        if (data.redirect) {
          window.location.href = data.redirect;
        }
        throw new Error('Failed to fetch round');
      }

      return data;
    },
    enabled: enabled && !!roundId,
    staleTime: 0, // Always refetch on mount - ensures deleted/recreated rounds load fresh data
    refetchOnMount: 'always', // Force refetch when component mounts
    refetchInterval: 3000, // Poll every 3 seconds as fallback for status changes
    refetchIntervalInBackground: true, // Keep polling even when tab is not focused
  });
}

// Hook to place a bid with optimistic update
export function usePlaceBid(roundId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ playerId, amount }: { playerId: string; amount: number }) => {
      const response = await fetchWithTokenRefresh('/api/team/bids', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_id: playerId,
          round_id: roundId,
          amount: amount,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to place bid');
      }

      return { ...data, playerId, amount };
    },
    onMutate: async ({ playerId, amount }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['round', roundId] });

      // Snapshot the previous value
      const previousRoundData = queryClient.getQueryData(['round', roundId]);

      // Optimistically update round data
      queryClient.setQueryData(['round', roundId], (old: any) => {
        if (!old) return old;

        // Find the player in the players list
        const player = old.players?.find((p: any) => p.id === playerId);
        
        if (!player) return old;

        // Create new bid object
        const newBid = {
          id: 'temp-' + Date.now(),
          player_id: playerId,
          amount: amount,
          round_id: roundId,
          created_at: new Date().toISOString(),
          player: {
            id: player.id,
            name: player.name,
            position: player.position,
            team_name: player.team_name,
            overall_rating: player.overall_rating,
            playing_style: player.playing_style,
            is_starred: player.is_starred_by_user || false,
          },
        };

        return {
          ...old,
          myBids: [...(old.myBids || []), newBid],
          teamBalance: old.teamBalance - amount,
        };
      });

      return { previousRoundData };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousRoundData) {
        queryClient.setQueryData(['round', roundId], context.previousRoundData);
      }
    },
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['round', roundId] });
      queryClient.invalidateQueries({ queryKey: ['teamDashboard'] });
    },
  });
}

// Hook to cancel a bid
export function useCancelBid(roundId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (bidId: string) => {
      const response = await fetchWithTokenRefresh(`/api/team/bids/${bidId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to cancel bid');
      }

      return data;
    },
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['round', roundId] });
      queryClient.invalidateQueries({ queryKey: ['teamDashboard'] });
    },
  });
}

// Hook to fetch all teams for a season
export function useAllTeams(seasonId: string | undefined, enabled: boolean = true) {
  return useQuery({
    queryKey: ['allTeams', seasonId],
    queryFn: async () => {
      if (!seasonId) throw new Error('Season ID required');
      
      const response = await fetchWithTokenRefresh(`/api/team/all?season_id=${seasonId}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error('Failed to fetch teams');
      }

      return data.data;
    },
    enabled: enabled && !!seasonId,
    staleTime: 5 * 60 * 1000, // 5 minutes - team data rarely changes
    refetchInterval: false, // Disabled - no need for polling
    refetchIntervalInBackground: false,
  });
}

// Hook to fetch tiebreakers for a team
export function useTiebreakers(enabled: boolean = true) {
  return useQuery({
    queryKey: ['tiebreakers'],
    queryFn: async () => {
      const response = await fetchWithTokenRefresh('/api/team/tiebreakers');
      const data = await response.json();

      if (!data.success) {
        throw new Error('Failed to fetch tiebreakers');
      }

      return data.data;
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes - use WebSocket for live updates
    refetchInterval: false, // Disabled - use WebSocket for real-time
    refetchIntervalInBackground: false,
  });
}

// Hook to fetch specific tiebreaker details
export function useTiebreakerDetails(tiebreakerId: string | undefined, enabled: boolean = true) {
  return useQuery({
    queryKey: ['tiebreaker', tiebreakerId],
    queryFn: async () => {
      if (!tiebreakerId) throw new Error('Tiebreaker ID required');
      
      const response = await fetchWithTokenRefresh(`/api/tiebreakers/${tiebreakerId}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error('Failed to fetch tiebreaker');
      }

      return data.data;
    },
    enabled: enabled && !!tiebreakerId,
    staleTime: 5 * 60 * 1000, // 5 minutes - use WebSocket for live updates
    refetchInterval: false, // Disabled - use WebSocket for real-time
    refetchIntervalInBackground: false,
  });
}

// Hook to submit tiebreaker bid
export function useSubmitTiebreakerBid(tiebreakerId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (amount: number) => {
      const response = await fetchWithTokenRefresh(`/api/tiebreakers/${tiebreakerId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to submit tiebreaker bid');
      }

      return data;
    },
    onSuccess: () => {
      // Invalidate tiebreaker queries
      queryClient.invalidateQueries({ queryKey: ['tiebreaker', tiebreakerId] });
      queryClient.invalidateQueries({ queryKey: ['tiebreakers'] });
      queryClient.invalidateQueries({ queryKey: ['teamDashboard'] });
    },
  });
}

// Hook to fetch team players
export function useTeamPlayers(seasonId: string | undefined, enabled: boolean = true) {
  return useQuery({
    queryKey: ['teamPlayers', seasonId],
    queryFn: async () => {
      if (!seasonId) throw new Error('Season ID required');
      
      const response = await fetchWithTokenRefresh(`/api/team/players?season_id=${seasonId}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error('Failed to fetch players');
      }

      return data.data;
    },
    enabled: enabled && !!seasonId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: false, // Disabled - no need for constant updates
    refetchIntervalInBackground: false,
  });
}

// Hook to fetch player statistics
export function usePlayerStatistics(seasonId: string | undefined, enabled: boolean = true) {
  return useQuery({
    queryKey: ['playerStatistics', seasonId],
    queryFn: async () => {
      if (!seasonId) throw new Error('Season ID required');
      
      const response = await fetchWithTokenRefresh(`/api/team/statistics?season_id=${seasonId}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error('Failed to fetch statistics');
      }

      return data.data;
    },
    enabled: enabled && !!seasonId,
    staleTime: 5 * 60 * 1000, // 5 minutes - stats change slowly
    refetchInterval: false, // Disabled
    refetchIntervalInBackground: false,
  });
}

// Hook to fetch specific player details
export function usePlayerDetails(playerId: string | undefined, enabled: boolean = true) {
  return useQuery({
    queryKey: ['player', playerId],
    queryFn: async () => {
      if (!playerId) throw new Error('Player ID required');
      
      const response = await fetchWithTokenRefresh(`/api/team/player/${playerId}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error('Failed to fetch player');
      }

      return data.data;
    },
    enabled: enabled && !!playerId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: false, // Disabled
    refetchIntervalInBackground: false,
  });
}

// Hook to fetch round status
export function useRoundStatus(roundId: string | undefined, enabled: boolean = true) {
  return useQuery({
    queryKey: ['roundStatus', roundId],
    queryFn: async () => {
      if (!roundId) throw new Error('Round ID required');
      
      const response = await fetchWithTokenRefresh(`/api/team/round/${roundId}/status`);
      const data = await response.json();

      return data;
    },
    enabled: enabled && !!roundId,
    staleTime: 0, // Always refetch - ensures fresh status for deleted/recreated rounds
    refetchOnMount: 'always', // Force refetch when component mounts
    refetchInterval: false, // Disabled - use WebSocket
    refetchIntervalInBackground: false,
  });
}
