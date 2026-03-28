/**
 * Tests for Fantasy Points Calculator V2
 * Tests the enhanced points calculation with form multipliers and bonuses
 */

import { describe, it, expect, vi, beforeEach } from 'vivitest';
import {
  calculatePlayerPoints,
  calculateLineupPoints,
  applyFormMultiplier,
  applyPowerUpBonus
} from './points-calculator-v2';

describe('Fantasy Points Calculator V2', () => {
  describe('calculatePlayerPoints', () => {
    it('should calculate base points correctly', () => {
      const stats = {
        goals_scored: 2,
        assists: 1,
        clean_sheet: false,
        motm: false
      };

      const points = calculatePlayerPoints(stats);
      
      // 2 goals (10 pts each) + 1 assist (5 pts) = 25 pts
      expect(points.base_points).toBe(25);
      expect(points.total_points).toBe(25);
    });

    it('should add clean sheet bonus', () => {
      const stats = {
        goals_scored: 0,
        assists: 0,
        clean_sheet: true,
        motm: false
      };

      const points = calculatePlayerPoints(stats);
      
      // Clean sheet = 5 pts
      expect(points.base_points).toBe(5);
    });

    it('should add MOTM bonus', () => {
      const stats = {
        goals_scored: 1,
        assists: 0,
        clean_sheet: false,
        motm: true
      };

      const points = calculatePlayerPoints(stats);
      
      // 1 goal (10 pts) + MOTM (10 pts) = 20 pts
      expect(points.base_points).toBe(10);
      expect(points.bonus_points).toBe(10);
      expect(points.total_points).toBe(20);
    });

    it('should handle hat-trick bonus', () => {
      const stats = {
        goals_scored: 3,
        assists: 0,
        clean_sheet: false,
        motm: false
      };

      const points = calculatePlayerPoints(stats);
      
      // 3 goals (30 pts) + hat-trick bonus (15 pts) = 45 pts
      expect(points.base_points).toBe(30);
      expect(points.bonus_points).toBe(15);
      expect(points.total_points).toBe(45);
    });
  });

  describe('applyFormMultiplier', () => {
    it('should apply fire form multiplier (1.15x)', () => {
      const basePoints = 100;
      const multiplier = 1.15;

      const result = applyFormMultiplier(basePoints, multiplier);
      
      expect(result).toBe(115);
    });

    it('should apply frozen form multiplier (0.85x)', () => {
      const basePoints = 100;
      const multiplier = 0.85;

      const result = applyFormMultiplier(basePoints, multiplier);
      
      expect(result).toBe(85);
    });

    it('should round to nearest integer', () => {
      const basePoints = 100;
      const multiplier = 1.12;

      const result = applyFormMultiplier(basePoints, multiplier);
      
      expect(result).toBe(112);
    });

    it('should handle steady form (1.0x)', () => {
      const basePoints = 100;
      const multiplier = 1.0;

      const result = applyFormMultiplier(basePoints, multiplier);
      
      expect(result).toBe(100);
    });
  });

  describe('applyPowerUpBonus', () => {
    it('should apply triple captain (3x)', () => {
      const basePoints = 50;
      const powerUp = 'triple_captain';

      const result = applyPowerUpBonus(basePoints, powerUp);
      
      expect(result).toBe(150);
    });

    it('should apply regular captain (2x)', () => {
      const basePoints = 50;
      const powerUp = 'captain';

      const result = applyPowerUpBonus(basePoints, powerUp);
      
      expect(result).toBe(100);
    });

    it('should handle no power-up', () => {
      const basePoints = 50;
      const powerUp = null;

      const result = applyPowerUpBonus(basePoints, powerUp);
      
      expect(result).toBe(50);
    });
  });

  describe('calculateLineupPoints', () => {
    it('should calculate total lineup points', () => {
      const lineup = [
        { player_id: 'p1', points: 10, is_captain: false, form_multiplier: 1.0 },
        { player_id: 'p2', points: 15, is_captain: true, form_multiplier: 1.1 },
        { player_id: 'p3', points: 8, is_captain: false, form_multiplier: 0.9 }
      ];

      const result = calculateLineupPoints(lineup);
      
      // p1: 10 * 1.0 = 10
      // p2: 15 * 1.1 * 2 (captain) = 33
      // p3: 8 * 0.9 = 7.2 (rounded to 7)
      // Total: 10 + 33 + 7 = 50
      expect(result.total_points).toBe(50);
    });

    it('should handle bench boost power-up', () => {
      const lineup = [
        { player_id: 'p1', points: 10, is_captain: false, form_multiplier: 1.0, on_bench: false },
        { player_id: 'p2', points: 5, is_captain: false, form_multiplier: 1.0, on_bench: true }
      ];

      const result = calculateLineupPoints(lineup, { bench_boost: true });
      
      // With bench boost, bench players count
      // p1: 10, p2: 5
      // Total: 15
      expect(result.total_points).toBe(15);
    });

    it('should exclude bench without bench boost', () => {
      const lineup = [
        { player_id: 'p1', points: 10, is_captain: false, form_multiplier: 1.0, on_bench: false },
        { player_id: 'p2', points: 5, is_captain: false, form_multiplier: 1.0, on_bench: true }
      ];

      const result = calculateLineupPoints(lineup);
      
      // Without bench boost, only starting 11 count
      // p1: 10
      // Total: 10
      expect(result.total_points).toBe(10);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero points', () => {
      const stats = {
        goals_scored: 0,
        assists: 0,
        clean_sheet: false,
        motm: false
      };

      const points = calculatePlayerPoints(stats);
      
      expect(points.total_points).toBe(0);
    });

    it('should handle negative multipliers gracefully', () => {
      const basePoints = 100;
      const multiplier = -0.5;

      const result = applyFormMultiplier(basePoints, multiplier);
      
      // Should not allow negative points
      expect(result).toBeGreaterThanOrEqual(0);
    });

    it('should handle very large point values', () => {
      const stats = {
        goals_scored: 10,
        assists: 10,
        clean_sheet: true,
        motm: true
      };

      const points = calculatePlayerPoints(stats);
      
      // 10 goals (100) + 10 assists (50) + clean sheet (5) + MOTM (10) = 165
      expect(points.total_points).toBeGreaterThan(100);
    });
  });
});
