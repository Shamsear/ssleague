import { useQuery } from '@tanstack/react-query';

export interface TeamTrophy {
  id: number;
  team_id: string;
  team_name: string;
  season_id: string;
  trophy_type: 'league' | 'cup' | 'runner_up' | 'special';
  trophy_name: string;
  position?: number;
  awarded_by?: string;
  notes?: string;
  created_at?: Date;
  updated_at?: Date;
}

export interface TeamStats {
  id: number;
  team_id: string;
  team_name: string;
  season_id: string;
  matches_played: number;
  wins: number;
  draws: number;
  losses: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  points: number;
  position: number;
  created_at?: Date;
  updated_at?: Date;
}

/**
 * Hook to fetch team trophies for a specific team and season
 */
export function useTeamTrophies(teamId?: string, seasonId?: string) {
  return useQuery({
    queryKey: ['team-trophies', teamId, seasonId],
    queryFn: async () => {
      if (!teamId || !seasonId) {
        return [];
      }

      const params = new URLSearchParams({
        team_id: teamId,
        season_id: seasonId,
      });

      const response = await fetch(`/api/trophies?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch team trophies');
      }

      const data = await response.json();
      return data.success ? (data.trophies as TeamTrophy[]) : [];
    },
    enabled: !!teamId && !!seasonId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch team stats for a specific team and season
 */
export function useTeamSeasonStats(teamId?: string, seasonId?: string) {
  return useQuery({
    queryKey: ['team-stats', teamId, seasonId],
    queryFn: async () => {
      if (!teamId || !seasonId) {
        return null;
      }

      const params = new URLSearchParams({
        team_id: teamId,
        season_id: seasonId,
      });

      const response = await fetch(`/api/team-stats?${params}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          return null; // Team stats not found
        }
        throw new Error('Failed to fetch team stats');
      }

      const data = await response.json();
      return data.success ? (data.stats as TeamStats) : null;
    },
    enabled: !!teamId && !!seasonId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
