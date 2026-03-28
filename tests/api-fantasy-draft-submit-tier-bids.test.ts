/**
 * API tests for fantasy draft tier bid submission endpoint
 * 
 * Tests verify:
 * - Teams can submit bids for all tiers
 * - Budget validation works
 * - Can skip tiers
 * - Bids stored correctly
 * - Cannot exceed budget
 * - Team ownership validation
 * - Player selection validation
 * 
 * To run: npx vitest run tests/api-fantasy-draft-submit-tier-bids.test.ts
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { POST } from '../app/api/fantasy/draft/submit-tier-bids/route';
import { NextRequest } from 'next/server';

// Mock the auth helper
vi.mock('../lib/auth-helper', () => ({
  verifyAuth: vi.fn()
}));

// Mock the database
vi.mock('../lib/neon/fantasy-config', () => ({
  fantasySql: vi.fn()
}));

// Mock the tier generator
vi.mock('../lib/fantasy/tier-generator', () => ({
  getTiersFromDatabase: vi.fn()
}));

import { verifyAuth } from '../lib/auth-helper';
import { fantasySql } from '../lib/neon/fantasy-config';

describe('Fantasy Draft Submit Tier Bids API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/fantasy/draft/submit-tier-bids', () => {
    // Helper function to create a mock request
    const createMockRequest = (body: any) => {
      return new NextRequest('http://localhost:3000/api/fantasy/draft/submit-tier-bids', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    };

    // Mock team data
    const mockTeam = {
      team_id: 'team_1',
      owner_uid: 'user_123',
      budget: '100',
      league_id: 'league_1'
    };

    // Mock tier data
    const mockTiers = [
      {
        tier_id: 'tier_1',
        league_id: 'league_1',
        player_ids: ['P1', 'P2', 'P3']
      },
      {
        tier_id: 'tier_2',
        league_id: 'league_1',
        player_ids: ['P4', 'P5', 'P6']
      }
    ];

    // Mock league data
    const mockLeague = {
      draft_closes_at: new Date('2024-12-31T23:59:59Z')
    };

    test('should return 401 when user is not authenticated', async () => {
      vi.mocked(verifyAuth).mockResolvedValue({
        authenticated: false,
        error: 'No token provided'
      });

      const request = createMockRequest({
        team_id: 'team_1',
        league_id: 'league_1',
        bids: []
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });

    test('should return 400 when team_id is missing', async () => {
      vi.mocked(verifyAuth).mockResolvedValue({
        authenticated: true,
        userId: 'user_123'
      });

      const request = createMockRequest({
        league_id: 'league_1',
        bids: []
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('team_id is required');
    });

    test('should return 400 when league_id is missing', async () => {
      vi.mocked(verifyAuth).mockResolvedValue({
        authenticated: true,
        userId: 'user_123'
      });

      const request = createMockRequest({
        team_id: 'team_1',
        bids: []
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('league_id is required');
    });

    test('should return 400 when bids array is missing', async () => {
      vi.mocked(verifyAuth).mockResolvedValue({
        authenticated: true,
        userId: 'user_123'
      });

      const request = createMockRequest({
        team_id: 'team_1',
        league_id: 'league_1'
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('bids array is required and must not be empty');
    });

    test('should return 400 when bids array is empty', async () => {
      vi.mocked(verifyAuth).mockResolvedValue({
        authenticated: true,
        userId: 'user_123'
      });

      const request = createMockRequest({
        team_id: 'team_1',
        league_id: 'league_1',
        bids: []
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('bids array is required and must not be empty');
    });

    test('should return 404 when team is not found', async () => {
      vi.mocked(verifyAuth).mockResolvedValue({
        authenticated: true,
        userId: 'user_123'
      });

      // Mock empty team result
      vi.mocked(fantasySql).mockResolvedValueOnce([]);

      const request = createMockRequest({
        team_id: 'team_1',
        league_id: 'league_1',
        bids: [{ tier_id: 'tier_1', player_id: 'P1', bid_amount: 10 }]
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Team not found');
    });

    test('should return 403 when user does not own the team', async () => {
      vi.mocked(verifyAuth).mockResolvedValue({
        authenticated: true,
        userId: 'user_456' // Different user
      });

      // Mock team with different owner
      vi.mocked(fantasySql).mockResolvedValueOnce([mockTeam]);

      const request = createMockRequest({
        team_id: 'team_1',
        league_id: 'league_1',
        bids: [{ tier_id: 'tier_1', player_id: 'P1', bid_amount: 10 }]
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.error).toBe('You do not own this team');
    });

    test('should return 400 when team is not in the specified league', async () => {
      vi.mocked(verifyAuth).mockResolvedValue({
        authenticated: true,
        userId: 'user_123'
      });

      // Mock team in different league
      vi.mocked(fantasySql).mockResolvedValueOnce([{
        ...mockTeam,
        league_id: 'league_2'
      }]);

      const request = createMockRequest({
        team_id: 'team_1',
        league_id: 'league_1',
        bids: [{ tier_id: 'tier_1', player_id: 'P1', bid_amount: 10 }]
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Team is not in this league');
    });

    test('should return 400 when bid exceeds budget', async () => {
      vi.mocked(verifyAuth).mockResolvedValue({
        authenticated: true,
        userId: 'user_123'
      });

      vi.mocked(fantasySql).mockResolvedValueOnce([mockTeam]);

      const request = createMockRequest({
        team_id: 'team_1',
        league_id: 'league_1',
        bids: [
          { tier_id: 'tier_1', player_id: 'P1', bid_amount: 60 },
          { tier_id: 'tier_2', player_id: 'P4', bid_amount: 50 }
        ]
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Total bid amount exceeds available budget');
      expect(data.total_bid_amount).toBe(110);
      expect(data.available_budget).toBe(100);
      expect(data.overage).toBe(10);
    });

    test('should handle skip tier option', async () => {
      vi.mocked(verifyAuth).mockResolvedValue({
        authenticated: true,
        userId: 'user_123'
      });

      vi.mocked(fantasySql)
        .mockResolvedValueOnce([mockTeam]) // Get team
        .mockResolvedValueOnce(mockTiers) // Get tiers
        .mockResolvedValueOnce([]) // Delete existing bids
        .mockResolvedValueOnce([]) // Insert bid 1
        .mockResolvedValueOnce([]) // Insert bid 2
        .mockResolvedValueOnce([mockLeague]); // Get league

      const request = createMockRequest({
        team_id: 'team_1',
        league_id: 'league_1',
        bids: [
          { tier_id: 'tier_1', is_skip: true },
          { tier_id: 'tier_2', player_id: 'P4', bid_amount: 20 }
        ]
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.tiers_skipped).toBe(1);
      expect(data.total_bid_amount).toBe(20);
    });

    test('should return 400 when bid has no player_id and is not skip', async () => {
      vi.mocked(verifyAuth).mockResolvedValue({
        authenticated: true,
        userId: 'user_123'
      });

      vi.mocked(fantasySql).mockResolvedValueOnce([mockTeam]);

      const request = createMockRequest({
        team_id: 'team_1',
        league_id: 'league_1',
        bids: [
          { tier_id: 'tier_1', bid_amount: 20 } // Missing player_id
        ]
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('must have a player_id or be marked as skip');
    });

    test('should return 400 when bid has no bid_amount and is not skip', async () => {
      vi.mocked(verifyAuth).mockResolvedValue({
        authenticated: true,
        userId: 'user_123'
      });

      vi.mocked(fantasySql).mockResolvedValueOnce([mockTeam]);

      const request = createMockRequest({
        team_id: 'team_1',
        league_id: 'league_1',
        bids: [
          { tier_id: 'tier_1', player_id: 'P1' } // Missing bid_amount
        ]
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('must have a bid_amount or be marked as skip');
    });

    test('should return 400 when bid amount is negative', async () => {
      vi.mocked(verifyAuth).mockResolvedValue({
        authenticated: true,
        userId: 'user_123'
      });

      vi.mocked(fantasySql).mockResolvedValueOnce([mockTeam]);

      const request = createMockRequest({
        team_id: 'team_1',
        league_id: 'league_1',
        bids: [
          { tier_id: 'tier_1', player_id: 'P1', bid_amount: -10 }
        ]
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Bid amount must be non-negative');
    });

    test('should return 400 when tier_id is invalid', async () => {
      vi.mocked(verifyAuth).mockResolvedValue({
        authenticated: true,
        userId: 'user_123'
      });

      vi.mocked(fantasySql)
        .mockResolvedValueOnce([mockTeam]) // Get team
        .mockResolvedValueOnce([]); // Get tiers - empty result

      const request = createMockRequest({
        team_id: 'team_1',
        league_id: 'league_1',
        bids: [
          { tier_id: 'invalid_tier', player_id: 'P1', bid_amount: 10 }
        ]
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('One or more tier IDs are invalid');
    });

    test('should return 400 when player is not in the specified tier', async () => {
      vi.mocked(verifyAuth).mockResolvedValue({
        authenticated: true,
        userId: 'user_123'
      });

      vi.mocked(fantasySql)
        .mockResolvedValueOnce([mockTeam]) // Get team
        .mockResolvedValueOnce([mockTiers[0]]); // Get tiers - return only tier_1

      const request = createMockRequest({
        team_id: 'team_1',
        league_id: 'league_1',
        bids: [
          { tier_id: 'tier_1', player_id: 'P99', bid_amount: 10 } // P99 not in tier_1
        ]
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Player P99 is not in tier tier_1');
    });

    test('should successfully submit valid bids', async () => {
      vi.mocked(verifyAuth).mockResolvedValue({
        authenticated: true,
        userId: 'user_123'
      });

      vi.mocked(fantasySql)
        .mockResolvedValueOnce([mockTeam]) // Get team
        .mockResolvedValueOnce(mockTiers) // Get tiers
        .mockResolvedValueOnce([]) // Delete existing bids
        .mockResolvedValueOnce([]) // Insert bid 1
        .mockResolvedValueOnce([]) // Insert bid 2
        .mockResolvedValueOnce([mockLeague]); // Get league

      const request = createMockRequest({
        team_id: 'team_1',
        league_id: 'league_1',
        bids: [
          { tier_id: 'tier_1', player_id: 'P1', bid_amount: 30 },
          { tier_id: 'tier_2', player_id: 'P4', bid_amount: 20 }
        ]
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('Successfully submitted 2 bids');
      expect(data.total_bid_amount).toBe(50);
      expect(data.tiers_skipped).toBe(0);
      expect(data.bids_submitted).toBe(2);
      expect(data.deadline).toBeDefined();
    });

    test('should allow zero bid amount', async () => {
      vi.mocked(verifyAuth).mockResolvedValue({
        authenticated: true,
        userId: 'user_123'
      });

      vi.mocked(fantasySql)
        .mockResolvedValueOnce([mockTeam]) // Get team
        .mockResolvedValueOnce([mockTiers[0]]) // Get tiers
        .mockResolvedValueOnce([]) // Delete existing bids
        .mockResolvedValueOnce([]) // Insert bid
        .mockResolvedValueOnce([mockLeague]); // Get league

      const request = createMockRequest({
        team_id: 'team_1',
        league_id: 'league_1',
        bids: [
          { tier_id: 'tier_1', player_id: 'P1', bid_amount: 0 }
        ]
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.total_bid_amount).toBe(0);
    });

    test('should calculate total bid amount correctly', async () => {
      vi.mocked(verifyAuth).mockResolvedValue({
        authenticated: true,
        userId: 'user_123'
      });

      vi.mocked(fantasySql)
        .mockResolvedValueOnce([mockTeam]) // Get team
        .mockResolvedValueOnce(mockTiers) // Get tiers
        .mockResolvedValueOnce([]) // Delete existing bids
        .mockResolvedValueOnce([]) // Insert bid 1
        .mockResolvedValueOnce([]) // Insert bid 2
        .mockResolvedValueOnce([mockLeague]); // Get league

      const request = createMockRequest({
        team_id: 'team_1',
        league_id: 'league_1',
        bids: [
          { tier_id: 'tier_1', player_id: 'P1', bid_amount: 25.50 },
          { tier_id: 'tier_2', player_id: 'P4', bid_amount: 34.75 }
        ]
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.total_bid_amount).toBe(60.25);
    });

    test('should handle mix of regular bids and skips', async () => {
      vi.mocked(verifyAuth).mockResolvedValue({
        authenticated: true,
        userId: 'user_123'
      });

      vi.mocked(fantasySql)
        .mockResolvedValueOnce([mockTeam]) // Get team
        .mockResolvedValueOnce(mockTiers) // Get tiers
        .mockResolvedValueOnce([]) // Delete existing bids
        .mockResolvedValueOnce([]) // Insert bid 1
        .mockResolvedValueOnce([]) // Insert bid 2
        .mockResolvedValueOnce([mockLeague]); // Get league

      const request = createMockRequest({
        team_id: 'team_1',
        league_id: 'league_1',
        bids: [
          { tier_id: 'tier_1', is_skip: true },
          { tier_id: 'tier_2', player_id: 'P4', bid_amount: 40 }
        ]
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.total_bid_amount).toBe(40);
      expect(data.tiers_skipped).toBe(1);
      expect(data.bids_submitted).toBe(2);
    });

    test('should return 500 when database operation fails', async () => {
      vi.mocked(verifyAuth).mockResolvedValue({
        authenticated: true,
        userId: 'user_123'
      });

      // Mock database error on first call
      vi.mocked(fantasySql).mockRejectedValueOnce(
        new Error('Database connection failed')
      );

      const request = createMockRequest({
        team_id: 'team_1',
        league_id: 'league_1',
        bids: [
          { tier_id: 'tier_1', player_id: 'P1', bid_amount: 10 }
        ]
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Failed to submit tier bids');
      expect(data.details).toBe('Database connection failed');
    });

    test('should return null deadline when league has no draft_closes_at', async () => {
      vi.mocked(verifyAuth).mockResolvedValue({
        authenticated: true,
        userId: 'user_123'
      });

      vi.mocked(fantasySql)
        .mockResolvedValueOnce([mockTeam]) // Get team
        .mockResolvedValueOnce([mockTiers[0]]) // Get tiers
        .mockResolvedValueOnce([]) // Delete existing bids
        .mockResolvedValueOnce([]) // Insert bid
        .mockResolvedValueOnce([{ draft_closes_at: null }]); // Get league with no deadline

      const request = createMockRequest({
        team_id: 'team_1',
        league_id: 'league_1',
        bids: [
          { tier_id: 'tier_1', player_id: 'P1', bid_amount: 10 }
        ]
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.deadline).toBeNull();
    });
  });
});
