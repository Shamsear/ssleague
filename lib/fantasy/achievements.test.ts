/**
 * Tests for Fantasy Achievements System
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ACHIEVEMENTS,
  checkAchievements,
  getUnlockedAchievements,
  getAchievementById,
  getAchievementsWithStatus,
  getAchievementsByCategory,
  getAchievementsByRarity,
  getAchievementProgress,
  type TeamData
} from './achievements';

// Mock database
vi.mock('@/lib/neon/config', () => ({
  sql: vi.fn()
}));

describe('Fantasy Achievements System', () => {
  let mockSql: any;

  beforeEach(async () => {
    const { sql } = await import('@/lib/neon/config');
    mockSql = sql;
    vi.mocked(mockSql).mockClear();
  });

  describe('Achievement Definitions', () => {
    it('should have all required achievement properties', () => {
      ACHIEVEMENTS.forEach(achievement => {
        expect(achievement).toHaveProperty('achievement_id');
        expect(achievement).toHaveProperty('name');
        expect(achievement).toHaveProperty('description');
        expect(achievement).toHaveProperty('badge_emoji');
        expect(achievement).toHaveProperty('category');
        expect(achievement).toHaveProperty('points_reward');
        expect(achievement).toHaveProperty('rarity');
        expect(achievement).toHaveProperty('check_condition');
      });
    });

    it('should have unique achievement IDs', () => {
      const ids = ACHIEVEMENTS.map(a => a.achievement_id);
      const uniqueIds = new Set(ids);
      expect(ids.length).toBe(uniqueIds.size);
    });

    it('should have valid categories', () => {
      const validCategories = ['scoring', 'lineup', 'trading', 'consistency', 'special', 'season'];
      ACHIEVEMENTS.forEach(achievement => {
        expect(validCategories).toContain(achievement.category);
      });
    });

    it('should have valid rarities', () => {
      const validRarities = ['common', 'rare', 'epic', 'legendary'];
      ACHIEVEMENTS.forEach(achievement => {
        expect(validRarities).toContain(achievement.rarity);
      });
    });
  });

  describe('getAchievementById', () => {
    it('should return achievement by ID', () => {
      const achievement = getAchievementById('century_maker');
      expect(achievement).toBeDefined();
      expect(achievement?.achievement_id).toBe('century_maker');
      expect(achievement?.name).toBe('Century Maker');
    });

    it('should return undefined for non-existent ID', () => {
      const achievement = getAchievementById('non_existent');
      expect(achievement).toBeUndefined();
    });
  });

  describe('getAchievementsByCategory', () => {
    it('should return achievements by category', () => {
      const scoringAchievements = getAchievementsByCategory('scoring');
      expect(scoringAchievements.length).toBeGreaterThan(0);
      scoringAchievements.forEach(a => {
        expect(a.category).toBe('scoring');
      });
    });

    it('should return empty array for category with no achievements', () => {
      const achievements = getAchievementsByCategory('nonexistent' as any);
      expect(achievements).toEqual([]);
    });
  });

  describe('getAchievementsByRarity', () => {
    it('should return achievements by rarity', () => {
      const legendaryAchievements = getAchievementsByRarity('legendary');
      expect(legendaryAchievements.length).toBeGreaterThan(0);
      legendaryAchievements.forEach(a => {
        expect(a.rarity).toBe('legendary');
      });
    });
  });

  describe('Achievement Conditions', () => {
    const mockTeamData: TeamData = {
      team_id: 'team1',
      league_id: 'league1',
      total_points: 500,
      weekly_points: [80, 90, 100, 110, 120],
      lineup_history: [],
      trades_made: 5,
      current_rank: 1,
      total_teams: 10,
      captain_success_rate: 0.85,
      perfect_lineups: 2,
      highest_weekly_score: 120,
      lowest_weekly_score: 80,
      consecutive_wins: 3,
      squad_size: 15
    };

    it('should unlock century_maker for 100+ points', () => {
      const achievement = getAchievementById('century_maker');
      expect(achievement?.check_condition(mockTeamData)).toBe(true);
    });

    it('should not unlock double_century for score under 200', () => {
      const achievement = getAchievementById('double_century');
      expect(achievement?.check_condition(mockTeamData)).toBe(false);
    });

    it('should unlock wheeler_dealer for 5+ trades', () => {
      const achievement = getAchievementById('wheeler_dealer');
      expect(achievement?.check_condition(mockTeamData)).toBe(true);
    });

    it('should unlock champion for rank 1', () => {
      const achievement = getAchievementById('champion');
      expect(achievement?.check_condition(mockTeamData)).toBe(true);
    });

    it('should unlock top_half for top 50% finish', () => {
      const achievement = getAchievementById('top_half');
      const data = { ...mockTeamData, current_rank: 5 };
      expect(achievement?.check_condition(data)).toBe(true);
    });

    it('should check consistent_performer for 5 consecutive 50+ weeks', () => {
      const achievement = getAchievementById('consistent_performer');
      const data = { ...mockTeamData, weekly_points: [60, 65, 70, 55, 80] };
      expect(achievement?.check_condition(data)).toBe(true);
      
      const failData = { ...mockTeamData, weekly_points: [60, 40, 70, 55, 80] };
      expect(achievement?.check_condition(failData)).toBe(false);
    });
  });

  describe('checkAchievements', () => {
    it('should check and award new achievements', async () => {
      mockSql
        .mockResolvedValueOnce([{ // Team data
          team_id: 'team1',
          league_id: 'league1',
          total_points: 500,
          trades_made: 5
        }])
        .mockResolvedValueOnce([{ total_points: 100 }]) // Weekly points
        .mockResolvedValueOnce([]) // Lineup history
        .mockResolvedValueOnce([{ team_id: 'team1', rank: 1 }]) // Rank
        .mockResolvedValueOnce([{ count: 10 }]) // Total teams
        .mockResolvedValueOnce([{ count: 15 }]) // Squad size
        .mockResolvedValueOnce([]) // Already unlocked
        .mockResolvedValueOnce(undefined) // Insert achievement
        .mockResolvedValueOnce(undefined); // Update points

      const result = await checkAchievements('team1', 'league1');
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getUnlockedAchievements', () => {
    it('should return unlocked achievements for a team', async () => {
      const mockAchievements = [
        {
          team_id: 'team1',
          achievement_id: 'century_maker',
          unlocked_at: new Date(),
          points_awarded: 10
        }
      ];

      mockSql.mockResolvedValueOnce(mockAchievements);

      const result = await getUnlockedAchievements('team1');
      expect(result).toHaveLength(1);
      expect(result[0].achievement_id).toBe('century_maker');
    });
  });

  describe('getAchievementsWithStatus', () => {
    it('should return all achievements with unlock status', async () => {
      mockSql.mockResolvedValueOnce([
        {
          team_id: 'team1',
          achievement_id: 'century_maker',
          unlocked_at: new Date(),
          points_awarded: 10
        }
      ]);

      const result = await getAchievementsWithStatus('team1');
      expect(result.length).toBe(ACHIEVEMENTS.length);
      
      const centuryMaker = result.find(a => a.achievement_id === 'century_maker');
      expect(centuryMaker?.is_unlocked).toBe(true);
      
      const doubleCentury = result.find(a => a.achievement_id === 'double_century');
      expect(doubleCentury?.is_unlocked).toBe(false);
    });
  });

  describe('getAchievementProgress', () => {
    it('should calculate achievement progress', async () => {
      mockSql.mockResolvedValueOnce([
        {
          team_id: 'team1',
          achievement_id: 'century_maker',
          unlocked_at: new Date(),
          points_awarded: 10
        },
        {
          team_id: 'team1',
          achievement_id: 'wheeler_dealer',
          unlocked_at: new Date(),
          points_awarded: 15
        }
      ]);

      const result = await getAchievementProgress('team1');
      expect(result.total).toBe(ACHIEVEMENTS.length);
      expect(result.unlocked).toBe(2);
      expect(result.points_earned).toBe(25);
      expect(result.percentage).toBeGreaterThan(0);
    });
  });
});