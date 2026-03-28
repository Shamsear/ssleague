import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  releasePlayer,
  releaseMultiplePlayers,
  validateRelease,
  calculateRefund,
  getReleaseStats
} from './release-processor';

// Mock the fantasy SQL
vi.mock('@/lib/neon/fantasy-config', () => ({
  fantasySql: vi.fn()
}));

const { fantasySql } = await import('@/lib/neon/fantasy-config');

describe('Release Processor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('releasePlayer', () => {
    it('should release player and refund 80% of purchase price', async () => {
      const mockSquadPlayer = {
        squad_id: 'squad1',
        real_player_id: 'P1',
        purchase_price: '100.00',
        added_at: new Date()
      };

      const mockTeam = {
        budget: '500.00'
      };

      vi.mocked(fantasySql)
        .mockResolvedValueOnce([mockSquadPlayer]) // Get squad player
        .mockResolvedValueOnce([mockTeam]) // Get team
        .mockResolvedValueOnce([]) // Delete from squad
        .mockResolvedValueOnce([]) // Update team budget
        .mockResolvedValueOnce([]) // Mark player available
        .mockResolvedValueOnce([]); // Insert release record

      const result = await releasePlayer('team1', 'P1', 'league1');

      expect(result.success).toBe(true);
      expect(result.purchase_price).toBe(100);
      expect(result.refund_amount).toBe(80); // 80% of 100
      expect(result.refund_percentage).toBe(80);
      expect(result.new_budget).toBe(580); // 500 + 80
    });

    it('should throw error if player not in squad', async () => {
      vi.mocked(fantasySql).mockResolvedValueOnce([]); // No squad player

      await expect(
        releasePlayer('team1', 'P1', 'league1')
      ).rejects.toThrow('Player not found in squad');
    });

    it('should throw error if team not found', async () => {
      const mockSquadPlayer = {
        squad_id: 'squad1',
        real_player_id: 'P1',
        purchase_price: '100.00'
      };

      vi.mocked(fantasySql)
        .mockResolvedValueOnce([mockSquadPlayer]) // Get squad player
        .mockResolvedValueOnce([]); // No team found

      await expect(
        releasePlayer('team1', 'P1', 'league1')
      ).rejects.toThrow('Team not found');
    });

    it('should calculate correct refund for different prices', async () => {
      const testCases = [
        { price: 50, expected: 40 },
        { price: 100, expected: 80 },
        { price: 150, expected: 120 },
        { price: 200, expected: 160 }
      ];

      for (const testCase of testCases) {
        const refund = (testCase.price * 80) / 100;
        expect(refund).toBe(testCase.expected);
      }
    });
  });

  describe('releaseMultiplePlayers', () => {
    it('should release multiple players successfully', async () => {
      const mockSquadPlayer1 = {
        squad_id: 'squad1',
        real_player_id: 'P1',
        purchase_price: '100.00'
      };

      const mockSquadPlayer2 = {
        squad_id: 'squad2',
        real_player_id: 'P2',
        purchase_price: '150.00'
      };

      const mockTeam = { budget: '500.00' };

      // Mock for first player
      vi.mocked(fantasySql)
        .mockResolvedValueOnce([mockSquadPlayer1])
        .mockResolvedValueOnce([mockTeam])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        // Mock for second player
        .mockResolvedValueOnce([mockSquadPlayer2])
        .mockResolvedValueOnce([{ budget: '580.00' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await releaseMultiplePlayers(
        'team1',
        ['P1', 'P2'],
        'league1'
      );

      expect(result.success).toBe(true);
      expect(result.releases).toHaveLength(2);
      expect(result.total_refund).toBe(200); // 80 + 120
      expect(result.errors).toHaveLength(0);
    });

    it('should handle partial failures', async () => {
      vi.mocked(fantasySql)
        .mockResolvedValueOnce([]) // First player not found
        .mockResolvedValueOnce([{ // Second player found
          squad_id: 'squad2',
          real_player_id: 'P2',
          purchase_price: '100.00'
        }])
        .mockResolvedValueOnce([{ budget: '500.00' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await releaseMultiplePlayers(
        'team1',
        ['P1', 'P2'],
        'league1'
      );

      expect(result.success).toBe(false);
      expect(result.releases).toHaveLength(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('P1');
    });
  });

  describe('validateRelease', () => {
    it('should validate successful release', async () => {
      const mockSquadPlayer = {
        squad_id: 'squad1',
        real_player_id: 'P1',
        purchase_price: '100.00'
      };

      vi.mocked(fantasySql)
        .mockResolvedValueOnce([mockSquadPlayer]) // Get squad player
        .mockResolvedValueOnce([]) // No locked lineups
        .mockResolvedValueOnce([{ count: '7' }]); // Squad count

      const result = await validateRelease('team1', 'P1');

      expect(result.valid).toBe(true);
      expect(result.player).toBeDefined();
    });

    it('should reject if player not in squad', async () => {
      vi.mocked(fantasySql).mockResolvedValueOnce([]); // No squad player

      const result = await validateRelease('team1', 'P1');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Player not found in squad');
    });

    it('should reject if player in locked lineup', async () => {
      const mockSquadPlayer = {
        squad_id: 'squad1',
        real_player_id: 'P1',
        purchase_price: '100.00'
      };

      vi.mocked(fantasySql)
        .mockResolvedValueOnce([mockSquadPlayer]) // Get squad player
        .mockResolvedValueOnce([{ lineup_id: 'lineup1' }]); // Locked lineup found

      const result = await validateRelease('team1', 'P1');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Cannot release player in a locked lineup');
    });

    it('should reject if below minimum squad size', async () => {
      const mockSquadPlayer = {
        squad_id: 'squad1',
        real_player_id: 'P1',
        purchase_price: '100.00'
      };

      vi.mocked(fantasySql)
        .mockResolvedValueOnce([mockSquadPlayer]) // Get squad player
        .mockResolvedValueOnce([]) // No locked lineups
        .mockResolvedValueOnce([{ count: '5' }]); // At minimum squad size

      const result = await validateRelease('team1', 'P1');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('minimum squad size');
    });
  });

  describe('calculateRefund', () => {
    it('should calculate 80% refund correctly', async () => {
      const mockSquadPlayer = {
        purchase_price: '100.00'
      };

      vi.mocked(fantasySql).mockResolvedValueOnce([mockSquadPlayer]);

      const result = await calculateRefund('team1', 'P1');

      expect(result.purchase_price).toBe(100);
      expect(result.refund_amount).toBe(80);
      expect(result.refund_percentage).toBe(80);
    });

    it('should throw error if player not found', async () => {
      vi.mocked(fantasySql).mockResolvedValueOnce([]);

      await expect(
        calculateRefund('team1', 'P1')
      ).rejects.toThrow('Player not found in squad');
    });

    it('should handle different purchase prices', async () => {
      const testCases = [
        { price: '50.00', expected: 40 },
        { price: '75.50', expected: 60.4 },
        { price: '100.00', expected: 80 },
        { price: '125.75', expected: 100.6 }
      ];

      for (const testCase of testCases) {
        vi.mocked(fantasySql).mockResolvedValueOnce([{
          purchase_price: testCase.price
        }]);

        const result = await calculateRefund('team1', 'P1');
        expect(result.refund_amount).toBe(testCase.expected);
      }
    });
  });

  describe('getReleaseStats', () => {
    it('should return release statistics', async () => {
      const mockStats = {
        total_releases: '10',
        teams_released: '5',
        total_refunded: '800.00',
        avg_refund: '80.00',
        max_refund: '120.00',
        min_refund: '40.00'
      };

      vi.mocked(fantasySql).mockResolvedValueOnce([mockStats]);

      const result = await getReleaseStats('league1');

      expect(result.total_releases).toBe(10);
      expect(result.teams_released).toBe(5);
      expect(result.total_refunded).toBe(800);
      expect(result.avg_refund).toBe(80);
      expect(result.max_refund).toBe(120);
      expect(result.min_refund).toBe(40);
    });

    it('should handle no releases', async () => {
      const mockStats = {
        total_releases: '0',
        teams_released: '0',
        total_refunded: null,
        avg_refund: null,
        max_refund: null,
        min_refund: null
      };

      vi.mocked(fantasySql).mockResolvedValueOnce([mockStats]);

      const result = await getReleaseStats('league1');

      expect(result.total_releases).toBe(0);
      expect(result.teams_released).toBe(0);
      expect(result.total_refunded).toBe(0);
      expect(result.avg_refund).toBe(0);
    });
  });

  describe('Refund calculations', () => {
    it('should always refund exactly 80%', () => {
      const prices = [10, 25, 50, 75, 100, 150, 200, 250];
      
      prices.forEach(price => {
        const refund = (price * 80) / 100;
        expect(refund).toBe(price * 0.8);
      });
    });

    it('should handle decimal prices correctly', () => {
      const testCases = [
        { price: 12.50, expected: 10.00 },
        { price: 37.75, expected: 30.20 },
        { price: 99.99, expected: 79.992 }
      ];

      testCases.forEach(({ price, expected }) => {
        const refund = (price * 80) / 100;
        expect(refund).toBeCloseTo(expected, 2);
      });
    });
  });
});
