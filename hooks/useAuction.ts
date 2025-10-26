/**
 * Auction Hooks - React Query hooks for auction operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ============================================
// Football Players (Auction Database)
// ============================================

export function useAuctionPlayers(params: {
  seasonId?: string;
  isAuctionEligible?: boolean;
  isSold?: boolean;
  position?: string;
  positionGroup?: string;
}) {
  return useQuery({
    queryKey: ['auction-players', params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.seasonId) searchParams.append('seasonId', params.seasonId);
      if (params.isAuctionEligible !== undefined) 
        searchParams.append('isAuctionEligible', params.isAuctionEligible.toString());
      if (params.isSold !== undefined) 
        searchParams.append('isSold', params.isSold.toString());
      if (params.position) searchParams.append('position', params.position);
      if (params.positionGroup) searchParams.append('positionGroup', params.positionGroup);
      
      const response = await fetch(`/api/auction/footballplayers?${searchParams}`);
      const data = await response.json();
      
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
    enabled: !!params.seasonId,
    staleTime: 5 * 60 * 1000, // 5 minutes - auction settings don't change often
    refetchInterval: false,
  });
}

// ============================================
// Auction Rounds
// ============================================

export function useAuctionRounds(params: {
  seasonId?: string;
  status?: string;
}) {
  return useQuery({
    queryKey: ['auction-rounds', params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.seasonId) searchParams.append('seasonId', params.seasonId);
      if (params.status) searchParams.append('status', params.status);
      
      const response = await fetch(`/api/auction/rounds?${searchParams}`);
      const data = await response.json();
      
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: false,
  });
}

export function useCreateRound() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (roundData: any) => {
      const response = await fetch('/api/auction/rounds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(roundData),
      });
      
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
    onSuccess: () => {
      // Invalidate rounds cache to refetch
      queryClient.invalidateQueries({ queryKey: ['auction-rounds'] });
    },
  });
}

// ============================================
// Bids
// ============================================

export function useBids(params: {
  roundId?: string;
  teamId?: string;
  playerId?: string;
}) {
  return useQuery({
    queryKey: ['bids', params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.roundId) searchParams.append('roundId', params.roundId);
      if (params.teamId) searchParams.append('teamId', params.teamId);
      if (params.playerId) searchParams.append('playerId', params.playerId);
      
      const response = await fetch(`/api/auction/bids?${searchParams}`);
      const data = await response.json();
      
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
    // Real-time during active auction - WILL USE WEBSOCKET
    staleTime: 30 * 1000, // 30 seconds - WebSocket provides real-time updates
    refetchInterval: false, // Disabled - WebSocket handles live updates
  });
}

export function usePlaceBid() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (bidData: {
      team_id: string;
      player_id: string;
      round_id: string;
      amount: number;
      phase?: string;
      encrypted_bid_data?: string;
    }) => {
      const response = await fetch('/api/auction/bids', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bidData),
      });
      
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      return data.data;
    },
    onSuccess: (_, variables) => {
      // Invalidate bids cache
      queryClient.invalidateQueries({ queryKey: ['bids'] });
      queryClient.invalidateQueries({ queryKey: ['auction-players'] });
    },
  });
}
