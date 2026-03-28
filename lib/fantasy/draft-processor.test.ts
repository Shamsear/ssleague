/**
 * Draft Processor Tests
 * 
 * Comprehensive tests for tier-by-tier draft processing
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
  processDraftTiers,
  generateDraftReport,
  type TierBid,
  type TierProcessingResult,
  type DraftProcessingResult
} from './draft-processor';
import { fantasySql } from '@/lib/neon/fantasy-config';

// Mock the database
jest.mock('@/lib/neon/fantasy-config', () => ({
  fantasySql: jest.fn()
}));

const mockFantasySql = fantasySql as jest.MockedFunction<typeof fantasySql>;

describe('Draft Processor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('processDraftTiers', () => {
    test('should process all tiers sequentially', async () => {
      const leagueId = 'league_test_1';

      // Mock tiers
      mockFantasySql.mockResolvedValueOnce([
        { tier_id: 'tier_1', tier_number: 1, tier_name: 'Elite' },
        { tier_id: 'tier_2', tier_number: 2, tier_name: 'Stars' }
      ]);

      // Mock team budgets
      mockFantasySql.mockResolvedValueOnce([
        { team_id: 'team_1', budget_remaining: 100 },
        { team_id: 'team_2', budget_remaining: 100 }
      ]);

      // Mock tier 1 bids
      mockFantasySql.mockResolvedValueOnce([
        {
          bid_id: 'bid_1',
          tier_id: 'tier_1',
          tier_number: 1,
          league_id: leagueId,
          team_id: 'team_1',
          team_name: 'Team 1',
          player_id: 'player_1',
          player_name: 'Player 1',
          bid_amount: 25,
          is_skip: false,
          submitted_at: new Date('2024-01-01T10:00:00Z'),
          current_budget: 100
        },
        {
          bid_id: 'bid_2',
          tier_id: 'tier_1',
          tier_number: 1,
          league_id: leagueId,
          team_id: 'team_2',
          team_name: 'Team 2',
          player_id: 'player_1',
          player_name: 'Player 1',
          bid_amount: 20,
          is_skip: false,
          submitted_at: new Date('2024-01-01T10:01:00Z'),
          current_budget: 100
        }
      ]);

      // Mock player details for tier 1
      mockFantasySql.mockResolvedValueOnce([
        { player_name: 'Player 1', position: 'FW', real_team_name: 'Real Team 1' }
      ]);

      // Mock insert squad
      mockFantasySql.mockResolvedValueOnce([]);
      // Mock update player
      mockFantasySql.mockResolvedValueOnce([]);
      // Mock update bid status (won)
      mockFantasySql.mockResolvedValueOnce([]);
      // Mock update bid status (lost)
      mockFantasySql.mockResolvedValueOnce([]);

      // Mock tier 2 bids
      mockFantasySql.mockResolvedValueOnce([
        {
          bid_id: 'bid_3',
          tier_id: 'tier_2',
          tier_number: 2,
          league_id: leagueId,
          team_id: 'team_2',
          team_name: 'Team 2',
          player_id: 'player_2',
          player_name: 'Player 2',
          bid_amount: 15,
          is_skip: false,
          submitted_at: new Date('2024-01-01T10:00:00Z'),
          current_budget: 100
        }
      ]);

      // Mock player details for tier 2
      mockFantasySql.mockResolvedValueOnce([
        { player_name: 'Player 2', position: 'MF', real_team_name: 'Real Team 2' }
      ]);

      // Mock insert squad
      mockFantasySql.mockResolvedValueOnce([]);
      // Mock update player
      mockFantasySql.mockResolvedValueOnce([]);
      // Mock update bid status (won)
      mockFantasySql.mockResolvedValueOnce([]);

      // Mock save final results (2 teams)
      mockFantasySql.mockResolvedValueOnce([{ initial_budget: 100 }]);
      mockFantasySql.mockResolvedValueOnce([]);
      mockFantasySql.mockResolvedValueOnce([{ initial_budget: 100 }]);
      mockFantasySql.mockResolvedValueOnce([]);

      const result = await processDraftTiers(leagueId);

      expect(result.success).toBe(true);
      expect(result.results_by_tier).toHaveLength(2);
      expect(result.total_players_drafted).toBe(2);
      expect(result.processing_time_ms).toBeGreaterThan(0);
    });

    test('should assign players to highest bidders', async () => {
      const leagueId = 'league_test_2';

      // Mock tiers
      mockFantasySql.mockResolvedValueOnce([
        { tier_id: 'tier_1', tier_number: 1, tier_name: 'Elite' }
      ]);

      // Mock team budgets
      mockFantasySql.mockResolvedValueOnce([
        { team_id: 'team_1', budget_remaining: 100 },
        { team_id: 'team_2', budget_remaining: 100 },
        { team_id: 'team_3', budget_remaining: 100 }
      ]);

      // Mock bids (team_1 has highest bid)
      mockFantasySql.mockResolvedValueOnce([
        {
          bid_id: 'bid_1',
          tier_id: 'tier_1',
          tier_number: 1,
          league_id: leagueId,
          team_id: 'team_1',
          team_name: 'Team 1',
          player_id: 'player_1',
          player_name: 'Player 1',
          bid_amount: 30,
          is_skip: false,
          submitted_at: new Date('2024-01-01T10:00:00Z'),
          current_budget: 100
        },
        {
          bid_id: 'bid_2',
          tier_id: 'tier_1',
          tier_number: 1,
          league_id: leagueId,
          team_id: 'team_2',
          team_name: 'Team 2',
          player_id: 'player_1',
          player_name: 'Player 1',
          bid_amount: 25,
          is_skip: false,
          submitted_at: new Date('2024-01-01T10:01:00Z'),
          current_budget: 100
        },
        {
          bid_id: 'bid_3',
          tier_id: 'tier_1',
          tier_number: 1,
          league_id: leagueId,
          team_id: 'team_3',
          team_name: 'Team 3',
          player_id: 'player_1',
          player_name: 'Player 1',
          bid_amount: 20,
          is_skip: false,
          submitted_at: new Date('2024-01-01T10:02:00Z'),
          current_budget: 100
        }
      ]);

      // Mock player details
      mockFantasySql.mockResolvedValueOnce([
        { player_name: 'Player 1', position: 'FW', real_team_name: 'Real Team 1' }
      ]);

      // Mock insert squad
      mockFantasySql.mockResolvedValueOnce([]);
      // Mock update player
      mockFantasySql.mockResolvedValueOnce([]);
      // Mock update bid status (won for team_1)
      mockFantasySql.mockResolvedValueOnce([]);
      // Mock update bid status (lost for team_2)
      mockFantasySql.mockResolvedValueOnce([]);
      // Mock update bid status (lost for team_3)
      mockFantasySql.mockResolvedValueOnce([]);

      // Mock save final results
      mockFantasySql.mockResolvedValueOnce([{ initial_budget: 100 }]);
      mockFantasySql.mockResolvedValueOnce([]);
      mockFantasySql.mockResolvedValueOnce([{ initial_budget: 100 }]);
      mockFantasySql.mockResolvedValueOnce([]);
      mockFantasySql.mockResolvedValueOnce([{ initial_budget: 100 }]);
      mockFantasySql.mockResolvedValueOnce([]);

      const result = await processDraftTiers(leagueId);

      expect(result.success).toBe(true);
      expect(result.results_by_tier[0].winners).toBe(1);
      expect(result.results_by_tier[0].winning_bids[0].team_id).toBe('team_1');
      expect(result.results_by_tier[0].winning_bids[0].bid_amount).toBe(30);
    });

    test('should handle ties using timestamp tiebreaker', async () => {
      const leagueId = 'league_test_3';

      // Mock tiers
      mockFantasySql.mockResolvedValueOnce([
        { tier_id: 'tier_1', tier_number: 1, tier_name: 'Elite' }
      ]);

      // Mock team budgets
      mockFantasySql.mockResolvedValueOnce([
        { team_id: 'team_1', budget_remaining: 100 },
        { team_id: 'team_2', budget_remaining: 100 }
      ]);

      // Mock bids (same amount, different timestamps)
      mockFantasySql.mockResolvedValueOnce([
        {
          bid_id: 'bid_1',
          tier_id: 'tier_1',
          tier_number: 1,
          league_id: leagueId,
          team_id: 'team_1',
          team_name: 'Team 1',
          player_id: 'player_1',
          player_name: 'Player 1',
          bid_amount: 25,
          is_skip: false,
          submitted_at: new Date('2024-01-01T10:00:00Z'), // Earlier
          current_budget: 100
        },
        {
          bid_id: 'bid_2',
          tier_id: 'tier_1',
          tier_number: 1,
          league_id: leagueId,
          team_id: 'team_2',
          team_name: 'Team 2',
          player_id: 'player_1',
          player_name: 'Player 1',
          bid_amount: 25,
          is_skip: false,
          submitted_at: new Date('2024-01-01T10:01:00Z'), // Later
          current_budget: 100
        }
      ]);

      // Mock player details
      mockFantasySql.mockResolvedValueOnce([
        { player_name: 'Player 1', position: 'FW', real_team_name: 'Real Team 1' }
      ]);

      // Mock insert squad
      mockFantasySql.mockResolvedValueOnce([]);
      // Mock update player
      mockFantasySql.mockResolvedValueOnce([]);
      // Mock update bid status (won for team_1 - earlier timestamp)
      mockFantasySql.mockResolvedValueOnce([]);
      // Mock update bid status (lost for team_2)
      mockFantasySql.mockResolvedValueOnce([]);

      // Mock save final results
      mockFantasySql.mockResolvedValueOnce([{ initial_budget: 100 }]);
      mockFantasySql.mockResolvedValueOnce([]);
      mockFantasySql.mockResolvedValueOnce([{ initial_budget: 100 }]);
      mockFantasySql.mockResolvedValueOnce([]);

      const result = await processDraftTiers(leagueId);

      expect(result.success).toBe(true);
      expect(result.results_by_tier[0].winning_bids[0].team_id).toBe('team_1');
    });

    test('should deduct budget correctly', async () => {
      const leagueId = 'league_test_4';

      // Mock tiers
      mockFantasySql.mockResolvedValueOnce([
        { tier_id: 'tier_1', tier_number: 1, tier_name: 'Elite' }
      ]);

      // Mock team budgets
      mockFantasySql.mockResolvedValueOnce([
        { team_id: 'team_1', budget_remaining: 100 }
      ]);

      // Mock bid
      mockFantasySql.mockResolvedValueOnce([
        {
          bid_id: 'bid_1',
          tier_id: 'tier_1',
          tier_number: 1,
          league_id: leagueId,
          team_id: 'team_1',
          team_name: 'Team 1',
          player_id: 'player_1',
          player_name: 'Player 1',
          bid_amount: 30,
          is_skip: false,
          submitted_at: new Date('2024-01-01T10:00:00Z'),
          current_budget: 100
        }
      ]);

      // Mock player details
      mockFantasySql.mockResolvedValueOnce([
        { player_name: 'Player 1', position: 'FW', real_team_name: 'Real Team 1' }
      ]);

      // Mock insert squad
      mockFantasySql.mockResolvedValueOnce([]);
      // Mock update player
      mockFantasySql.mockResolvedValueOnce([]);
      // Mock update bid status
      mockFantasySql.mockResolvedValueOnce([]);

      // Mock save final results
      mockFantasySql.mockResolvedValueOnce([{ initial_budget: 100 }]);
      
      // Capture the update call
      let capturedBudget = 0;
      mockFantasySql.mockImplementationOnce(async (strings: any, ...values: any[]) => {
        // Extract budget_remaining value
        capturedBudget = values[0];
        return [];
      });

      const result = await processDraftTiers(leagueId);

      expect(result.success).toBe(true);
      expect(capturedBudget).toBe(70); // 100 - 30
      expect(result.total_budget_spent).toBe(30);
    });

    test('should mark players as unavailable', async () => {
      const leagueId = 'league_test_5';

      // Mock tiers
      mockFantasySql.mockResolvedValueOnce([
        { tier_id: 'tier_1', tier_number: 1, tier_name: 'Elite' }
      ]);

      // Mock team budgets
      mockFantasySql.mockResolvedValueOnce([
        { team_id: 'team_1', budget_remaining: 100 }
      ]);

      // Mock bid
      mockFantasySql.mockResolvedValueOnce([
        {
          bid_id: 'bid_1',
          tier_id: 'tier_1',
          tier_number: 1,
          league_id: leagueId,
          team_id: 'team_1',
          team_name: 'Team 1',
          player_id: 'player_1',
          player_name: 'Player 1',
          bid_amount: 25,
          is_skip: false,
          submitted_at: new Date('2024-01-01T10:00:00Z'),
          current_budget: 100
        }
      ]);

      // Mock player details
      mockFantasySql.mockResolvedValueOnce([
        { player_name: 'Player 1', position: 'FW', real_team_name: 'Real Team 1' }
      ]);

      // Mock insert squad
      mockFantasySql.mockResolvedValueOnce([]);
      
      // Capture the update player call
      let capturedIsAvailable: boolean | undefined;
      mockFantasySql.mockImplementationOnce(async (strings: any, ...values: any[]) => {
        // The query updates is_available to FALSE
        capturedIsAvailable = false;
        return [];
      });

      // Mock update bid status
      mockFantasySql.mockResolvedValueOnce([]);

      // Mock save final results
      mockFantasySql.mockResolvedValueOnce([{ initial_budget: 100 }]);
      mockFantasySql.mockResolvedValueOnce([]);

      const result = await processDraftTiers(leagueId);

      expect(result.success).toBe(true);
      expect(capturedIsAvailable).toBe(false);
    });

    test('should handle skipped tiers', async () => {
      const leagueId = 'league_test_6';

      // Mock tiers
      mockFantasySql.mockResolvedValueOnce([
        { tier_id: 'tier_1', tier_number: 1, tier_name: 'Elite' }
      ]);

      // Mock team budgets
      mockFantasySql.mockResolvedValueOnce([
        { team_id: 'team_1', budget_remaining: 100 },
        { team_id: 'team_2', budget_remaining: 100 }
      ]);

      // Mock bids (one skip, one active)
      mockFantasySql.mockResolvedValueOnce([
        {
          bid_id: 'bid_1',
          tier_id: 'tier_1',
          tier_number: 1,
          league_id: leagueId,
          team_id: 'team_1',
          team_name: 'Team 1',
          player_id: 'player_1',
          player_name: 'Player 1',
          bid_amount: 0,
          is_skip: true,
          submitted_at: new Date('2024-01-01T10:00:00Z'),
          current_budget: 100
        },
        {
          bid_id: 'bid_2',
          tier_id: 'tier_1',
          tier_number: 1,
          league_id: leagueId,
          team_id: 'team_2',
          team_name: 'Team 2',
          player_id: 'player_2',
          player_name: 'Player 2',
          bid_amount: 20,
          is_skip: false,
          submitted_at: new Date('2024-01-01T10:01:00Z'),
          current_budget: 100
        }
      ]);

      // Mock update bid status (skipped)
      mockFantasySql.mockResolvedValueOnce([]);

      // Mock player details
      mockFantasySql.mockResolvedValueOnce([
        { player_name: 'Player 2', position: 'MF', real_team_name: 'Real Team 2' }
      ]);

      // Mock insert squad
      mockFantasySql.mockResolvedValueOnce([]);
      // Mock update player
      mockFantasySql.mockResolvedValueOnce([]);
      // Mock update bid status (won)
      mockFantasySql.mockResolvedValueOnce([]);

      // Mock save final results
      mockFantasySql.mockResolvedValueOnce([{ initial_budget: 100 }]);
      mockFantasySql.mockResolvedValueOnce([]);
      mockFantasySql.mockResolvedValueOnce([{ initial_budget: 100 }]);
      mockFantasySql.mockResolvedValueOnce([]);

      const result = await processDraftTiers(leagueId);

      expect(result.success).toBe(true);
      expect(result.results_by_tier[0].skipped).toBe(1);
      expect(result.results_by_tier[0].winners).toBe(1);
    });

    test('should handle edge case: no bids', async () => {
      const leagueId = 'league_test_7';

      // Mock tiers
      mockFantasySql.mockResolvedValueOnce([
        { tier_id: 'tier_1', tier_number: 1, tier_name: 'Elite' }
      ]);

      // Mock team budgets
      mockFantasySql.mockResolvedValueOnce([
        { team_id: 'team_1', budget_remaining: 100 }
      ]);

      // Mock no bids
      mockFantasySql.mockResolvedValueOnce([]);

      // Mock save final results
      mockFantasySql.mockResolvedValueOnce([{ initial_budget: 100 }]);
      mockFantasySql.mockResolvedValueOnce([]);

      const result = await processDraftTiers(leagueId);

      expect(result.success).toBe(true);
      expect(result.results_by_tier[0].total_bids).toBe(0);
      expect(result.results_by_tier[0].winners).toBe(0);
      expect(result.total_players_drafted).toBe(0);
    });

    test('should handle edge case: all skips', async () => {
      const leagueId = 'league_test_8';

      // Mock tiers
      mockFantasySql.mockResolvedValueOnce([
        { tier_id: 'tier_1', tier_number: 1, tier_name: 'Elite' }
      ]);

      // Mock team budgets
      mockFantasySql.mockResolvedValueOnce([
        { team_id: 'team_1', budget_remaining: 100 },
        { team_id: 'team_2', budget_remaining: 100 }
      ]);

      // Mock all skip bids
      mockFantasySql.mockResolvedValueOnce([
        {
          bid_id: 'bid_1',
          tier_id: 'tier_1',
          tier_number: 1,
          league_id: leagueId,
          team_id: 'team_1',
          team_name: 'Team 1',
          player_id: 'player_1',
          player_name: 'Player 1',
          bid_amount: 0,
          is_skip: true,
          submitted_at: new Date('2024-01-01T10:00:00Z'),
          current_budget: 100
        },
        {
          bid_id: 'bid_2',
          tier_id: 'tier_1',
          tier_number: 1,
          league_id: leagueId,
          team_id: 'team_2',
          team_name: 'Team 2',
          player_id: 'player_2',
          player_name: 'Player 2',
          bid_amount: 0,
          is_skip: true,
          submitted_at: new Date('2024-01-01T10:01:00Z'),
          current_budget: 100
        }
      ]);

      // Mock update bid status (skipped) x2
      mockFantasySql.mockResolvedValueOnce([]);
      mockFantasySql.mockResolvedValueOnce([]);

      // Mock save final results
      mockFantasySql.mockResolvedValueOnce([{ initial_budget: 100 }]);
      mockFantasySql.mockResolvedValueOnce([]);
      mockFantasySql.mockResolvedValueOnce([{ initial_budget: 100 }]);
      mockFantasySql.mockResolvedValueOnce([]);

      const result = await processDraftTiers(leagueId);

      expect(result.success).toBe(true);
      expect(result.results_by_tier[0].skipped).toBe(2);
      expect(result.results_by_tier[0].winners).toBe(0);
      expect(result.total_players_drafted).toBe(0);
    });

    test('should complete processing in <10s for 20 teams, 7 tiers', async () => {
      const leagueId = 'league_test_performance';
      const numTeams = 20;
      const numTiers = 7;

      // Mock tiers
      const mockTiers = Array.from({ length: numTiers }, (_, i) => ({
        tier_id: `tier_${i + 1}`,
        tier_number: i + 1,
        tier_name: `Tier ${i + 1}`
      }));
      mockFantasySql.mockResolvedValueOnce(mockTiers);

      // Mock team budgets
      const mockTeams = Array.from({ length: numTeams }, (_, i) => ({
        team_id: `team_${i + 1}`,
        budget_remaining: 100
      }));
      mockFantasySql.mockResolvedValueOnce(mockTeams);

      // Mock bids for each tier (each team bids on a different player)
      for (let tierNum = 0; tierNum < numTiers; tierNum++) {
        const mockBids = Array.from({ length: numTeams }, (_, i) => ({
          bid_id: `bid_${tierNum}_${i}`,
          tier_id: `tier_${tierNum + 1}`,
          tier_number: tierNum + 1,
          league_id: leagueId,
          team_id: `team_${i + 1}`,
          team_name: `Team ${i + 1}`,
          player_id: `player_${tierNum}_${i}`,
          player_name: `Player ${tierNum}_${i}`,
          bid_amount: 10 + i,
          is_skip: false,
          submitted_at: new Date(`2024-01-01T10:${i.toString().padStart(2, '0')}:00Z`),
          current_budget: 100
        }));
        mockFantasySql.mockResolvedValueOnce(mockBids);

        // Mock player details and updates for each bid
        for (let i = 0; i < numTeams; i++) {
          mockFantasySql.mockResolvedValueOnce([
            { player_name: `Player ${tierNum}_${i}`, position: 'FW', real_team_name: 'Team' }
          ]);
          mockFantasySql.mockResolvedValueOnce([]); // insert squad
          mockFantasySql.mockResolvedValueOnce([]); // update player
          mockFantasySql.mockResolvedValueOnce([]); // update bid status
        }
      }

      // Mock save final results for all teams
      for (let i = 0; i < numTeams; i++) {
        mockFantasySql.mockResolvedValueOnce([{ initial_budget: 100 }]);
        mockFantasySql.mockResolvedValueOnce([]);
      }

      const startTime = Date.now();
      const result = await processDraftTiers(leagueId);
      const endTime = Date.now();
      const processingTime = endTime - startTime;

      expect(result.success).toBe(true);
      expect(result.results_by_tier).toHaveLength(numTiers);
      expect(processingTime).toBeLessThan(10000); // Less than 10 seconds
    }, 15000); // Set test timeout to 15s
  });

  describe('generateDraftReport', () => {
    test('should generate comprehensive draft report', async () => {
      const leagueId = 'league_report_1';

      // Mock teams
      mockFantasySql.mockResolvedValueOnce([
        {
          team_id: 'team_1',
          team_name: 'Team 1',
          squad_size: 5,
          budget_spent: 75,
          budget_remaining: 25
        },
        {
          team_id: 'team_2',
          team_name: 'Team 2',
          squad_size: 4,
          budget_spent: 60,
          budget_remaining: 40
        }
      ]);

      // Mock squad for team 1
      mockFantasySql.mockResolvedValueOnce([
        { player_name: 'Player 1', position: 'FW', purchase_price: 25, acquisition_tier: 1 },
        { player_name: 'Player 2', position: 'MF', purchase_price: 20, acquisition_tier: 2 },
        { player_name: 'Player 3', position: 'DF', purchase_price: 15, acquisition_tier: 3 },
        { player_name: 'Player 4', position: 'GK', purchase_price: 10, acquisition_tier: 4 },
        { player_name: 'Player 5', position: 'FW', purchase_price: 5, acquisition_tier: 5 }
      ]);

      // Mock squad for team 2
      mockFantasySql.mockResolvedValueOnce([
        { player_name: 'Player 6', position: 'FW', purchase_price: 20, acquisition_tier: 1 },
        { player_name: 'Player 7', position: 'MF', purchase_price: 18, acquisition_tier: 2 },
        { player_name: 'Player 8', position: 'DF', purchase_price: 12, acquisition_tier: 3 },
        { player_name: 'Player 9', position: 'GK', purchase_price: 10, acquisition_tier: 4 }
      ]);

      const report = await generateDraftReport(leagueId);

      expect(report.league_id).toBe(leagueId);
      expect(report.total_teams).toBe(2);
      expect(report.total_players_drafted).toBe(9);
      expect(report.total_budget_spent).toBe(135);
      expect(report.average_squad_size).toBe(4.5);
      expect(report.average_budget_spent).toBe(67.5);
      expect(report.teams).toHaveLength(2);
      expect(report.teams[0].players).toHaveLength(5);
      expect(report.teams[1].players).toHaveLength(4);
    });
  });
});
