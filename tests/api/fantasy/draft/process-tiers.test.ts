/**
 * Tests for POST /api/fantasy/draft/process-tiers
 * Committee-only endpoint to process draft tier bids
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { POST } from '@/app/api/fantasy/draft/process-tiers/route';
import { NextRequest } from 'next/server';
import * as authHelper from '@/lib/auth-helper';
import * as draftProcessor from '@/lib/fantasy/draft-processor';
import * as notifications from '@/lib/notifications/send-notification';
import { fantasySql } from '@/lib/neon/fantasy-config';

// Mock dependencies
vi.mock('@/lib/auth-helper');
vi.mock('@/lib/fantasy/draft-processor');
vi.mock('@/lib/notifications/send-notification');
vi.mock('@/lib/neon/fantasy-config', () => ({
  fantasySql: vi.fn()
}));

describe('POST /api/fantasy/draft/process-tiers', () => {
  const mockLeagueId = 'league_test_123';
  const mockUserId = 'user_committee_123';

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock successful committee authentication by default
    vi.mocked(authHelper.verifyAuth).mockResolvedValue({
      authenticated: true,
      userId: mockUserId,
      role: 'committee_admin'
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Authentication & Authorization', () => {
    it('should reject unauthenticated requests', async () => {
      vi.mocked(authHelper.verifyAuth).mockResolvedValue({
        authenticated: false,
        error: 'Not authenticated'
      });

      const request = new NextRequest('http://localhost:3000/api/fantasy/draft/process-tiers', {
        method: 'POST',
        body: JSON.stringify({ league_id: mockLeagueId })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBeTruthy();
    });

    it('should reject non-committee users', async () => {
      vi.mocked(authHelper.verifyAuth).mockResolvedValue({
        authenticated: false,
        error: 'Insufficient permissions'
      });

      const request = new NextRequest('http://localhost:3000/api/fantasy/draft/process-tiers', {
        method: 'POST',
        body: JSON.stringify({ league_id: mockLeagueId })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
    });

    it('should allow committee admin access', async () => {
      vi.mocked(authHelper.verifyAuth).mockResolvedValue({
        authenticated: true,
        userId: mockUserId,
        role: 'committee_admin'
      });

      vi.mocked(draftProcessor.processDraftTiers).mockResolvedValue({
        success: true,
        league_id: mockLeagueId,
        results_by_tier: [],
        total_players_drafted: 0,
        total_budget_spent: 0,
        average_squad_size: 0,
        processing_time_ms: 100
      });

      vi.mocked(fantasySql).mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/fantasy/draft/process-tiers', {
        method: 'POST',
        body: JSON.stringify({ league_id: mockLeagueId })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('Request Validation', () => {
    it('should require league_id parameter', async () => {
      const request = new NextRequest('http://localhost:3000/api/fantasy/draft/process-tiers', {
        method: 'POST',
        body: JSON.stringify({})
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('league_id is required');
    });

    it('should accept valid league_id', async () => {
      vi.mocked(draftProcessor.processDraftTiers).mockResolvedValue({
        success: true,
        league_id: mockLeagueId,
        results_by_tier: [],
        total_players_drafted: 0,
        total_budget_spent: 0,
        average_squad_size: 0,
        processing_time_ms: 100
      });

      vi.mocked(fantasySql).mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/fantasy/draft/process-tiers', {
        method: 'POST',
        body: JSON.stringify({ league_id: mockLeagueId })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.league_id).toBe(mockLeagueId);
    });
  });

  describe('Draft Processing', () => {
    it('should successfully process draft tiers', async () => {
      const mockResult = {
        success: true,
        league_id: mockLeagueId,
        results_by_tier: [
          {
            tier_number: 1,
            tier_name: 'Elite',
            total_bids: 20,
            valid_bids: 20,
            winners: 20,
            skipped: 0,
            failed: 0,
            winning_bids: [
              {
                team_id: 'team_1',
                team_name: 'Team One',
                player_id: 'player_1',
                player_name: 'Messi',
                bid_amount: 25
              }
            ]
          }
        ],
        total_players_drafted: 20,
        total_budget_spent: 500,
        average_squad_size: 1.0,
        processing_time_ms: 250
      };

      vi.mocked(draftProcessor.processDraftTiers).mockResolvedValue(mockResult);
      vi.mocked(fantasySql).mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/fantasy/draft/process-tiers', {
        method: 'POST',
        body: JSON.stringify({ league_id: mockLeagueId })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.total_players_drafted).toBe(20);
      expect(data.total_budget_spent).toBe(500);
      expect(data.average_squad_size).toBe(1.0);
      expect(data.results_by_tier).toHaveLength(1);
      expect(data.processing_time_ms).toBe(250);
    });

    it('should handle draft processing failure', async () => {
      const mockResult = {
        success: false,
        league_id: mockLeagueId,
        results_by_tier: [],
        total_players_drafted: 0,
        total_budget_spent: 0,
        average_squad_size: 0,
        processing_time_ms: 100,
        errors: ['No tiers found for this league']
      };

      vi.mocked(draftProcessor.processDraftTiers).mockResolvedValue(mockResult);

      const request = new NextRequest('http://localhost:3000/api/fantasy/draft/process-tiers', {
        method: 'POST',
        body: JSON.stringify({ league_id: mockLeagueId })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Draft processing failed');
      expect(data.details).toContain('No tiers found');
    });

    it('should call processDraftTiers with correct league_id', async () => {
      vi.mocked(draftProcessor.processDraftTiers).mockResolvedValue({
        success: true,
        league_id: mockLeagueId,
        results_by_tier: [],
        total_players_drafted: 0,
        total_budget_spent: 0,
        average_squad_size: 0,
        processing_time_ms: 100
      });

      vi.mocked(fantasySql).mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/fantasy/draft/process-tiers', {
        method: 'POST',
        body: JSON.stringify({ league_id: mockLeagueId })
      });

      await POST(request);

      expect(draftProcessor.processDraftTiers).toHaveBeenCalledWith(mockLeagueId);
      expect(draftProcessor.processDraftTiers).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple tiers correctly', async () => {
      const mockResult = {
        success: true,
        league_id: mockLeagueId,
        results_by_tier: [
          {
            tier_number: 1,
            tier_name: 'Elite',
            total_bids: 20,
            valid_bids: 20,
            winners: 20,
            skipped: 0,
            failed: 0,
            winning_bids: []
          },
          {
            tier_number: 2,
            tier_name: 'Stars',
            total_bids: 20,
            valid_bids: 18,
            winners: 18,
            skipped: 2,
            failed: 0,
            winning_bids: []
          },
          {
            tier_number: 3,
            tier_name: 'Quality',
            total_bids: 20,
            valid_bids: 15,
            winners: 15,
            skipped: 3,
            failed: 2,
            winning_bids: []
          }
        ],
        total_players_drafted: 53,
        total_budget_spent: 1325,
        average_squad_size: 2.65,
        processing_time_ms: 450
      };

      vi.mocked(draftProcessor.processDraftTiers).mockResolvedValue(mockResult);
      vi.mocked(fantasySql).mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/fantasy/draft/process-tiers', {
        method: 'POST',
        body: JSON.stringify({ league_id: mockLeagueId })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.results_by_tier).toHaveLength(3);
      expect(data.total_players_drafted).toBe(53);
    });
  });

  describe('Notifications', () => {
    beforeEach(() => {
      vi.mocked(draftProcessor.processDraftTiers).mockResolvedValue({
        success: true,
        league_id: mockLeagueId,
        results_by_tier: [
          {
            tier_number: 1,
            tier_name: 'Elite',
            total_bids: 2,
            valid_bids: 2,
            winners: 2,
            skipped: 0,
            failed: 0,
            winning_bids: [
              {
                team_id: 'team_1',
                team_name: 'Team One',
                player_id: 'player_1',
                player_name: 'Messi',
                bid_amount: 25
              },
              {
                team_id: 'team_2',
                team_name: 'Team Two',
                player_id: 'player_2',
                player_name: 'Ronaldo',
                bid_amount: 24
              }
            ]
          }
        ],
        total_players_drafted: 2,
        total_budget_spent: 49,
        average_squad_size: 1.0,
        processing_time_ms: 100
      });
    });

    it('should send notifications by default', async () => {
      vi.mocked(fantasySql).mockResolvedValue([
        {
          team_id: 'team_1',
          team_name: 'Team One',
          owner_uid: 'user_1',
          squad_size: 1,
          budget_remaining: 75
        },
        {
          team_id: 'team_2',
          team_name: 'Team Two',
          owner_uid: 'user_2',
          squad_size: 1,
          budget_remaining: 76
        }
      ]);

      vi.mocked(notifications.sendNotification).mockResolvedValue({
        success: true,
        sentCount: 1,
        failedCount: 0
      });

      const request = new NextRequest('http://localhost:3000/api/fantasy/draft/process-tiers', {
        method: 'POST',
        body: JSON.stringify({ league_id: mockLeagueId })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.notifications_sent).toBe(2);
      expect(notifications.sendNotification).toHaveBeenCalledTimes(2);
    });

    it('should skip notifications when send_notifications is false', async () => {
      const request = new NextRequest('http://localhost:3000/api/fantasy/draft/process-tiers', {
        method: 'POST',
        body: JSON.stringify({ 
          league_id: mockLeagueId,
          send_notifications: false 
        })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.notifications_sent).toBe(0);
      expect(notifications.sendNotification).not.toHaveBeenCalled();
    });

    it('should send customized notification for teams with no wins', async () => {
      vi.mocked(fantasySql).mockResolvedValue([
        {
          team_id: 'team_3',
          team_name: 'Team Three',
          owner_uid: 'user_3',
          squad_size: 0,
          budget_remaining: 100
        }
      ]);

      vi.mocked(notifications.sendNotification).mockResolvedValue({
        success: true,
        sentCount: 1,
        failedCount: 0
      });

      const request = new NextRequest('http://localhost:3000/api/fantasy/draft/process-tiers', {
        method: 'POST',
        body: JSON.stringify({ league_id: mockLeagueId })
      });

      await POST(request);

      expect(notifications.sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '🎉 Draft Complete!',
          body: expect.stringContaining("didn't win any players")
        }),
        expect.objectContaining({
          userId: 'user_3'
        })
      );
    });

    it('should send customized notification for teams with one win', async () => {
      vi.mocked(fantasySql).mockResolvedValue([
        {
          team_id: 'team_1',
          team_name: 'Team One',
          owner_uid: 'user_1',
          squad_size: 1,
          budget_remaining: 75
        }
      ]);

      vi.mocked(notifications.sendNotification).mockResolvedValue({
        success: true,
        sentCount: 1,
        failedCount: 0
      });

      const request = new NextRequest('http://localhost:3000/api/fantasy/draft/process-tiers', {
        method: 'POST',
        body: JSON.stringify({ league_id: mockLeagueId })
      });

      await POST(request);

      expect(notifications.sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '🎉 Draft Complete!',
          body: expect.stringContaining('You won Messi for €25M')
        }),
        expect.objectContaining({
          userId: 'user_1'
        })
      );
    });

    it('should send customized notification for teams with multiple wins', async () => {
      // Mock result with team winning 2 players
      vi.mocked(draftProcessor.processDraftTiers).mockResolvedValue({
        success: true,
        league_id: mockLeagueId,
        results_by_tier: [
          {
            tier_number: 1,
            tier_name: 'Elite',
            total_bids: 1,
            valid_bids: 1,
            winners: 1,
            skipped: 0,
            failed: 0,
            winning_bids: [
              {
                team_id: 'team_1',
                team_name: 'Team One',
                player_id: 'player_1',
                player_name: 'Messi',
                bid_amount: 25
              }
            ]
          },
          {
            tier_number: 2,
            tier_name: 'Stars',
            total_bids: 1,
            valid_bids: 1,
            winners: 1,
            skipped: 0,
            failed: 0,
            winning_bids: [
              {
                team_id: 'team_1',
                team_name: 'Team One',
                player_id: 'player_2',
                player_name: 'Ronaldo',
                bid_amount: 24
              }
            ]
          }
        ],
        total_players_drafted: 2,
        total_budget_spent: 49,
        average_squad_size: 2.0,
        processing_time_ms: 100
      });

      vi.mocked(fantasySql).mockResolvedValue([
        {
          team_id: 'team_1',
          team_name: 'Team One',
          owner_uid: 'user_1',
          squad_size: 2,
          budget_remaining: 51
        }
      ]);

      vi.mocked(notifications.sendNotification).mockResolvedValue({
        success: true,
        sentCount: 1,
        failedCount: 0
      });

      const request = new NextRequest('http://localhost:3000/api/fantasy/draft/process-tiers', {
        method: 'POST',
        body: JSON.stringify({ league_id: mockLeagueId })
      });

      await POST(request);

      expect(notifications.sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '🎉 Draft Complete!',
          body: expect.stringContaining('You won 2 players for €49M')
        }),
        expect.objectContaining({
          userId: 'user_1'
        })
      );
    });

    it('should not fail request if notifications fail', async () => {
      vi.mocked(fantasySql).mockResolvedValue([
        {
          team_id: 'team_1',
          team_name: 'Team One',
          owner_uid: 'user_1',
          squad_size: 1,
          budget_remaining: 75
        }
      ]);

      vi.mocked(notifications.sendNotification).mockRejectedValue(
        new Error('Notification service unavailable')
      );

      const request = new NextRequest('http://localhost:3000/api/fantasy/draft/process-tiers', {
        method: 'POST',
        body: JSON.stringify({ league_id: mockLeagueId })
      });

      const response = await POST(request);
      const data = await response.json();

      // Request should still succeed even if notifications fail
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.notifications_sent).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle processor exceptions', async () => {
      vi.mocked(draftProcessor.processDraftTiers).mockRejectedValue(
        new Error('Database connection failed')
      );

      const request = new NextRequest('http://localhost:3000/api/fantasy/draft/process-tiers', {
        method: 'POST',
        body: JSON.stringify({ league_id: mockLeagueId })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Failed to process draft');
      expect(data.details).toContain('Database connection failed');
    });

    it('should handle malformed JSON', async () => {
      const request = new NextRequest('http://localhost:3000/api/fantasy/draft/process-tiers', {
        method: 'POST',
        body: 'invalid json'
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });
  });

  describe('Response Format', () => {
    it('should return all required fields', async () => {
      vi.mocked(draftProcessor.processDraftTiers).mockResolvedValue({
        success: true,
        league_id: mockLeagueId,
        results_by_tier: [],
        total_players_drafted: 0,
        total_budget_spent: 0,
        average_squad_size: 0,
        processing_time_ms: 100
      });

      vi.mocked(fantasySql).mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/fantasy/draft/process-tiers', {
        method: 'POST',
        body: JSON.stringify({ league_id: mockLeagueId })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('message');
      expect(data).toHaveProperty('league_id');
      expect(data).toHaveProperty('results_by_tier');
      expect(data).toHaveProperty('total_players_drafted');
      expect(data).toHaveProperty('total_budget_spent');
      expect(data).toHaveProperty('average_squad_size');
      expect(data).toHaveProperty('processing_time_ms');
      expect(data).toHaveProperty('notifications_sent');
    });
  });
});
