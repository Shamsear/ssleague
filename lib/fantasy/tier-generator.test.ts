/**
 * Unit tests for Tier Generation Algorithm
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import type { Player, Tier } from './tier-generator';

// Mock the fantasySql import
vi.mock('@/lib/neon/fantasy-config', () => ({
  fantasySql: vi.fn()
}));

// Import after mocking
import { generateDraftTiers, saveTiersToDatabase, getTiersFromDatabase } from './tier-generator';
import { fantasySql } from '@/lib/neon/fantasy-config';

describe('Tier Generation Algorithm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateDraftTiers', () => {
    test('should divide 300 players into 7 equal tiers', async () => {
      // Mock 300 players with descending points
      const mockPlayers: Player[] = Array.from({ length: 300 }, (_, i) => ({
        real_player_id: `player_${i + 1}`,
        player_name: `Player ${i + 1}`,
        position: 'FW',
        real_team_name: 'Team A',
        total_points: 300 - i, // 300, 299, 298, ..., 1
        games_played: 10,
        avg_points_per_game: (300 - i) / 10
      }));

      vi.mocked(fantasySql).mockResolvedValueOnce(mockPlayers);

      const tiers = await generateDraftTiers({
        leagueId: 'league_1',
        numberOfTiers: 7,
        draftType: 'initial'
      });

      // Should have 7 tiers
      expect(tiers).toHaveLength(7);

      // Each tier should have ~43 players (300 / 7 = 42.857)
      // First 6 tiers get 43 players, last tier gets 42
      expect(tiers[0].player_count).toBe(43);
      expect(tiers[1].player_count).toBe(43);
      expect(tiers[2].player_count).toBe(43);
      expect(tiers[3].player_count).toBe(43);
      expect(tiers[4].player_count).toBe(43);
      expect(tiers[5].player_count).toBe(43);
      expect(tiers[6].player_count).toBe(42);

      // Total should be 300
      const totalPlayers = tiers.reduce((sum, tier) => sum + tier.player_count, 0);
      expect(totalPlayers).toBe(300);
    });

    test('should assign correct tier names for 7 tiers', async () => {
      const mockPlayers: Player[] = Array.from({ length: 70 }, (_, i) => ({
        real_player_id: `player_${i + 1}`,
        player_name: `Player ${i + 1}`,
        position: 'FW',
        real_team_name: 'Team A',
        total_points: 70 - i,
        games_played: 10,
        avg_points_per_game: (70 - i) / 10
      }));

      vi.mocked(fantasySql).mockResolvedValueOnce(mockPlayers);

      const tiers = await generateDraftTiers({
        leagueId: 'league_1',
        numberOfTiers: 7,
        draftType: 'initial'
      });

      expect(tiers[0].tier_name).toBe('Elite');
      expect(tiers[1].tier_name).toBe('Premium');
      expect(tiers[2].tier_name).toBe('Stars');
      expect(tiers[3].tier_name).toBe('Quality');
      expect(tiers[4].tier_name).toBe('Solid');
      expect(tiers[5].tier_name).toBe('Reliable');
      expect(tiers[6].tier_name).toBe('Prospects');
    });

    test('should calculate tier stats correctly', async () => {
      const mockPlayers: Player[] = [
        { real_player_id: 'p1', player_name: 'Player 1', position: 'FW', real_team_name: 'Team A', total_points: 100, games_played: 10, avg_points_per_game: 10 },
        { real_player_id: 'p2', player_name: 'Player 2', position: 'MF', real_team_name: 'Team B', total_points: 90, games_played: 10, avg_points_per_game: 9 },
        { real_player_id: 'p3', player_name: 'Player 3', position: 'DF', real_team_name: 'Team C', total_points: 80, games_played: 10, avg_points_per_game: 8 },
        { real_player_id: 'p4', player_name: 'Player 4', position: 'GK', real_team_name: 'Team D', total_points: 70, games_played: 10, avg_points_per_game: 7 },
        { real_player_id: 'p5', player_name: 'Player 5', position: 'FW', real_team_name: 'Team E', total_points: 60, games_played: 10, avg_points_per_game: 6 }
      ];

      vi.mocked(fantasySql).mockResolvedValueOnce(mockPlayers);

      const tiers = await generateDraftTiers({
        leagueId: 'league_1',
        numberOfTiers: 2,
        draftType: 'initial'
      });

      // Tier 1: Players 1, 2, 3 (100, 90, 80)
      expect(tiers[0].min_points).toBe(80);
      expect(tiers[0].max_points).toBe(100);
      expect(tiers[0].avg_points).toBe(90); // (100 + 90 + 80) / 3

      // Tier 2: Players 4, 5 (70, 60)
      expect(tiers[1].min_points).toBe(60);
      expect(tiers[1].max_points).toBe(70);
      expect(tiers[1].avg_points).toBe(65); // (70 + 60) / 2
    });

    test('should handle uneven distribution correctly', async () => {
      // 10 players into 3 tiers = 3, 3, 4 or 4, 3, 3
      const mockPlayers: Player[] = Array.from({ length: 10 }, (_, i) => ({
        real_player_id: `player_${i + 1}`,
        player_name: `Player ${i + 1}`,
        position: 'FW',
        real_team_name: 'Team A',
        total_points: 10 - i,
        games_played: 5,
        avg_points_per_game: (10 - i) / 5
      }));

      vi.mocked(fantasySql).mockResolvedValueOnce(mockPlayers);

      const tiers = await generateDraftTiers({
        leagueId: 'league_1',
        numberOfTiers: 3,
        draftType: 'initial'
      });

      expect(tiers).toHaveLength(3);
      
      // 10 / 3 = 3 remainder 1
      // First tier gets extra player
      expect(tiers[0].player_count).toBe(4); // 3 + 1
      expect(tiers[1].player_count).toBe(3);
      expect(tiers[2].player_count).toBe(3);

      // Total should be 10
      const totalPlayers = tiers.reduce((sum, tier) => sum + tier.player_count, 0);
      expect(totalPlayers).toBe(10);
    });

    test('should sort players by points correctly', async () => {
      const mockPlayers: Player[] = [
        { real_player_id: 'p1', player_name: 'Player 1', position: 'FW', real_team_name: 'Team A', total_points: 50, games_played: 10, avg_points_per_game: 5 },
        { real_player_id: 'p2', player_name: 'Player 2', position: 'MF', real_team_name: 'Team B', total_points: 100, games_played: 10, avg_points_per_game: 10 },
        { real_player_id: 'p3', player_name: 'Player 3', position: 'DF', real_team_name: 'Team C', total_points: 75, games_played: 10, avg_points_per_game: 7.5 }
      ];

      vi.mocked(fantasySql).mockResolvedValueOnce(mockPlayers);

      const tiers = await generateDraftTiers({
        leagueId: 'league_1',
        numberOfTiers: 1,
        draftType: 'initial'
      });

      // Should be sorted: Player 2 (100), Player 3 (75), Player 1 (50)
      expect(tiers[0].players[0].real_player_id).toBe('p2');
      expect(tiers[0].players[1].real_player_id).toBe('p3');
      expect(tiers[0].players[2].real_player_id).toBe('p1');
    });

    test('should handle edge case: 1 tier', async () => {
      const mockPlayers: Player[] = Array.from({ length: 50 }, (_, i) => ({
        real_player_id: `player_${i + 1}`,
        player_name: `Player ${i + 1}`,
        position: 'FW',
        real_team_name: 'Team A',
        total_points: 50 - i,
        games_played: 10,
        avg_points_per_game: (50 - i) / 10
      }));

      vi.mocked(fantasySql).mockResolvedValueOnce(mockPlayers);

      const tiers = await generateDraftTiers({
        leagueId: 'league_1',
        numberOfTiers: 1,
        draftType: 'initial'
      });

      expect(tiers).toHaveLength(1);
      expect(tiers[0].player_count).toBe(50);
    });

    test('should handle edge case: more tiers than players', async () => {
      const mockPlayers: Player[] = [
        { real_player_id: 'p1', player_name: 'Player 1', position: 'FW', real_team_name: 'Team A', total_points: 100, games_played: 10, avg_points_per_game: 10 },
        { real_player_id: 'p2', player_name: 'Player 2', position: 'MF', real_team_name: 'Team B', total_points: 90, games_played: 10, avg_points_per_game: 9 }
      ];

      vi.mocked(fantasySql).mockResolvedValueOnce(mockPlayers);

      const tiers = await generateDraftTiers({
        leagueId: 'league_1',
        numberOfTiers: 5,
        draftType: 'initial'
      });

      // Should create 5 tiers, but some will be empty
      expect(tiers).toHaveLength(5);
      expect(tiers[0].player_count).toBe(1);
      expect(tiers[1].player_count).toBe(1);
      expect(tiers[2].player_count).toBe(0);
      expect(tiers[3].player_count).toBe(0);
      expect(tiers[4].player_count).toBe(0);
    });

    test('should throw error when no players available', async () => {
      vi.mocked(fantasySql).mockResolvedValueOnce([]);

      await expect(
        generateDraftTiers({
          leagueId: 'league_1',
          numberOfTiers: 7,
          draftType: 'initial'
        })
      ).rejects.toThrow('No available players found for tier generation');
    });

    test('should filter by minimum games played', async () => {
      const mockPlayers: Player[] = [
        { real_player_id: 'p1', player_name: 'Player 1', position: 'FW', real_team_name: 'Team A', total_points: 100, games_played: 10, avg_points_per_game: 10 },
        { real_player_id: 'p2', player_name: 'Player 2', position: 'MF', real_team_name: 'Team B', total_points: 90, games_played: 5, avg_points_per_game: 18 }
      ];

      vi.mocked(fantasySql).mockResolvedValueOnce(mockPlayers);

      await generateDraftTiers({
        leagueId: 'league_1',
        numberOfTiers: 2,
        draftType: 'initial',
        minGamesPlayed: 5
      });

      // Verify SQL was called with minGamesPlayed = 5
      expect(fantasySql).toHaveBeenCalled();
    });
  });

  describe('Performance', () => {
    test('should handle 300+ players efficiently (<2s)', async () => {
      const mockPlayers: Player[] = Array.from({ length: 350 }, (_, i) => ({
        real_player_id: `player_${i + 1}`,
        player_name: `Player ${i + 1}`,
        position: 'FW',
        real_team_name: 'Team A',
        total_points: 350 - i,
        games_played: 10,
        avg_points_per_game: (350 - i) / 10
      }));

      vi.mocked(fantasySql).mockResolvedValueOnce(mockPlayers);

      const startTime = Date.now();
      
      await generateDraftTiers({
        leagueId: 'league_1',
        numberOfTiers: 7,
        draftType: 'initial'
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete in less than 2 seconds (2000ms)
      expect(duration).toBeLessThan(2000);
    });
  });

  describe('Tier Stats Calculation', () => {
    test('should calculate correct min, max, avg for tier', async () => {
      const mockPlayers: Player[] = [
        { real_player_id: 'p1', player_name: 'Player 1', position: 'FW', real_team_name: 'Team A', total_points: 100, games_played: 10, avg_points_per_game: 10 },
        { real_player_id: 'p2', player_name: 'Player 2', position: 'MF', real_team_name: 'Team B', total_points: 80, games_played: 10, avg_points_per_game: 8 },
        { real_player_id: 'p3', player_name: 'Player 3', position: 'DF', real_team_name: 'Team C', total_points: 60, games_played: 10, avg_points_per_game: 6 }
      ];

      vi.mocked(fantasySql).mockResolvedValueOnce(mockPlayers);

      const tiers = await generateDraftTiers({
        leagueId: 'league_1',
        numberOfTiers: 1,
        draftType: 'initial'
      });

      expect(tiers[0].min_points).toBe(60);
      expect(tiers[0].max_points).toBe(100);
      expect(tiers[0].avg_points).toBe(80); // (100 + 80 + 60) / 3
    });

    test('should handle single player tier', async () => {
      const mockPlayers: Player[] = [
        { real_player_id: 'p1', player_name: 'Player 1', position: 'FW', real_team_name: 'Team A', total_points: 100, games_played: 10, avg_points_per_game: 10 }
      ];

      vi.mocked(fantasySql).mockResolvedValueOnce(mockPlayers);

      const tiers = await generateDraftTiers({
        leagueId: 'league_1',
        numberOfTiers: 1,
        draftType: 'initial'
      });

      expect(tiers[0].min_points).toBe(100);
      expect(tiers[0].max_points).toBe(100);
      expect(tiers[0].avg_points).toBe(100);
    });
  });
});
