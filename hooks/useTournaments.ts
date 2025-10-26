import { useQuery } from '@tanstack/react-query';

interface Tournament {
  id: string;
  season_id: string;
  tournament_type: 'league' | 'cup' | 'ucl' | 'uel' | 'super_cup' | 'league_cup';
  tournament_name: string;
  tournament_code?: string;
  status: 'upcoming' | 'active' | 'completed' | 'cancelled';
  start_date?: string;
  end_date?: string;
  description?: string;
  is_primary: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

interface UseTournamentsOptions {
  seasonId?: string;
  status?: 'upcoming' | 'active' | 'completed' | 'cancelled';
  enabled?: boolean;
}

export function useTournaments(options: UseTournamentsOptions = {}) {
  const { seasonId, status, enabled = true } = options;

  return useQuery<Tournament[]>({
    queryKey: ['tournaments', seasonId, status],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (seasonId) params.append('season_id', seasonId);
      if (status) params.append('status', status);

      const response = await fetch(`/api/tournaments?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch tournaments');
      }

      const data = await response.json();
      return data.tournaments || [];
    },
    enabled: enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useTournament(tournamentId: string | null | undefined) {
  return useQuery<Tournament | null>({
    queryKey: ['tournament', tournamentId],
    queryFn: async () => {
      if (!tournamentId) return null;

      const response = await fetch(`/api/tournaments/${tournamentId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch tournament');
      }

      const data = await response.json();
      return data.tournament || null;
    },
    enabled: !!tournamentId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Helper function to get tournament icon emoji
export function getTournamentIcon(type: string): string {
  switch (type) {
    case 'league':
      return '🏆';
    case 'cup':
      return '🏅';
    case 'ucl':
      return '⭐';
    case 'uel':
      return '🌟';
    case 'super_cup':
      return '👑';
    case 'league_cup':
      return '🥇';
    default:
      return '⚽';
  }
}

// Helper function to get tournament color
export function getTournamentColor(type: string): string {
  switch (type) {
    case 'league':
      return 'blue';
    case 'cup':
      return 'green';
    case 'ucl':
      return 'purple';
    case 'uel':
      return 'orange';
    case 'super_cup':
      return 'yellow';
    case 'league_cup':
      return 'red';
    default:
      return 'gray';
  }
}
