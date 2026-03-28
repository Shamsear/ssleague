/**
 * Tests for Fantasy League - Weekly Predictions System
 */

import { describe, it, expect } from 'vitest';
import {
  calculatePredictionPoints,
  calculateTotalPredictionPoints,
  type MatchPrediction,
  type MatchResult
} from './predictions';

describe('Weekly Predictions System', () => {
  describe('calculatePredictionPoints', () => {
    it('should award 5 points for correct winner', () => {
      const prediction: MatchPrediction = {
        match_id: 'm1',
        predicted_winner: 'team_a'
      };

      const result: MatchResult = {
        match_id: 'm1',
        winner: 'team_a',
        score: { home: 2, away: 1 }
      };

      const score = calculatePredictionPoints(prediction, result);

      expect(score.correct_winner).toBe(true);
      expect(score.points_earned).toBe(5);
    });

    it('should award 10 points for correct score', () => {
      const prediction: MatchPrediction = {
        match_id: 'm1',
        predicted_score: { home: 2, away: 1 }
      };

      const result: MatchResult = {
        match_id: 'm1',
        winner: 'team_a',
        score: { home: 2, away: 1 }
      };

      const score = calculatePredictionPoints(prediction, result);

      expect(score.correct_score).toBe(true);
      expect(score.points_earned).toBe(10);
    });

    it('should award 15 points for correct MOTM', () => {
      const prediction: MatchPrediction = {
        match_id: 'm1',
        predicted_motm: 'player_1'
      };

      const result: MatchResult = {
        match_id: 'm1',
        winner: 'team_a',
        score: { home: 2, away: 1 },
        motm: 'player_1'
      };

      const score = calculatePredictionPoints(prediction, result);

      expect(score.correct_motm).toBe(true);
      expect(score.points_earned).toBe(15);
    });

    it('should award 30 points for all correct (winner + score + MOTM)', () => {
      const prediction: MatchPrediction = {
        match_id: 'm1',
        predicted_winner: 'team_a',
        predicted_score: { home: 2, away: 1 },
        predicted_motm: 'player_1'
      };

      const result: MatchResult = {
        match_id: 'm1',
        winner: 'team_a',
        score: { home: 2, away: 1 },
        motm: 'player_1'
      };

      const score = calculatePredictionPoints(prediction, result);

      expect(score.correct_winner).toBe(true);
      expect(score.correct_score).toBe(true);
      expect(score.correct_motm).toBe(true);
      expect(score.points_earned).toBe(30); // 5 + 10 + 15
    });

    it('should award 0 points for all incorrect', () => {
      const prediction: MatchPrediction = {
        match_id: 'm1',
        predicted_winner: 'team_b',
        predicted_score: { home: 1, away: 2 },
        predicted_motm: 'player_2'
      };

      const result: MatchResult = {
        match_id: 'm1',
        winner: 'team_a',
        score: { home: 2, away: 1 },
        motm: 'player_1'
      };

      const score = calculatePredictionPoints(prediction, result);

      expect(score.correct_winner).toBe(false);
      expect(score.correct_score).toBe(false);
      expect(score.correct_motm).toBe(false);
      expect(score.points_earned).toBe(0);
    });

    it('should handle draw prediction correctly', () => {
      const prediction: MatchPrediction = {
        match_id: 'm1',
        predicted_winner: 'draw'
      };

      const result: MatchResult = {
        match_id: 'm1',
        winner: 'draw',
        score: { home: 1, away: 1 }
      };

      const score = calculatePredictionPoints(prediction, result);

      expect(score.correct_winner).toBe(true);
      expect(score.points_earned).toBe(5);
    });

    it('should handle partial predictions', () => {
      const prediction: MatchPrediction = {
        match_id: 'm1',
        predicted_winner: 'team_a'
        // No score or MOTM prediction
      };

      const result: MatchResult = {
        match_id: 'm1',
        winner: 'team_a',
        score: { home: 2, away: 1 },
        motm: 'player_1'
      };

      const score = calculatePredictionPoints(prediction, result);

      expect(score.correct_winner).toBe(true);
      expect(score.correct_score).toBe(false);
      expect(score.correct_motm).toBe(false);
      expect(score.points_earned).toBe(5);
    });
  });

  describe('calculateTotalPredictionPoints', () => {
    it('should calculate total points for multiple predictions', () => {
      const predictions: Record<string, MatchPrediction> = {
        m1: {
          match_id: 'm1',
          predicted_winner: 'team_a',
          predicted_score: { home: 2, away: 1 }
        },
        m2: {
          match_id: 'm2',
          predicted_winner: 'team_c',
          predicted_motm: 'player_3'
        }
      };

      const results: Record<string, MatchResult> = {
        m1: {
          match_id: 'm1',
          winner: 'team_a',
          score: { home: 2, away: 1 }
        },
        m2: {
          match_id: 'm2',
          winner: 'team_c',
          score: { home: 3, away: 0 },
          motm: 'player_3'
        }
      };

      const total = calculateTotalPredictionPoints(predictions, results);

      expect(total.total_points).toBe(35); // (5+10) + (5+15)
      expect(total.correct_count).toBe(2);
      expect(total.total_count).toBe(2);
      expect(total.is_perfect).toBe(false); // Not all aspects correct
    });

    it('should award 50 bonus for perfect round', () => {
      const predictions: Record<string, MatchPrediction> = {
        m1: {
          match_id: 'm1',
          predicted_winner: 'team_a',
          predicted_score: { home: 2, away: 1 },
          predicted_motm: 'player_1'
        },
        m2: {
          match_id: 'm2',
          predicted_winner: 'team_c',
          predicted_score: { home: 3, away: 0 },
          predicted_motm: 'player_3'
        }
      };

      const results: Record<string, MatchResult> = {
        m1: {
          match_id: 'm1',
          winner: 'team_a',
          score: { home: 2, away: 1 },
          motm: 'player_1'
        },
        m2: {
          match_id: 'm2',
          winner: 'team_c',
          score: { home: 3, away: 0 },
          motm: 'player_3'
        }
      };

      const total = calculateTotalPredictionPoints(predictions, results);

      expect(total.total_points).toBe(110); // (30 + 30) + 50 bonus
      expect(total.is_perfect).toBe(true);
    });

    it('should not award perfect bonus if any prediction wrong', () => {
      const predictions: Record<string, MatchPrediction> = {
        m1: {
          match_id: 'm1',
          predicted_winner: 'team_a',
          predicted_score: { home: 2, away: 1 },
          predicted_motm: 'player_1'
        },
        m2: {
          match_id: 'm2',
          predicted_winner: 'team_d', // Wrong
          predicted_score: { home: 3, away: 0 },
          predicted_motm: 'player_3'
        }
      };

      const results: Record<string, MatchResult> = {
        m1: {
          match_id: 'm1',
          winner: 'team_a',
          score: { home: 2, away: 1 },
          motm: 'player_1'
        },
        m2: {
          match_id: 'm2',
          winner: 'team_c',
          score: { home: 3, away: 0 },
          motm: 'player_3'
        }
      };

      const total = calculateTotalPredictionPoints(predictions, results);

      expect(total.total_points).toBe(55); // 30 + 25 (no perfect bonus)
      expect(total.is_perfect).toBe(false);
    });

    it('should handle empty predictions', () => {
      const predictions: Record<string, MatchPrediction> = {};
      const results: Record<string, MatchResult> = {};

      const total = calculateTotalPredictionPoints(predictions, results);

      expect(total.total_points).toBe(0);
      expect(total.correct_count).toBe(0);
      expect(total.total_count).toBe(0);
      expect(total.is_perfect).toBe(false);
    });

    it('should handle predictions without results', () => {
      const predictions: Record<string, MatchPrediction> = {
        m1: {
          match_id: 'm1',
          predicted_winner: 'team_a'
        }
      };

      const results: Record<string, MatchResult> = {};

      const total = calculateTotalPredictionPoints(predictions, results);

      expect(total.total_points).toBe(0);
      expect(total.total_count).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle high-scoring matches', () => {
      const prediction: MatchPrediction = {
        match_id: 'm1',
        predicted_score: { home: 5, away: 4 }
      };

      const result: MatchResult = {
        match_id: 'm1',
        winner: 'team_a',
        score: { home: 5, away: 4 }
      };

      const score = calculatePredictionPoints(prediction, result);

      expect(score.correct_score).toBe(true);
      expect(score.points_earned).toBe(10);
    });

    it('should handle 0-0 draws', () => {
      const prediction: MatchPrediction = {
        match_id: 'm1',
        predicted_winner: 'draw',
        predicted_score: { home: 0, away: 0 }
      };

      const result: MatchResult = {
        match_id: 'm1',
        winner: 'draw',
        score: { home: 0, away: 0 }
      };

      const score = calculatePredictionPoints(prediction, result);

      expect(score.correct_winner).toBe(true);
      expect(score.correct_score).toBe(true);
      expect(score.points_earned).toBe(15); // 5 + 10
    });

    it('should not award score points if only one number matches', () => {
      const prediction: MatchPrediction = {
        match_id: 'm1',
        predicted_score: { home: 2, away: 1 }
      };

      const result: MatchResult = {
        match_id: 'm1',
        winner: 'team_a',
        score: { home: 2, away: 2 } // Only home score matches
      };

      const score = calculatePredictionPoints(prediction, result);

      expect(score.correct_score).toBe(false);
      expect(score.points_earned).toBe(0);
    });
  });
});
