import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  proposeTrade, 
  validateTradeProposal, 
  calculateTradeValue,
  getIncomingTrades,
  getOutgoingTrades,
  cancelTrade,
  expireOldTrades
} from './trade-processor';

// Mock the fantasy SQL
vi.mock('@/lib/neon/fantasy-config', () => ({
  fantasySql: vi.fn()
}));

const { fantasySql } = await import('@/lib/neon/fantasy-config');

describe('Trade Processor', () => {
  const testLeagueId = 'test_league_trade';
  const testTeamA = 'test_team_a_trade';
  const testTeamB = 'test_team_b_trade';
  const testPlayerA1 = 'player_a1';
  const testPlayerA2 = 'player_a2';
  const testPlayerB1 = 'player_b1';
  const testPlayerB2 = 'player_b2';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateTradeProposal', () => {
    it('should validate a valid swap trade', async () => {
      const proposal = {
        league_id: testLeagueId,
        team_a_id: testTeamA,
        team_b_id: testTeamB,
        trade_type: 'swap' as const,
        team_a_players: [testPlayerA1],
        team_b_players: [testPlayerB1],
        team_a_cash: 0,
        team_b_cash: 0,
        expires_in_hours: 48
      };

      vi.mocked(fantasySql)
        .mockResolvedValueOnce([
          { team_id: testTeamA, league_id: testLeagueId, budget: '100' },
          { team_id: testTeamB, league_id: testLeagueId, budget: '100' }
        ])
        .mockResolvedValueOnce([{ real_player_id: testPlayerA1 }])
        .mockResolvedValueOnce([{ real_player_id: testPlayerB1 }])
        .mockResolvedValueOnce([{ count: '5' }])
        .mockResolvedValueOnce([{ count: '5' }]);

      const result = await validateTradeProposal(proposal);
      expect(result.valid).toBe(true);
    });

    it('should reject trade with same team', async () => {
      const proposal = {
        league_id: testLeagueId,
        team_a_id: testTeamA,
        team_b_id: testTeamA,
        trade_type: 'swap' as const,
        team_a_players: [testPlayerA1],
        team_b_players: [testPlayerA2],
        team_a_cash: 0,
        team_b_cash: 0,
        expires_in_hours: 48
      };

      const result = await validateTradeProposal(proposal);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Cannot trade with yourself');
    });

    it('should reject swap without players from both teams', async () => {
      const proposal = {
        league_id: testLeagueId,
        team_a_id: testTeamA,
        team_b_id: testTeamB,
        trade_type: 'swap' as const,
        team_a_players: [testPlayerA1],
        team_b_players: [],
        team_a_cash: 0,
        team_b_cash: 0,
        expires_in_hours: 48
      };

      vi.mocked(fantasySql).mockResolvedValueOnce([
        { team_id: testTeamA, league_id: testLeagueId, budget: '100' },
        { team_id: testTeamB, league_id: testLeagueId, budget: '100' }
      ]);

      const result = await validateTradeProposal(proposal);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Swap must include players from both teams');
    });

    it('should reject trade with insufficient budget', async () => {
      const proposal = {
        league_id: testLeagueId,
        team_a_id: testTeamA,
        team_b_id: testTeamB,
        trade_type: 'sale' as const,
        team_a_players: [],
        team_b_players: [testPlayerB1],
        team_a_cash: 200,
        team_b_cash: 0,
        expires_in_hours: 48
      };

      vi.mocked(fantasySql)
        .mockResolvedValueOnce([
          { team_id: testTeamA, league_id: testLeagueId, budget: '100' },
          { team_id: testTeamB, league_id: testLeagueId, budget: '100' }
        ])
        .mockResolvedValueOnce([{ real_player_id: testPlayerB1 }]); // Team B players

      const result = await validateTradeProposal(proposal);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('insufficient budget');
    });
  });

  describe('calculateTradeValue', () => {
    it('should calculate value for player swap', async () => {
      const proposal = {
        league_id: testLeagueId,
        team_a_id: testTeamA,
        team_b_id: testTeamB,
        trade_type: 'swap' as const,
        team_a_players: [testPlayerA1],
        team_b_players: [testPlayerB1],
        team_a_cash: 0,
        team_b_cash: 0,
        expires_in_hours: 48
      };

      vi.mocked(fantasySql)
        .mockResolvedValueOnce([{ total: '20' }])
        .mockResolvedValueOnce([{ total: '25' }]);

      const value = await calculateTradeValue(proposal);
      
      expect(value.team_a_value).toBe(20);
      expect(value.team_b_value).toBe(25);
      expect(value.difference).toBe(5);
      expect(value.fairness_percentage).toBeGreaterThan(70);
    });

    it('should calculate value for sale with cash', async () => {
      const proposal = {
        league_id: testLeagueId,
        team_a_id: testTeamA,
        team_b_id: testTeamB,
        trade_type: 'sale' as const,
        team_a_players: [testPlayerA1],
        team_b_players: [],
        team_a_cash: 0,
        team_b_cash: 20,
        expires_in_hours: 48
      };

      vi.mocked(fantasySql).mockResolvedValueOnce([{ total: '20' }]);

      const value = await calculateTradeValue(proposal);
      
      expect(value.team_a_value).toBe(20);
      expect(value.team_b_value).toBe(20);
      expect(value.difference).toBe(0);
      expect(value.fairness_percentage).toBe(100);
    });
  });

  describe('proposeTrade', () => {
    it('should create a valid trade proposal', async () => {
      const proposal = {
        league_id: testLeagueId,
        team_a_id: testTeamA,
        team_b_id: testTeamB,
        trade_type: 'swap' as const,
        team_a_players: [testPlayerA1],
        team_b_players: [testPlayerB1],
        team_a_cash: 0,
        team_b_cash: 0,
        expires_in_hours: 48
      };

      vi.mocked(fantasySql)
        .mockResolvedValueOnce([
          { team_id: testTeamA, league_id: testLeagueId, budget: '100' },
          { team_id: testTeamB, league_id: testLeagueId, budget: '100' }
        ])
        .mockResolvedValueOnce([{ real_player_id: testPlayerA1 }])
        .mockResolvedValueOnce([{ real_player_id: testPlayerB1 }])
        .mockResolvedValueOnce([{ count: '5' }])
        .mockResolvedValueOnce([{ count: '5' }])
        .mockResolvedValueOnce([{ total: '20' }])
        .mockResolvedValueOnce([{ total: '25' }])
        .mockResolvedValueOnce([]); // Insert trade

      const result = await proposeTrade(proposal);
      
      expect(result.success).toBe(true);
      expect(result.trade_id).toBeDefined();
      expect(result.expires_at).toBeDefined();
      expect(result.trade_value).toBeDefined();
    });

    it('should reject invalid trade proposal', async () => {
      const proposal = {
        league_id: testLeagueId,
        team_a_id: testTeamA,
        team_b_id: testTeamA,
        trade_type: 'swap' as const,
        team_a_players: [testPlayerA1],
        team_b_players: [testPlayerA2],
        team_a_cash: 0,
        team_b_cash: 0,
        expires_in_hours: 48
      };

      await expect(proposeTrade(proposal)).rejects.toThrow();
    });
  });

  describe('getIncomingTrades', () => {
    it('should get incoming trades for a team', async () => {
      const mockTrades = [
        {
          trade_id: 'trade_1',
          team_a_id: testTeamA,
          team_b_id: testTeamB,
          status: 'pending'
        }
      ];

      vi.mocked(fantasySql).mockResolvedValueOnce(mockTrades);

      const trades = await getIncomingTrades(testTeamB);
      
      expect(trades.length).toBeGreaterThan(0);
      expect(trades[0].team_b_id).toBe(testTeamB);
    });
  });

  describe('cancelTrade', () => {
    it('should allow proposer to cancel pending trade', async () => {
      const tradeId = 'trade_123';

      vi.mocked(fantasySql)
        .mockResolvedValueOnce([{
          trade_id: tradeId,
          team_a_id: testTeamA,
          status: 'pending'
        }])
        .mockResolvedValueOnce([]);

      const result = await cancelTrade(tradeId, testTeamA);
      
      expect(result.success).toBe(true);
    });

    it('should not allow non-proposer to cancel trade', async () => {
      const tradeId = 'trade_123';

      vi.mocked(fantasySql).mockResolvedValueOnce([{
        trade_id: tradeId,
        team_a_id: testTeamA,
        status: 'pending'
      }]);

      await expect(cancelTrade(tradeId, testTeamB)).rejects.toThrow('Only the proposer can cancel');
    });
  });

  describe('expireOldTrades', () => {
    it('should expire trades past their expiry time', async () => {
      vi.mocked(fantasySql).mockResolvedValueOnce([
        { trade_id: 'trade_1' },
        { trade_id: 'trade_2' }
      ]);

      const result = await expireOldTrades(testLeagueId);
      
      expect(result.success).toBe(true);
      expect(result.expired_count).toBe(2);
    });
  });
});
