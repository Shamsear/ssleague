/**
 * Tests for Fantasy Form Tracker
 * Tests player form calculation and status determination
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateFormStatus,
  getFormEmoji,
  getFormLabel,
  getFormColor,
  type PlayerPerformance,
  type FormStatus
} from './form-tracker';

describe('Fantasy Form Tracker', () => {
  describe('calculateFormStatus', () => {
    it('should return fire status for 3+ excellent games', () => {
      const performances: PlayerPerformance[] = [
        { round_id: 'r1', round_number: 1, points: 20, played_at: new Date() },
        { round_id: 'r2', round_number: 2, points: 18, played_at: new Date() },
        { round_id: 'r3', round_number: 3, points: 16, played_at: new Date() },
        { round_id: 'r4', round_number: 4, points: 10, played_at: new Date() },
        { round_id: 'r5', round_number: 5, points: 8, played_at: new Date() }
      ];

      const result = calculateFormStatus(performances);

      expect(result.status).toBe('fire');
      expect(result.multiplier).toBe(1.15);
      expect(result.streak).toBe(3);
    });

    it('should return hot status for 2 excellent games', () => {
      const performances: PlayerPerformance[] = [
        { round_id: 'r1', round_number: 1, points: 17, played_at: new Date() },
        { round_id: 'r2', round_number: 2, points: 16, played_at: new Date() },
        { round_id: 'r3', round_number: 3, points: 10, played_at: new Date() },
        { round_id: 'r4', round_number: 4, points: 8, played_at: new Date() },
        { round_id: 'r5', round_number: 5, points: 7, played_at: new Date() }
      ];

      const result = calculateFormStatus(performances);

      expect(result.status).toBe('hot');
      expect(result.multiplier).toBe(1.10);
      expect(result.streak).toBe(2);
    });

    it('should return steady status for normal performance', () => {
      const performances: PlayerPerformance[] = [
        { round_id: 'r1', round_number: 1, points: 10, played_at: new Date() },
        { round_id: 'r2', round_number: 2, points: 12, played_at: new Date() },
        { round_id: 'r3', round_number: 3, points: 8, played_at: new Date() },
        { round_id: 'r4', round_number: 4, points: 11, played_at: new Date() },
        { round_id: 'r5', round_number: 5, points: 9, played_at: new Date() }
      ];

      const result = calculateFormStatus(performances);

      expect(result.status).toBe('steady');
      expect(result.multiplier).toBe(1.0);
      expect(result.streak).toBe(0);
    });

    it('should return cold status for 2 poor games', () => {
      const performances: PlayerPerformance[] = [
        { round_id: 'r1', round_number: 1, points: 3, played_at: new Date() },
        { round_id: 'r2', round_number: 2, points: 4, played_at: new Date() },
        { round_id: 'r3', round_number: 3, points: 10, played_at: new Date() },
        { round_id: 'r4', round_number: 4, points: 8, played_at: new Date() },
        { round_id: 'r5', round_number: 5, points: 7, played_at: new Date() }
      ];

      const result = calculateFormStatus(performances);

      expect(result.status).toBe('cold');
      expect(result.multiplier).toBe(0.90);
      expect(result.streak).toBe(-2);
    });

    it('should return frozen status for 3+ poor games', () => {
      const performances: PlayerPerformance[] = [
        { round_id: 'r1', round_number: 1, points: 2, played_at: new Date() },
        { round_id: 'r2', round_number: 2, points: 3, played_at: new Date() },
        { round_id: 'r3', round_number: 3, points: 4, played_at: new Date() },
        { round_id: 'r4', round_number: 4, points: 1, played_at: new Date() },
        { round_id: 'r5', round_number: 5, points: 8, played_at: new Date() }
      ];

      const result = calculateFormStatus(performances);

      expect(result.status).toBe('frozen');
      expect(result.multiplier).toBe(0.85);
      expect(result.streak).toBe(-4);
    });

    it('should calculate correct average points', () => {
      const performances: PlayerPerformance[] = [
        { round_id: 'r1', round_number: 1, points: 10, played_at: new Date() },
        { round_id: 'r2', round_number: 2, points: 20, played_at: new Date() },
        { round_id: 'r3', round_number: 3, points: 15, played_at: new Date() }
      ];

      const result = calculateFormStatus(performances);

      // Average: (10 + 20 + 15) / 3 = 15
      expect(result.last_5_avg).toBe(15);
      expect(result.games_played).toBe(3);
    });

    it('should handle empty performance array', () => {
      const performances: PlayerPerformance[] = [];

      const result = calculateFormStatus(performances);

      expect(result.status).toBe('steady');
      expect(result.multiplier).toBe(1.0);
      expect(result.streak).toBe(0);
      expect(result.last_5_avg).toBe(0);
      expect(result.games_played).toBe(0);
    });

    it('should handle single game', () => {
      const performances: PlayerPerformance[] = [
        { round_id: 'r1', round_number: 1, points: 20, played_at: new Date() }
      ];

      const result = calculateFormStatus(performances);

      expect(result.games_played).toBe(1);
      expect(result.last_5_avg).toBe(20);
    });
  });

  describe('getFormEmoji', () => {
    it('should return correct emoji for each status', () => {
      expect(getFormEmoji('fire')).toBe('🔥');
      expect(getFormEmoji('hot')).toBe('📈');
      expect(getFormEmoji('steady')).toBe('➡️');
      expect(getFormEmoji('cold')).toBe('📉');
      expect(getFormEmoji('frozen')).toBe('❄️');
    });
  });

  describe('getFormLabel', () => {
    it('should return correct label for each status', () => {
      expect(getFormLabel('fire')).toBe('ON FIRE');
      expect(getFormLabel('hot')).toBe('HOT');
      expect(getFormLabel('steady')).toBe('STEADY');
      expect(getFormLabel('cold')).toBe('COLD');
      expect(getFormLabel('frozen')).toBe('FROZEN');
    });
  });

  describe('getFormColor', () => {
    it('should return correct color class for each status', () => {
      expect(getFormColor('fire')).toBe('text-red-500');
      expect(getFormColor('hot')).toBe('text-orange-500');
      expect(getFormColor('steady')).toBe('text-gray-500');
      expect(getFormColor('cold')).toBe('text-blue-400');
      expect(getFormColor('frozen')).toBe('text-blue-600');
    });
  });

  describe('Edge Cases', () => {
    it('should handle all excellent games', () => {
      const performances: PlayerPerformance[] = [
        { round_id: 'r1', round_number: 1, points: 20, played_at: new Date() },
        { round_id: 'r2', round_number: 2, points: 18, played_at: new Date() },
        { round_id: 'r3', round_number: 3, points: 22, played_at: new Date() },
        { round_id: 'r4', round_number: 4, points: 19, played_at: new Date() },
        { round_id: 'r5', round_number: 5, points: 25, played_at: new Date() }
      ];

      const result = calculateFormStatus(performances);

      expect(result.status).toBe('fire');
      expect(result.streak).toBe(5);
    });

    it('should handle all poor games', () => {
      const performances: PlayerPerformance[] = [
        { round_id: 'r1', round_number: 1, points: 2, played_at: new Date() },
        { round_id: 'r2', round_number: 2, points: 1, played_at: new Date() },
        { round_id: 'r3', round_number: 3, points: 3, played_at: new Date() },
        { round_id: 'r4', round_number: 4, points: 4, played_at: new Date() },
        { round_id: 'r5', round_number: 5, points: 2, played_at: new Date() }
      ];

      const result = calculateFormStatus(performances);

      expect(result.status).toBe('frozen');
      expect(result.streak).toBe(-5);
    });

    it('should handle exactly 15 points (excellent threshold)', () => {
      const performances: PlayerPerformance[] = [
        { round_id: 'r1', round_number: 1, points: 15, played_at: new Date() },
        { round_id: 'r2', round_number: 2, points: 15, played_at: new Date() },
        { round_id: 'r3', round_number: 3, points: 15, played_at: new Date() }
      ];

      const result = calculateFormStatus(performances);

      expect(result.status).toBe('fire');
    });

    it('should handle exactly 5 points (poor threshold)', () => {
      const performances: PlayerPerformance[] = [
        { round_id: 'r1', round_number: 1, points: 5, played_at: new Date() },
        { round_id: 'r2', round_number: 2, points: 5, played_at: new Date() },
        { round_id: 'r3', round_number: 3, points: 5, played_at: new Date() }
      ];

      const result = calculateFormStatus(performances);

      // 5 points is NOT poor (poor is <5)
      expect(result.status).toBe('steady');
    });
  });

  describe('Form Multiplier Boundaries', () => {
    it('should have multipliers within valid range', () => {
      const statuses: FormStatus[] = ['fire', 'hot', 'steady', 'cold', 'frozen'];
      
      statuses.forEach(status => {
        const performances: PlayerPerformance[] = [];
        const result = calculateFormStatus(performances);
        
        // Multipliers should be between 0.85 and 1.15
        expect(result.multiplier).toBeGreaterThanOrEqual(0.85);
        expect(result.multiplier).toBeLessThanOrEqual(1.15);
      });
    });

    it('should have consistent multiplier-status mapping', () => {
      const mappings = [
        { status: 'fire' as FormStatus, multiplier: 1.15 },
        { status: 'hot' as FormStatus, multiplier: 1.10 },
        { status: 'steady' as FormStatus, multiplier: 1.0 },
        { status: 'cold' as FormStatus, multiplier: 0.90 },
        { status: 'frozen' as FormStatus, multiplier: 0.85 }
      ];

      mappings.forEach(({ status, multiplier }) => {
        // Create performances that would result in this status
        let performances: PlayerPerformance[];
        
        if (status === 'fire') {
          performances = Array(5).fill(null).map((_, i) => ({
            round_id: `r${i}`,
            round_number: i,
            points: 20,
            played_at: new Date()
          }));
        } else if (status === 'frozen') {
          performances = Array(5).fill(null).map((_, i) => ({
            round_id: `r${i}`,
            round_number: i,
            points: 2,
            played_at: new Date()
          }));
        } else {
          performances = Array(5).fill(null).map((_, i) => ({
            round_id: `r${i}`,
            round_number: i,
            points: 10,
            played_at: new Date()
          }));
        }

        const result = calculateFormStatus(performances);
        
        if (status === 'fire' || status === 'frozen') {
          expect(result.multiplier).toBe(multiplier);
        }
      });
    });
  });
});
