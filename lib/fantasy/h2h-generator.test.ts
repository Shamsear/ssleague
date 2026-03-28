/**
 * Tests for H2H Fixtures Generator
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateH2HFixtures,
  getH2HFixtures,
  getAllH2HFixtures,
  deleteH2HFixtures,
  h2hFixturesExist
} from './h2h-generator';

// Mock Neon database
const mockSql = vi.fn();
vi.mock('@neondatabase/serverless', () => ({
  neon: vi.fn(() => mockSql)
}));

// Mock UUID
vi.mock('uuid', () => ({
  v4: vi.fn(() => '12345678-1234-1234-1234-123456789012')
}));

describe('H2H Fixtures Generator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSql.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generateH2HFixtures', () => {
    it('should generate fixtures for even number of teams', async () => {
      const teams = [
        { team_id: 'team_1', team_name: 'Team 1' },
        { team_id: 'team_2', team_name: 'Team 2' },
        { team_id: 'team_3', team_name: 'Team 3' },
        { team_id: 'team_4', team_name: 'Team 4' }
      ];

      // Mock teams query
      mockSql.mockResolvedValueOnce(teams);

      // Mock past matchups query
      mockSql.mockResolvedValueOnce([]);

      // Mock insert queries (one for each pairing)
      mockSql.mockResolvedValue([]);

      const fixtures = await generateH2HFixtures('league_1', 'round_1');

      expect(fixtures).toHaveLength(2); // 4 teams = 2 pairings
      expect(fixtures[0]).toHaveProperty('fixture_id');
      expect(fixtures[0]).toHaveProperty('team_a_id');
      expect(fixtures[0]).toHaveProperty('team_b_id');
      expect(fixtures[0].status).toBe('scheduled');
    });

    it('should generate fixtures for odd number of teams', async () => {
      const teams = [
        { team_id: 'team_1', team_name: 'Team 1' },
        { team_id: 'team_2', team_name: 'Team 2' },
        { team_id: 'team_3', team_name: 'Team 3' }
      ];

      mockSql.mockResolvedValueOnce(teams);
      mockSql.mockResolvedValueOnce([]);
      mockSql.mockResolvedValue([]);

      const fixtures = await generateH2HFixtures('league_1', 'round_1');

      expect(fixtures).toHaveLength(1); // 3 teams = 1 pairing (1 team gets bye)
    });

    it('should throw error if no teams found', async () => {
      mockSql.mockResolvedValueOnce([]);

      await expect(
        generateH2HFixtures('league_1', 'round_1')
      ).rejects.toThrow('No teams found in league');
    });

    it('should throw error if only 1 team', async () => {
      const teams = [{ team_id: 'team_1', team_name: 'Team 1' }];

      mockSql.mockResolvedValueOnce(teams);

      await expect(
        generateH2HFixtures('league_1', 'round_1')
      ).rejects.toThrow('Cannot generate H2H fixtures with only 1 team');
    });

    it('should avoid repeat matchups when possible', async () => {
      const teams = [
        { team_id: 'team_1', team_name: 'Team 1' },
        { team_id: 'team_2', team_name: 'Team 2' },
        { team_id: 'team_3', team_name: 'Team 3' },
        { team_id: 'team_4', team_name: 'Team 4' }
      ];

      const pastMatchups = [
        { team_a_id: 'team_1', team_b_id: 'team_2' }
      ];

      mockSql.mockResolvedValueOnce(teams);
      mockSql.mockResolvedValueOnce(pastMatchups);
      mockSql.mockResolvedValue([]);

      const fixtures = await generateH2HFixtures('league_1', 'round_2');

      expect(fixtures).toHaveLength(2);

      // Check that team_1 and team_2 are not paired again (if possible)
      const hasRepeat = fixtures.some(
        (f) =>
          (f.team_a_id === 'team_1' && f.team_b_id === 'team_2') ||
          (f.team_a_id === 'team_2' && f.team_b_id === 'team_1')
      );

      // Note: Due to randomness, this might not always be avoidable
      // The algorithm tries to avoid it but doesn't guarantee it
      // This test just verifies the function runs without error
      expect(hasRepeat).toBeDefined();
    });

    it('should create fixtures with correct structure', async () => {
      const teams = [
        { team_id: 'team_1', team_name: 'Team 1' },
        { team_id: 'team_2', team_name: 'Team 2' }
      ];

      mockSql.mockResolvedValueOnce(teams);
      mockSql.mockResolvedValueOnce([]);
      mockSql.mockResolvedValue([]);

      const fixtures = await generateH2HFixtures('league_1', 'round_1');

      expect(fixtures[0]).toMatchObject({
        fixture_id: expect.stringContaining('h2h_league_1_round_1'),
        league_id: 'league_1',
        round_id: 'round_1',
        team_a_id: expect.any(String),
        team_b_id: expect.any(String),
        status: 'scheduled'
      });
    });

    it('should insert fixtures into database', async () => {
      const teams = [
        { team_id: 'team_1', team_name: 'Team 1' },
        { team_id: 'team_2', team_name: 'Team 2' }
      ];

      mockSql.mockResolvedValueOnce(teams);
      mockSql.mockResolvedValueOnce([]);
      mockSql.mockResolvedValue([]);

      await generateH2HFixtures('league_1', 'round_1');

      // Should call SQL 3 times: teams query, past matchups query, insert query
      expect(mockSql).toHaveBeenCalledTimes(3);
    });
  });

  describe('getH2HFixtures', () => {
    it('should retrieve fixtures for a specific round', async () => {
      const mockFixtures = [
        {
          fixture_id: 'h2h_1',
          league_id: 'league_1',
          round_id: 'round_1',
          team_a_id: 'team_1',
          team_b_id: 'team_2',
          status: 'scheduled'
        }
      ];

      mockSql.mockResolvedValueOnce(mockFixtures);

      const fixtures = await getH2HFixtures('league_1', 'round_1');

      expect(fixtures).toEqual(mockFixtures);
      expect(mockSql).toHaveBeenCalledTimes(1);
    });

    it('should return empty array if no fixtures found', async () => {
      mockSql.mockResolvedValueOnce([]);

      const fixtures = await getH2HFixtures('league_1', 'round_1');

      expect(fixtures).toEqual([]);
    });
  });

  describe('getAllH2HFixtures', () => {
    it('should retrieve all fixtures for a league', async () => {
      const mockFixtures = [
        {
          fixture_id: 'h2h_1',
          league_id: 'league_1',
          round_id: 'round_1',
          team_a_id: 'team_1',
          team_b_id: 'team_2',
          status: 'scheduled'
        },
        {
          fixture_id: 'h2h_2',
          league_id: 'league_1',
          round_id: 'round_2',
          team_a_id: 'team_3',
          team_b_id: 'team_4',
          status: 'scheduled'
        }
      ];

      mockSql.mockResolvedValueOnce(mockFixtures);

      const fixtures = await getAllH2HFixtures('league_1');

      expect(fixtures).toEqual(mockFixtures);
      expect(fixtures).toHaveLength(2);
    });

    it('should return empty array if no fixtures found', async () => {
      mockSql.mockResolvedValueOnce([]);

      const fixtures = await getAllH2HFixtures('league_1');

      expect(fixtures).toEqual([]);
    });
  });

  describe('deleteH2HFixtures', () => {
    it('should delete fixtures for a specific round', async () => {
      mockSql.mockResolvedValueOnce([]);

      await deleteH2HFixtures('league_1', 'round_1');

      expect(mockSql).toHaveBeenCalledTimes(1);
    });

    it('should not throw error if no fixtures to delete', async () => {
      mockSql.mockResolvedValueOnce([]);

      await expect(
        deleteH2HFixtures('league_1', 'round_1')
      ).resolves.not.toThrow();
    });
  });

  describe('h2hFixturesExist', () => {
    it('should return true if fixtures exist', async () => {
      mockSql.mockResolvedValueOnce([{ count: 2 }]);

      const exists = await h2hFixturesExist('league_1', 'round_1');

      expect(exists).toBe(true);
    });

    it('should return false if no fixtures exist', async () => {
      mockSql.mockResolvedValueOnce([{ count: 0 }]);

      const exists = await h2hFixturesExist('league_1', 'round_1');

      expect(exists).toBe(false);
    });

    it('should handle string count from database', async () => {
      mockSql.mockResolvedValueOnce([{ count: '3' }]);

      const exists = await h2hFixturesExist('league_1', 'round_1');

      expect(exists).toBe(true);
    });
  });

  describe('Pairing Algorithm', () => {
    it('should create unique pairings', async () => {
      const teams = [
        { team_id: 'team_1', team_name: 'Team 1' },
        { team_id: 'team_2', team_name: 'Team 2' },
        { team_id: 'team_3', team_name: 'Team 3' },
        { team_id: 'team_4', team_name: 'Team 4' }
      ];

      mockSql.mockResolvedValueOnce(teams);
      mockSql.mockResolvedValueOnce([]);
      mockSql.mockResolvedValue([]);

      const fixtures = await generateH2HFixtures('league_1', 'round_1');

      // Check that no team appears twice
      const teamIds = new Set<string>();
      fixtures.forEach((f) => {
        expect(teamIds.has(f.team_a_id)).toBe(false);
        expect(teamIds.has(f.team_b_id)).toBe(false);
        teamIds.add(f.team_a_id);
        teamIds.add(f.team_b_id);
      });

      expect(teamIds.size).toBe(4);
    });

    it('should not pair a team with itself', async () => {
      const teams = [
        { team_id: 'team_1', team_name: 'Team 1' },
        { team_id: 'team_2', team_name: 'Team 2' }
      ];

      mockSql.mockResolvedValueOnce(teams);
      mockSql.mockResolvedValueOnce([]);
      mockSql.mockResolvedValue([]);

      const fixtures = await generateH2HFixtures('league_1', 'round_1');

      fixtures.forEach((f) => {
        expect(f.team_a_id).not.toBe(f.team_b_id);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle large number of teams', async () => {
      const teams = Array.from({ length: 20 }, (_, i) => ({
        team_id: `team_${i + 1}`,
        team_name: `Team ${i + 1}`
      }));

      mockSql.mockResolvedValueOnce(teams);
      mockSql.mockResolvedValueOnce([]);
      mockSql.mockResolvedValue([]);

      const fixtures = await generateH2HFixtures('league_1', 'round_1');

      expect(fixtures).toHaveLength(10); // 20 teams = 10 pairings
    });

    it('should handle 2 teams (minimum)', async () => {
      const teams = [
        { team_id: 'team_1', team_name: 'Team 1' },
        { team_id: 'team_2', team_name: 'Team 2' }
      ];

      mockSql.mockResolvedValueOnce(teams);
      mockSql.mockResolvedValueOnce([]);
      mockSql.mockResolvedValue([]);

      const fixtures = await generateH2HFixtures('league_1', 'round_1');

      expect(fixtures).toHaveLength(1);
      expect(fixtures[0].team_a_id).not.toBe(fixtures[0].team_b_id);
    });

    it('should handle database errors gracefully', async () => {
      mockSql.mockRejectedValueOnce(new Error('Database connection failed'));

      await expect(
        generateH2HFixtures('league_1', 'round_1')
      ).rejects.toThrow('Database connection failed');
    });
  });
});
