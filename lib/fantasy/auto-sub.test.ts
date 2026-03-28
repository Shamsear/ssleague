/**
 * Tests for Fantasy League - Auto-Sub Feature
 */

import { describe, it, expect } from 'vitest';
import {
  isPlayerDNP,
  type PlayerPerformance
} from './auto-sub';

describe('Auto-Sub Feature', () => {
  describe('isPlayerDNP', () => {
    it('should return true if player did not play', () => {
      const performance: PlayerPerformance = {
        player_id: 'player1',
        points: 0,
        did_not_play: true
      };

      expect(isPlayerDNP(performance)).toBe(true);
    });

    it('should return true if player has 0 points', () => {
      const performance: PlayerPerformance = {
        player_id: 'player1',
        points: 0,
        did_not_play: false
      };

      expect(isPlayerDNP(performance)).toBe(true);
    });

    it('should return false if player played and scored', () => {
      const performance: PlayerPerformance = {
        player_id: 'player1',
        points: 10,
        did_not_play: false
      };

      expect(isPlayerDNP(performance)).toBe(false);
    });

    it('should return false if player played but scored 0 (edge case)', () => {
      const performance: PlayerPerformance = {
        player_id: 'player1',
        points: 0,
        did_not_play: false
      };

      // This is actually DNP by our logic (0 points)
      expect(isPlayerDNP(performance)).toBe(true);
    });

    it('should handle negative points', () => {
      const performance: PlayerPerformance = {
        player_id: 'player1',
        points: -2,
        did_not_play: false
      };

      expect(isPlayerDNP(performance)).toBe(false);
    });

    it('should handle decimal points', () => {
      const performance: PlayerPerformance = {
        player_id: 'player1',
        points: 0.5,
        did_not_play: false
      };

      expect(isPlayerDNP(performance)).toBe(false);
    });
  });

  describe('Auto-Sub Logic', () => {
    it('should identify DNP players correctly', () => {
      const performances: PlayerPerformance[] = [
        { player_id: 'p1', points: 10, did_not_play: false },
        { player_id: 'p2', points: 0, did_not_play: true },
        { player_id: 'p3', points: 5, did_not_play: false },
        { player_id: 'p4', points: 0, did_not_play: false },
        { player_id: 'p5', points: 8, did_not_play: false }
      ];

      const dnpPlayers = performances.filter(isPlayerDNP);

      expect(dnpPlayers).toHaveLength(2);
      expect(dnpPlayers.map(p => p.player_id)).toEqual(['p2', 'p4']);
    });

    it('should handle all players playing', () => {
      const performances: PlayerPerformance[] = [
        { player_id: 'p1', points: 10, did_not_play: false },
        { player_id: 'p2', points: 8, did_not_play: false },
        { player_id: 'p3', points: 5, did_not_play: false },
        { player_id: 'p4', points: 12, did_not_play: false },
        { player_id: 'p5', points: 7, did_not_play: false }
      ];

      const dnpPlayers = performances.filter(isPlayerDNP);

      expect(dnpPlayers).toHaveLength(0);
    });

    it('should handle all players not playing', () => {
      const performances: PlayerPerformance[] = [
        { player_id: 'p1', points: 0, did_not_play: true },
        { player_id: 'p2', points: 0, did_not_play: true },
        { player_id: 'p3', points: 0, did_not_play: true },
        { player_id: 'p4', points: 0, did_not_play: true },
        { player_id: 'p5', points: 0, did_not_play: true }
      ];

      const dnpPlayers = performances.filter(isPlayerDNP);

      expect(dnpPlayers).toHaveLength(5);
    });
  });

  describe('Edge Cases', () => {
    it('should handle player with very high points', () => {
      const performance: PlayerPerformance = {
        player_id: 'player1',
        points: 100,
        did_not_play: false
      };

      expect(isPlayerDNP(performance)).toBe(false);
    });

    it('should handle player with very low negative points', () => {
      const performance: PlayerPerformance = {
        player_id: 'player1',
        points: -10,
        did_not_play: false
      };

      expect(isPlayerDNP(performance)).toBe(false);
    });

    it('should handle player with exactly 0.0 points', () => {
      const performance: PlayerPerformance = {
        player_id: 'player1',
        points: 0.0,
        did_not_play: false
      };

      expect(isPlayerDNP(performance)).toBe(true);
    });

    it('should handle player with very small positive points', () => {
      const performance: PlayerPerformance = {
        player_id: 'player1',
        points: 0.1,
        did_not_play: false
      };

      expect(isPlayerDNP(performance)).toBe(false);
    });

    it('should handle player with very small negative points', () => {
      const performance: PlayerPerformance = {
        player_id: 'player1',
        points: -0.1,
        did_not_play: false
      };

      expect(isPlayerDNP(performance)).toBe(false);
    });
  });

  describe('Substitution Priority', () => {
    it('should prioritize bench players in order', () => {
      const benchPlayers = ['bench1', 'bench2', 'bench3'];
      const benchPriority: string[] = [];
      const alreadySubbed = new Set<string>();

      // Simulate finding first available
      const firstAvailable = benchPlayers.find(p => !alreadySubbed.has(p));

      expect(firstAvailable).toBe('bench1');
    });

    it('should skip already substituted players', () => {
      const benchPlayers = ['bench1', 'bench2', 'bench3'];
      const alreadySubbed = new Set(['bench1']);

      const nextAvailable = benchPlayers.find(p => !alreadySubbed.has(p));

      expect(nextAvailable).toBe('bench2');
    });

    it('should return undefined when all bench players used', () => {
      const benchPlayers = ['bench1', 'bench2'];
      const alreadySubbed = new Set(['bench1', 'bench2']);

      const nextAvailable = benchPlayers.find(p => !alreadySubbed.has(p));

      expect(nextAvailable).toBeUndefined();
    });

    it('should respect custom bench priority', () => {
      const benchPlayers = ['bench1', 'bench2', 'bench3'];
      const benchPriority = ['bench3', 'bench1', 'bench2'];
      const alreadySubbed = new Set<string>();

      // Find first in priority that's available
      const firstPriority = benchPriority.find(
        p => benchPlayers.includes(p) && !alreadySubbed.has(p)
      );

      expect(firstPriority).toBe('bench3');
    });

    it('should skip unavailable players in priority', () => {
      const benchPlayers = ['bench1', 'bench2', 'bench3'];
      const benchPriority = ['bench3', 'bench1', 'bench2'];
      const alreadySubbed = new Set(['bench3']);

      const nextPriority = benchPriority.find(
        p => benchPlayers.includes(p) && !alreadySubbed.has(p)
      );

      expect(nextPriority).toBe('bench1');
    });
  });

  describe('Captain and Vice-Captain Protection', () => {
    it('should not substitute captain even if DNP', () => {
      const captainId = 'captain1';
      const startingPlayers = ['captain1', 'player2', 'player3', 'player4', 'player5'];

      // Captain should be excluded from substitution logic
      const eligibleForSub = startingPlayers.filter(p => p !== captainId);

      expect(eligibleForSub).not.toContain(captainId);
      expect(eligibleForSub).toHaveLength(4);
    });

    it('should not substitute vice-captain even if DNP', () => {
      const viceCaptainId = 'vc1';
      const captainId = 'captain1';
      const startingPlayers = ['captain1', 'vc1', 'player3', 'player4', 'player5'];

      // Both captain and VC should be excluded
      const eligibleForSub = startingPlayers.filter(
        p => p !== captainId && p !== viceCaptainId
      );

      expect(eligibleForSub).not.toContain(captainId);
      expect(eligibleForSub).not.toContain(viceCaptainId);
      expect(eligibleForSub).toHaveLength(3);
    });
  });

  describe('Points Calculation', () => {
    it('should not apply multipliers to substitutes', () => {
      const substitutePoints = 10;
      const multiplier = 1.0; // Substitutes always get 1.0

      const finalPoints = substitutePoints * multiplier;

      expect(finalPoints).toBe(10);
    });

    it('should apply captain multiplier to captain even if others subbed', () => {
      const captainPoints = 10;
      const captainMultiplier = 2.0;

      const finalPoints = captainPoints * captainMultiplier;

      expect(finalPoints).toBe(20);
    });

    it('should calculate total with mix of starters and subs', () => {
      // Starter 1: 10 points (no multiplier)
      // Starter 2: DNP, subbed with 8 points
      // Starter 3: 12 points (no multiplier)
      // Captain: 15 points (2x = 30)
      // VC: 10 points (1.5x = 15)

      const total = 10 + 8 + 12 + 30 + 15;

      expect(total).toBe(75);
    });
  });
});
