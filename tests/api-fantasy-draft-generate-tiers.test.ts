/**
 * API tests for fantasy draft tier generation endpoint
 * 
 * Tests verify:
 * - Endpoint returns 200 with tier data
 * - Only committee can access
 * - Tiers stored in database
 * - Proper error messages
 * 
 * To run: npx vitest run tests/api-fantasy-draft-generate-tiers.test.ts
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { POST } from '../app/api/fantasy/draft/generate-tiers/route';
import { NextRequest } from 'next/server';

// Mock the auth helper
vi.mock('../lib/auth-helper', () => ({
  verifyAuth: vi.fn()
}));

// Mock the tier generator
vi.mock('../lib/fantasy/tier-generator', () => ({
  generateDraftTiers: vi.fn(),
  saveTiersToDatabase: vi.fn()
}));

import { verifyAuth } from '../lib/auth-helper';
import { generateDraftTiers, saveTiersToDatabase } from '../lib/fantasy/tier-generator';

describe('Fantasy Draft Generate Tiers API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/fantasy/draft/generate-tiers', () => {
    // Helper function to create a mock request
    const createMockRequest = (body: any) => {
      return new NextRequest('http://localhost:3000/api/fantasy/draft/generate-tiers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    };

    // Mock tier data
    const mockTiers = [
      {
        tier_id: 'tier_1',
        tier_number: 1,
        tier_name: 'Elite',
        players: [
          {
            real_player_id: 'P1',
            player_name: 'Player 1',
            position: 'Forward',
            real_team_name: 'Team A',
            total_points: 100,
            games_played: 10,
            avg_points_per_game: 10
          }
        ],
        player_count: 1,
        min_points: 100,
        max_points: 100,
        avg_points: 100
      },
      {
        tier_id: 'tier_2',
        tier_number: 2,
        tier_name: 'Stars',
        players: [
          {
            real_player_id: 'P2',
            player_name: 'Player 2',
            position: 'Midfielder',
            real_team_name: 'Team B',
            total_points: 80,
            games_played: 10,
            avg_points_per_game: 8
          }
        ],
        player_count: 1,
        min_points: 80,
        max_points: 80,
        avg_points: 80
      }
    ];

    test('should return 401 when user is not authenticated', async () => {
      // Mock authentication failure
      vi.mocked(verifyAuth).mockResolvedValue({
        authenticated: false,
        error: 'No token provided'
      });

      const request = createMockRequest({
        league_id: 'league_1',
        draft_type: 'initial',
        number_of_tiers: 7
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
      expect(data.error).toMatch(/Unauthorized|No token provided/);
    });

    test('should return 401 when user is not committee admin', async () => {
      // Mock authentication success but wrong role
      vi.mocked(verifyAuth).mockResolvedValue({
        authenticated: false,
        userId: 'user_123',
        role: 'team_owner',
        error: 'Access denied. Required roles: committee_admin'
      });

      const request = createMockRequest({
        league_id: 'league_1',
        draft_type: 'initial',
        number_of_tiers: 7
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });

    test('should return 400 when league_id is missing', async () => {
      // Mock successful authentication
      vi.mocked(verifyAuth).mockResolvedValue({
        authenticated: true,
        userId: 'admin_123',
        role: 'committee_admin'
      });

      const request = createMockRequest({
        draft_type: 'initial',
        number_of_tiers: 7
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('league_id is required');
    });

    test('should return 400 when draft_type is missing', async () => {
      vi.mocked(verifyAuth).mockResolvedValue({
        authenticated: true,
        userId: 'admin_123',
        role: 'committee_admin'
      });

      const request = createMockRequest({
        league_id: 'league_1',
        number_of_tiers: 7
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('draft_type is required');
    });

    test('should return 400 when draft_type is invalid', async () => {
      vi.mocked(verifyAuth).mockResolvedValue({
        authenticated: true,
        userId: 'admin_123',
        role: 'committee_admin'
      });

      const request = createMockRequest({
        league_id: 'league_1',
        draft_type: 'invalid_type',
        number_of_tiers: 7
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('draft_type must be "initial" or "transfer"');
    });

    test('should return 400 when number_of_tiers is missing', async () => {
      vi.mocked(verifyAuth).mockResolvedValue({
        authenticated: true,
        userId: 'admin_123',
        role: 'committee_admin'
      });

      const request = createMockRequest({
        league_id: 'league_1',
        draft_type: 'initial'
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('number_of_tiers must be a positive integer');
    });

    test('should return 400 when number_of_tiers is not positive', async () => {
      vi.mocked(verifyAuth).mockResolvedValue({
        authenticated: true,
        userId: 'admin_123',
        role: 'committee_admin'
      });

      const request = createMockRequest({
        league_id: 'league_1',
        draft_type: 'initial',
        number_of_tiers: 0
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('number_of_tiers must be a positive integer');
    });

    test('should successfully generate tiers with valid request', async () => {
      // Mock successful authentication
      vi.mocked(verifyAuth).mockResolvedValue({
        authenticated: true,
        userId: 'admin_123',
        role: 'committee_admin'
      });

      // Mock tier generation
      vi.mocked(generateDraftTiers).mockResolvedValue(mockTiers);
      vi.mocked(saveTiersToDatabase).mockResolvedValue(undefined);

      const request = createMockRequest({
        league_id: 'league_1',
        draft_type: 'initial',
        number_of_tiers: 2
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('Successfully generated 2 tiers');
      expect(data.tiers).toHaveLength(2);
      expect(data.tiers[0]).toMatchObject({
        tier_id: 'tier_1',
        tier_number: 1,
        tier_name: 'Elite',
        player_count: 1,
        min_points: 100,
        max_points: 100,
        avg_points: 100
      });
    });

    test('should call generateDraftTiers with correct options', async () => {
      vi.mocked(verifyAuth).mockResolvedValue({
        authenticated: true,
        userId: 'admin_123',
        role: 'committee_admin'
      });

      vi.mocked(generateDraftTiers).mockResolvedValue(mockTiers);
      vi.mocked(saveTiersToDatabase).mockResolvedValue(undefined);

      const request = createMockRequest({
        league_id: 'league_1',
        draft_type: 'transfer',
        number_of_tiers: 5,
        min_games_played: 3
      });

      await POST(request);

      expect(generateDraftTiers).toHaveBeenCalledWith({
        leagueId: 'league_1',
        numberOfTiers: 5,
        draftType: 'transfer',
        minGamesPlayed: 3
      });
    });

    test('should call saveTiersToDatabase with correct parameters', async () => {
      vi.mocked(verifyAuth).mockResolvedValue({
        authenticated: true,
        userId: 'admin_123',
        role: 'committee_admin'
      });

      vi.mocked(generateDraftTiers).mockResolvedValue(mockTiers);
      vi.mocked(saveTiersToDatabase).mockResolvedValue(undefined);

      const request = createMockRequest({
        league_id: 'league_1',
        draft_type: 'initial',
        number_of_tiers: 2
      });

      await POST(request);

      expect(saveTiersToDatabase).toHaveBeenCalledWith(
        'league_1',
        mockTiers,
        'initial'
      );
    });

    test('should return tier data with all required fields', async () => {
      vi.mocked(verifyAuth).mockResolvedValue({
        authenticated: true,
        userId: 'admin_123',
        role: 'committee_admin'
      });

      vi.mocked(generateDraftTiers).mockResolvedValue(mockTiers);
      vi.mocked(saveTiersToDatabase).mockResolvedValue(undefined);

      const request = createMockRequest({
        league_id: 'league_1',
        draft_type: 'initial',
        number_of_tiers: 2
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.tiers[0]).toHaveProperty('tier_id');
      expect(data.tiers[0]).toHaveProperty('tier_number');
      expect(data.tiers[0]).toHaveProperty('tier_name');
      expect(data.tiers[0]).toHaveProperty('players');
      expect(data.tiers[0]).toHaveProperty('player_count');
      expect(data.tiers[0]).toHaveProperty('min_points');
      expect(data.tiers[0]).toHaveProperty('max_points');
      expect(data.tiers[0]).toHaveProperty('avg_points');
    });

    test('should return 500 when tier generation fails', async () => {
      vi.mocked(verifyAuth).mockResolvedValue({
        authenticated: true,
        userId: 'admin_123',
        role: 'committee_admin'
      });

      // Mock tier generation failure
      vi.mocked(generateDraftTiers).mockRejectedValue(
        new Error('Database connection failed')
      );

      const request = createMockRequest({
        league_id: 'league_1',
        draft_type: 'initial',
        number_of_tiers: 7
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Failed to generate draft tiers');
      expect(data.details).toBe('Database connection failed');
    });

    test('should return 500 when saving tiers to database fails', async () => {
      vi.mocked(verifyAuth).mockResolvedValue({
        authenticated: true,
        userId: 'admin_123',
        role: 'committee_admin'
      });

      vi.mocked(generateDraftTiers).mockResolvedValue(mockTiers);
      
      // Mock database save failure
      vi.mocked(saveTiersToDatabase).mockRejectedValue(
        new Error('Failed to insert into database')
      );

      const request = createMockRequest({
        league_id: 'league_1',
        draft_type: 'initial',
        number_of_tiers: 2
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Failed to generate draft tiers');
      expect(data.details).toBe('Failed to insert into database');
    });

    test('should handle initial draft type correctly', async () => {
      vi.mocked(verifyAuth).mockResolvedValue({
        authenticated: true,
        userId: 'admin_123',
        role: 'committee_admin'
      });

      vi.mocked(generateDraftTiers).mockResolvedValue(mockTiers);
      vi.mocked(saveTiersToDatabase).mockResolvedValue(undefined);

      const request = createMockRequest({
        league_id: 'league_1',
        draft_type: 'initial',
        number_of_tiers: 7
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(generateDraftTiers).toHaveBeenCalledWith(
        expect.objectContaining({ draftType: 'initial' })
      );
    });

    test('should handle transfer draft type correctly', async () => {
      vi.mocked(verifyAuth).mockResolvedValue({
        authenticated: true,
        userId: 'admin_123',
        role: 'committee_admin'
      });

      vi.mocked(generateDraftTiers).mockResolvedValue(mockTiers);
      vi.mocked(saveTiersToDatabase).mockResolvedValue(undefined);

      const request = createMockRequest({
        league_id: 'league_1',
        draft_type: 'transfer',
        number_of_tiers: 5
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(generateDraftTiers).toHaveBeenCalledWith(
        expect.objectContaining({ draftType: 'transfer' })
      );
    });

    test('should handle optional min_games_played parameter', async () => {
      vi.mocked(verifyAuth).mockResolvedValue({
        authenticated: true,
        userId: 'admin_123',
        role: 'committee_admin'
      });

      vi.mocked(generateDraftTiers).mockResolvedValue(mockTiers);
      vi.mocked(saveTiersToDatabase).mockResolvedValue(undefined);

      const request = createMockRequest({
        league_id: 'league_1',
        draft_type: 'initial',
        number_of_tiers: 7,
        min_games_played: 5
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(generateDraftTiers).toHaveBeenCalledWith(
        expect.objectContaining({ minGamesPlayed: 5 })
      );
    });

    test('should work without min_games_played parameter', async () => {
      vi.mocked(verifyAuth).mockResolvedValue({
        authenticated: true,
        userId: 'admin_123',
        role: 'committee_admin'
      });

      vi.mocked(generateDraftTiers).mockResolvedValue(mockTiers);
      vi.mocked(saveTiersToDatabase).mockResolvedValue(undefined);

      const request = createMockRequest({
        league_id: 'league_1',
        draft_type: 'initial',
        number_of_tiers: 7
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(generateDraftTiers).toHaveBeenCalledWith(
        expect.objectContaining({ 
          leagueId: 'league_1',
          numberOfTiers: 7,
          draftType: 'initial'
        })
      );
    });
  });
});
