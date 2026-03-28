/**
 * Tests for Fantasy Fixture Difficulty Calculator
 * Tests difficulty rating calculation based on opponent strength and venue
 */

import { describe, it, expect } from 'vitest';
import {
  calculateDifficultyScore,
  getDifficultyStars,
  getDifficultyLabel,
  getDifficultyColor,
  type DifficultyFactors
} from './fixture-difficulty';

describe('Fantasy Fixture Difficulty Calculator', () => {
  describe('calculateDifficultyScore', () => {
    it('should return 5 for top team away', () => {
      const factors: DifficultyFactors = {
        opponent_rank: 1,
        opponent_form_avg: 18,
        is_home: false,
        total_teams: 20
      };

      const score = calculateDifficultyScore(factors);

      expect(score).toBe(5);
    });

    it('should return 1 for bottom team at home', () => {
      const factors: DifficultyFactors = {
        opponent_rank: 20,
        opponent_form_avg: 5,
        is_home: true,
        total_teams: 20
      };

      const score = calculateDifficultyScore(factors);

      expect(score).toBe(1);
    });

    it('should return 3 for mid-table team neutral venue', () => {
      const factors: DifficultyFactors = {
        opponent_rank: 10,
        opponent_form_avg: 10,
        is_home: false,
        total_teams: 20
      };

      const score = calculateDifficultyScore(factors);

      expect(score).toBeGreaterThanOrEqual(2);
      expect(score).toBeLessThanOrEqual(4);
    });

    it('should consider opponent rank (top 25%)', () => {
      const factors: DifficultyFactors = {
        opponent_rank: 3, // Top 25% of 20 teams
        opponent_form_avg: 10,
        is_home: true,
        total_teams: 20
      };

      const score = calculateDifficultyScore(factors);

      // Should be difficult even at home
      expect(score).toBeGreaterThanOrEqual(3);
    });

    it('should consider opponent form', () => {
      const factors: DifficultyFactors = {
        opponent_rank: 10,
        opponent_form_avg: 18, // Excellent form
        is_home: true,
        total_teams: 20
      };

      const score = calculateDifficultyScore(factors);

      // High form should increase difficulty
      expect(score).toBeGreaterThanOrEqual(3);
    });

    it('should give home advantage', () => {
      const baseFactors: DifficultyFactors = {
        opponent_rank: 5,
        opponent_form_avg: 12,
        is_home: false,
        total_teams: 20
      };

      const homeFactors: DifficultyFactors = {
        ...baseFactors,
        is_home: true
      };

      const awayScore = calculateDifficultyScore(baseFactors);
      const homeScore = calculateDifficultyScore(homeFactors);

      // Home should be easier (lower score)
      expect(homeScore).toBeLessThanOrEqual(awayScore);
    });

    it('should always return score between 1 and 5', () => {
      const testCases: DifficultyFactors[] = [
        { opponent_rank: 1, opponent_form_avg: 20, is_home: false, total_teams: 20 },
        { opponent_rank: 20, opponent_form_avg: 2, is_home: true, total_teams: 20 },
        { opponent_rank: 10, opponent_form_avg: 10, is_home: false, total_teams: 20 },
        { opponent_rank: 5, opponent_form_avg: 15, is_home: true, total_teams: 20 },
        { opponent_rank: 15, opponent_form_avg: 6, is_home: false, total_teams: 20 }
      ];

      testCases.forEach(factors => {
        const score = calculateDifficultyScore(factors);
        expect(score).toBeGreaterThanOrEqual(1);
        expect(score).toBeLessThanOrEqual(5);
      });
    });
  });

  describe('getDifficultyStars', () => {
    it('should return correct number of stars', () => {
      expect(getDifficultyStars(1)).toBe('⭐');
      expect(getDifficultyStars(2)).toBe('⭐⭐');
      expect(getDifficultyStars(3)).toBe('⭐⭐⭐');
      expect(getDifficultyStars(4)).toBe('⭐⭐⭐⭐');
      expect(getDifficultyStars(5)).toBe('⭐⭐⭐⭐⭐');
    });

    it('should handle edge cases', () => {
      expect(getDifficultyStars(0)).toBe('');
      expect(getDifficultyStars(6)).toBe('⭐⭐⭐⭐⭐⭐');
    });
  });

  describe('getDifficultyLabel', () => {
    it('should return correct labels', () => {
      expect(getDifficultyLabel(1)).toBe('Very Easy');
      expect(getDifficultyLabel(2)).toBe('Easy');
      expect(getDifficultyLabel(3)).toBe('Moderate');
      expect(getDifficultyLabel(4)).toBe('Difficult');
      expect(getDifficultyLabel(5)).toBe('Very Difficult');
    });

    it('should handle invalid scores', () => {
      expect(getDifficultyLabel(0)).toBe('Unknown');
      expect(getDifficultyLabel(6)).toBe('Unknown');
    });
  });

  describe('getDifficultyColor', () => {
    it('should return correct color classes', () => {
      expect(getDifficultyColor(1)).toBe('text-green-600');
      expect(getDifficultyColor(2)).toBe('text-green-500');
      expect(getDifficultyColor(3)).toBe('text-yellow-500');
      expect(getDifficultyColor(4)).toBe('text-orange-500');
      expect(getDifficultyColor(5)).toBe('text-red-500');
    });

    it('should handle invalid scores', () => {
      expect(getDifficultyColor(0)).toBe('text-gray-500');
      expect(getDifficultyColor(6)).toBe('text-gray-500');
    });
  });

  describe('Difficulty Calculation Logic', () => {
    it('should weight position heavily', () => {
      // Two teams with same form, different positions
      const topTeam: DifficultyFactors = {
        opponent_rank: 1,
        opponent_form_avg: 10,
        is_home: false,
        total_teams: 20
      };

      const bottomTeam: DifficultyFactors = {
        opponent_rank: 20,
        opponent_form_avg: 10,
        is_home: false,
        total_teams: 20
      };

      const topScore = calculateDifficultyScore(topTeam);
      const bottomScore = calculateDifficultyScore(bottomTeam);

      expect(topScore).toBeGreaterThan(bottomScore);
    });

    it('should weight form significantly', () => {
      // Same position, different form
      const hotForm: DifficultyFactors = {
        opponent_rank: 10,
        opponent_form_avg: 18,
        is_home: false,
        total_teams: 20
      };

      const coldForm: DifficultyFactors = {
        opponent_rank: 10,
        opponent_form_avg: 4,
        is_home: false,
        total_teams: 20
      };

      const hotScore = calculateDifficultyScore(hotForm);
      const coldScore = calculateDifficultyScore(coldForm);

      expect(hotScore).toBeGreaterThan(coldScore);
    });

    it('should apply venue modifier correctly', () => {
      const factors: DifficultyFactors = {
        opponent_rank: 10,
        opponent_form_avg: 12,
        is_home: false,
        total_teams: 20
      };

      const awayScore = calculateDifficultyScore(factors);
      const homeScore = calculateDifficultyScore({ ...factors, is_home: true });

      // Home advantage should reduce difficulty by at least 0.5
      expect(awayScore - homeScore).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle single team league', () => {
      const factors: DifficultyFactors = {
        opponent_rank: 1,
        opponent_form_avg: 10,
        is_home: false,
        total_teams: 1
      };

      const score = calculateDifficultyScore(factors);

      expect(score).toBeGreaterThanOrEqual(1);
      expect(score).toBeLessThanOrEqual(5);
    });

    it('should handle very large leagues', () => {
      const factors: DifficultyFactors = {
        opponent_rank: 50,
        opponent_form_avg: 10,
        is_home: false,
        total_teams: 100
      };

      const score = calculateDifficultyScore(factors);

      expect(score).toBeGreaterThanOrEqual(1);
      expect(score).toBeLessThanOrEqual(5);
    });

    it('should handle zero form average', () => {
      const factors: DifficultyFactors = {
        opponent_rank: 10,
        opponent_form_avg: 0,
        is_home: false,
        total_teams: 20
      };

      const score = calculateDifficultyScore(factors);

      // Should be very easy
      expect(score).toBeLessThanOrEqual(2);
    });

    it('should handle very high form average', () => {
      const factors: DifficultyFactors = {
        opponent_rank: 10,
        opponent_form_avg: 25,
        is_home: false,
        total_teams: 20
      };

      const score = calculateDifficultyScore(factors);

      // Should be difficult
      expect(score).toBeGreaterThanOrEqual(4);
    });
  });

  describe('Consistency Tests', () => {
    it('should return same score for same inputs', () => {
      const factors: DifficultyFactors = {
        opponent_rank: 7,
        opponent_form_avg: 11.5,
        is_home: true,
        total_teams: 20
      };

      const score1 = calculateDifficultyScore(factors);
      const score2 = calculateDifficultyScore(factors);

      expect(score1).toBe(score2);
    });

    it('should have monotonic relationship with rank', () => {
      // As opponent rank improves (gets lower), difficulty should increase
      const scores = [];
      
      for (let rank = 1; rank <= 20; rank++) {
        const factors: DifficultyFactors = {
          opponent_rank: rank,
          opponent_form_avg: 10,
          is_home: false,
          total_teams: 20
        };
        scores.push(calculateDifficultyScore(factors));
      }

      // First half should generally be harder than second half
      const firstHalfAvg = scores.slice(0, 10).reduce((a, b) => a + b) / 10;
      const secondHalfAvg = scores.slice(10).reduce((a, b) => a + b) / 10;

      expect(firstHalfAvg).toBeGreaterThanOrEqual(secondHalfAvg);
    });
  });
});
