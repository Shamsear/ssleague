import { useQuery } from '@tanstack/react-query';

export interface PlayerAward {
  id: number | string;
  player_id: string;
  player_name?: string;
  season_id: string;

  // Fields from both tables
  award_category?: string;  // e.g., "Golden Boot", "Best Defender" (or award_type from new table)
  award_type?: string;      // "category" or "individual" (old table) OR award name (new table)

  // Old table specific fields
  award_position?: string | null;
  player_category?: string | null;
  awarded_by?: string | null;

  // New table specific fields
  round_number?: number | null;
  week_number?: number | null;
  team_id?: string | null;
  team_name?: string | null;

  // Common fields
  performance_stats?: Record<string, any> | null;
  notes?: string | null;
  created_at?: Date;
  updated_at?: Date;
}

/**
 * Hook to fetch player awards for a specific player and season
 */
export function usePlayerAwards(playerId?: string, seasonId?: string) {
  return useQuery({
    queryKey: ['player-awards', playerId, seasonId],
    queryFn: async () => {
      if (!playerId || !seasonId) {
        return [];
      }

      const params = new URLSearchParams({
        player_id: playerId,
        season_id: seasonId,
      });

      const response = await fetch(`/api/player-awards?${params}`);

      if (!response.ok) {
        throw new Error('Failed to fetch player awards');
      }

      const data = await response.json();
      return data.success ? (data.awards as PlayerAward[]) : [];
    },
    enabled: !!playerId && !!seasonId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch all awards for a season
 */
export function useSeasonAwards(seasonId?: string, awardCategory?: string) {
  return useQuery({
    queryKey: ['season-awards', seasonId, awardCategory],
    queryFn: async () => {
      if (!seasonId) {
        return [];
      }

      const params = new URLSearchParams({ season_id: seasonId });
      if (awardCategory) {
        params.append('award_category', awardCategory);
      }

      const response = await fetch(`/api/player-awards?${params}`);

      if (!response.ok) {
        throw new Error('Failed to fetch season awards');
      }

      const data = await response.json();
      return data.success ? (data.awards as PlayerAward[]) : [];
    },
    enabled: !!seasonId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
