/**
 * Tests for GET /api/fantasy/draft/my-results
 * Endpoint to fetch draft results for a specific team
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GET } from '@/app/api/fantasy/draft/my-results/route';
import { NextRequest } from 'next/server';
import * as authHelper from '@/lib/auth-helper';
import { fantasySql } from '@/lib/neon/fantasy-config';

// Mock dependencies
vi.mock('@/lib/auth-helper');
vi.mock('@/lib/neon/fantasy-config', () => ({
  fantasySql: vi.fn()
}));

describe('GET /api/fantasy/draft/my-results', () => {
  const mockTeamId = 'team_test_123';
  const mockLeagueId = 'league_test_123';
  const mockUserId = 'user_test_123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Authentication', () => {
    it('should require authentication', async () => {
      vi.mocked(authHelper.verifyAuth).mockResolvedValue({
        authenticated: false,
        user: null
      });

      const request = new NextRequest(
        `http://localhost:3000/api/fantasy/draft/my-results?team_id=${mockTeamId}&league_id=${mockLeagueId}`,
        { method: 'GET' }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });
  });

  describe('Request Validation', () => {
    beforeEach(() => {
      vi.mocked(authHelper.verifyAuth).mockResolvedValue({
        authenticated: true,
        user: { uid: mockUserId }
      });
    });

    it('should require team_id parameter', async () => {
      const request = new NextRequest(
        `http://localhost:3000/api/fantasy/draft/my-results?league_id=${mockLeagueId}`,
        { method: 'GET' }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('team_id');
    });

    it('should require league_id parameter', async () => {
      const request = new NextRequest(
        `http://localhost:3000/api/fantasy/draft/my-results?team_id=${mockTeamId}`,
        { method: 'GET' }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('league_id');
    });
  });

  describe('Authorization', () => {
    beforeEach(() => {
      vi.mocked(authHelper.verifyAuth).mockResolvedValue({
        authenticated: true,
        user: { uid: mockUserId }
      });
    });

    it('should return 404 if team not found', async () => {
      vi.mocked(fantasySql).mockResolvedValue([]);

      const request = new NextRequest(
        `http://localhost:3000/api/fantasy/draft/my-results?team_id=${mockTeamId}&league_id=${mockLeagueId}`,
        { method: 'GET' }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Team not found');
    });

    it('should return 403 if user does not own the team', async () => {
      vi.mocked(fantasySql).mockResolvedValue([
        {
          team_id: mockTeamId,
          owner_uid: 'different_user',
          team_name: 'Test Team',
          budget: '100',
          budget_remaining: '50',
          squad_size: 5
        }
      ]);

      const request = new NextRequest(
        `http://localhost:3000/api/fantasy/draft/my-results?team_id=${mockTeamId}&league_id=${mockLeagueId}`,
        { method: 'GET' }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain('Forbidden');
    });
  });

  describe('Successful Response', () => {
    beforeEach(() => {
      vi.mocked(authHelper.verifyAuth).mockResolvedValue({
        authenticated: true,
        user: { uid: mockUserId }
      });
    });

    it('should return draft results with all data', async () => {
      const mockTeam = {
        team_id: mockTeamId,
        owner_uid: mockUserId,
        team_name: 'Test Team',
        budget: '100',
        budget_remaining: '50',
        squad_size: 3
      };

      const mockBids = [
        {
          bid_id: 'bid_1',
          tier_id: 'tier_1',
          player_id: 'player_1',
          bid_amount: '20',
          is_skip: false,
          status: 'won',
          submitted_at: new Date(),
          processed_at: new Date(),
          tier_number: 1,
          tier_name: 'Elite',
          player_name: 'Player One',
          position: 'FWD',
          real_team_name: 'Team A',
          total_points: '150'
        },
        {
          bid_id: 'bid_2',
          tier_id: 'tier_2',
          player_id: 'player_2',
          bid_amount: '15',
          is_skip: false,
          status: 'lost',
          submitted_at: new Date(),
          processed_at: new Date(),
          tier_number: 2,
          tier_name: 'Stars',
          player_name: 'Player Two',
          position: 'MID',
          real_team_name: 'Team B',
          total_points: '120'
        },
        {
          bid_id: 'bid_3',
          tier_id: 'tier_3',
          player_id: null,
          bid_amount: null,
          is_skip: true,
          status: 'skipped',
          submitted_at: new Date(),
          processed_at: new Date(),
          tier_number: 3,
          tier_name: 'Quality',
          player_name: null,
          position: null,
          real_team_name: null,
          total_points: null
        }
      ];

      const mockSquad = [
        {
          real_player_id: 'player_1',
          player_name: 'Player One',
          position: 'FWD',
          real_team_name: 'Team A',
          purchase_price: '20',
          acquisition_tier: 1,
          total_points: '150',
          games_played: 10,
          avg_points_per_game: '15'
        }
      ];

      vi.mocked(fantasySql)
        .mockResolvedValueOnce([mockTeam])
        .mockResolvedValueOnce(mockBids)
        .mockResolvedValueOnce(mockSquad);

      const request = new NextRequest(
        `http://localhost:3000/api/fantasy/draft/my-results?team_id=${mockTeamId}&league_id=${mockLeagueId}`,
        { method: 'GET' }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.team).toBeDefined();
      expect(data.team.team_id).toBe(mockTeamId);
      expect(data.team.team_name).toBe('Test Team');
      expect(data.bids).toHaveLength(3);
      expect(data.squad).toHaveLength(1);
      expect(data.stats).toBeDefined();
      expect(data.stats.won).toBe(1);
      expect(data.stats.lost).toBe(1);
      expect(data.stats.skipped).toBe(1);
    });

    it('should handle empty squad', async () => {
      const mockTeam = {
        team_id: mockTeamId,
        owner_uid: mockUserId,
        team_name: 'Test Team',
        budget: '100',
        budget_remaining: '100',
        squad_size: 0
      };

      vi.mocked(fantasySql)
        .mockResolvedValueOnce([mockTeam])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const request = new NextRequest(
        `http://localhost:3000/api/fantasy/draft/my-results?team_id=${mockTeamId}&league_id=${mockLeagueId}`,
        { method: 'GET' }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.bids).toHaveLength(0);
      expect(data.squad).toHaveLength(0);
      expect(data.stats.squad_size).toBe(0);
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      vi.mocked(authHelper.verifyAuth).mockResolvedValue({
        authenticated: true,
        user: { uid: mockUserId }
      });
    });

    it('should handle database errors', async () => {
      vi.mocked(fantasySql).mockRejectedValue(new Error('Database error'));

      const request = new NextRequest(
        `http://localhost:3000/api/fantasy/draft/my-results?team_id=${mockTeamId}&league_id=${mockLeagueId}`,
        { method: 'GET' }
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch draft results');
    });
  });
});
