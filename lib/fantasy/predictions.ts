/**
 * Fantasy League - Weekly Predictions System
 * 
 * Teams predict match outcomes before each round for bonus points:
 * - Correct winner: +5 points
 * - Correct score: +10 points
 * - Correct MOTM: +15 points
 * - Perfect round (all correct): +50 bonus
 * 
 * Predictions must be submitted before match deadline.
 */

import { neon } from '@neondatabase/serverless';

export interface MatchPrediction {
  match_id: string;
  predicted_winner?: string; // team_id or 'draw'
  predicted_score?: {
    home: number;
    away: number;
  };
  predicted_motm?: string; // player_id
}

export interface PredictionSubmission {
  prediction_id: string;
  league_id: string;
  team_id: string;
  round_id: string;
  predictions: Record<string, MatchPrediction>; // match_id -> prediction
  is_locked: boolean;
  locked_at?: Date;
  bonus_points: number;
  correct_predictions: number;
  total_predictions: number;
}

export interface MatchResult {
  match_id: string;
  winner?: string; // team_id or 'draw'
  score: {
    home: number;
    away: number;
  };
  motm?: string; // player_id
}

export interface PredictionScore {
  correct_winner: boolean;
  correct_score: boolean;
  correct_motm: boolean;
  points_earned: number;
}

/**
 * Calculate points for a single prediction
 */
export function calculatePredictionPoints(
  prediction: MatchPrediction,
  result: MatchResult
): PredictionScore {
  let points = 0;
  let correctWinner = false;
  let correctScore = false;
  let correctMotm = false;

  // Check winner prediction
  if (prediction.predicted_winner && result.winner) {
    if (prediction.predicted_winner === result.winner) {
      correctWinner = true;
      points += 5;
    }
  }

  // Check score prediction
  if (prediction.predicted_score && result.score) {
    if (
      prediction.predicted_score.home === result.score.home &&
      prediction.predicted_score.away === result.score.away
    ) {
      correctScore = true;
      points += 10;
    }
  }

  // Check MOTM prediction
  if (prediction.predicted_motm && result.motm) {
    if (prediction.predicted_motm === result.motm) {
      correctMotm = true;
      points += 15;
    }
  }

  return {
    correct_winner: correctWinner,
    correct_score: correctScore,
    correct_motm: correctMotm,
    points_earned: points
  };
}

/**
 * Calculate total bonus points for all predictions
 */
export function calculateTotalPredictionPoints(
  predictions: Record<string, MatchPrediction>,
  results: Record<string, MatchResult>
): {
  total_points: number;
  correct_count: number;
  total_count: number;
  is_perfect: boolean;
} {
  let totalPoints = 0;
  let correctCount = 0;
  let totalCount = 0;
  let allCorrect = true;

  for (const matchId in predictions) {
    if (results[matchId]) {
      const score = calculatePredictionPoints(predictions[matchId], results[matchId]);
      totalPoints += score.points_earned;
      totalCount++;

      if (score.correct_winner || score.correct_score || score.correct_motm) {
        correctCount++;
      }

      if (!score.correct_winner || !score.correct_score || !score.correct_motm) {
        allCorrect = false;
      }
    }
  }

  // Perfect round bonus
  if (allCorrect && totalCount > 0) {
    totalPoints += 50;
  }

  return {
    total_points: totalPoints,
    correct_count: correctCount,
    total_count: totalCount,
    is_perfect: allCorrect && totalCount > 0
  };
}

/**
 * Submit predictions for a round
 */
export async function submitPredictions(
  leagueId: string,
  teamId: string,
  roundId: string,
  predictions: Record<string, MatchPrediction>
): Promise<PredictionSubmission> {
  const sql = neon(process.env.NEON_DATABASE_URL!);

  const predictionId = `pred_${leagueId}_${teamId}_${roundId}`;

  // Check if already locked
  const existing = await sql`
    SELECT is_locked
    FROM fantasy_predictions
    WHERE prediction_id = ${predictionId}
  `;

  if (existing.length > 0 && existing[0].is_locked) {
    throw new Error('Predictions already locked for this round');
  }

  // Store predictions
  await sql`
    INSERT INTO fantasy_predictions (
      prediction_id,
      league_id,
      team_id,
      round_id,
      predictions,
      is_locked,
      locked_at
    ) VALUES (
      ${predictionId},
      ${leagueId},
      ${teamId},
      ${roundId},
      ${JSON.stringify(predictions)}::jsonb,
      false,
      NULL
    )
    ON CONFLICT (league_id, team_id, round_id)
    DO UPDATE SET
      predictions = ${JSON.stringify(predictions)}::jsonb,
      updated_at = NOW()
  `;

  return {
    prediction_id: predictionId,
    league_id: leagueId,
    team_id: teamId,
    round_id: roundId,
    predictions,
    is_locked: false,
    bonus_points: 0,
    correct_predictions: 0,
    total_predictions: Object.keys(predictions).length
  };
}

/**
 * Lock predictions at deadline
 */
export async function lockPredictions(
  leagueId: string,
  roundId: string
): Promise<number> {
  const sql = neon(process.env.NEON_DATABASE_URL!);

  const result = await sql`
    UPDATE fantasy_predictions
    SET 
      is_locked = true,
      locked_at = NOW()
    WHERE league_id = ${leagueId}
    AND round_id = ${roundId}
    AND is_locked = false
  `;

  return result.length;
}

/**
 * Calculate and award bonus points for predictions
 */
export async function calculatePredictionBonuses(
  leagueId: string,
  roundId: string,
  results: Record<string, MatchResult>
): Promise<number> {
  const sql = neon(process.env.NEON_DATABASE_URL!);

  // Get all predictions for this round
  const predictions = await sql`
    SELECT *
    FROM fantasy_predictions
    WHERE league_id = ${leagueId}
    AND round_id = ${roundId}
    AND is_locked = true
  `;

  let teamsProcessed = 0;

  for (const pred of predictions) {
    const teamPredictions = pred.predictions as Record<string, MatchPrediction>;
    
    // Calculate points
    const score = calculateTotalPredictionPoints(teamPredictions, results);

    // Update prediction record
    await sql`
      UPDATE fantasy_predictions
      SET 
        bonus_points = ${score.total_points},
        correct_predictions = ${score.correct_count},
        total_predictions = ${score.total_count},
        calculated_at = NOW()
      WHERE prediction_id = ${pred.prediction_id}
    `;

    // Add bonus points to team
    await sql`
      UPDATE fantasy_teams
      SET total_points = total_points + ${score.total_points}
      WHERE team_id = ${pred.team_id}
      AND league_id = ${leagueId}
    `;

    teamsProcessed++;
  }

  return teamsProcessed;
}

/**
 * Get predictions for a team
 */
export async function getPredictions(
  leagueId: string,
  teamId: string,
  roundId: string
): Promise<PredictionSubmission | null> {
  const sql = neon(process.env.NEON_DATABASE_URL!);

  const result = await sql`
    SELECT *
    FROM fantasy_predictions
    WHERE league_id = ${leagueId}
    AND team_id = ${teamId}
    AND round_id = ${roundId}
  `;

  if (result.length === 0) return null;

  const row = result[0];
  return {
    prediction_id: row.prediction_id,
    league_id: row.league_id,
    team_id: row.team_id,
    round_id: row.round_id,
    predictions: row.predictions as Record<string, MatchPrediction>,
    is_locked: row.is_locked,
    locked_at: row.locked_at ? new Date(row.locked_at) : undefined,
    bonus_points: parseFloat(row.bonus_points || '0'),
    correct_predictions: row.correct_predictions || 0,
    total_predictions: row.total_predictions || 0
  };
}

/**
 * Get prediction history for a team
 */
export async function getPredictionHistory(
  leagueId: string,
  teamId: string
): Promise<PredictionSubmission[]> {
  const sql = neon(process.env.NEON_DATABASE_URL!);

  const results = await sql`
    SELECT *
    FROM fantasy_predictions
    WHERE league_id = ${leagueId}
    AND team_id = ${teamId}
    ORDER BY round_id DESC
  `;

  return results.map(row => ({
    prediction_id: row.prediction_id,
    league_id: row.league_id,
    team_id: row.team_id,
    round_id: row.round_id,
    predictions: row.predictions as Record<string, MatchPrediction>,
    is_locked: row.is_locked,
    locked_at: row.locked_at ? new Date(row.locked_at) : undefined,
    bonus_points: parseFloat(row.bonus_points || '0'),
    correct_predictions: row.correct_predictions || 0,
    total_predictions: row.total_predictions || 0
  }));
}

/**
 * Get prediction leaderboard for a round
 */
export async function getPredictionLeaderboard(
  leagueId: string,
  roundId: string
): Promise<Array<{
  team_id: string;
  bonus_points: number;
  correct_predictions: number;
  total_predictions: number;
  accuracy: number;
}>> {
  const sql = neon(process.env.NEON_DATABASE_URL!);

  const results = await sql`
    SELECT 
      team_id,
      bonus_points,
      correct_predictions,
      total_predictions
    FROM fantasy_predictions
    WHERE league_id = ${leagueId}
    AND round_id = ${roundId}
    AND is_locked = true
    ORDER BY bonus_points DESC, correct_predictions DESC
  `;

  return results.map(row => ({
    team_id: row.team_id,
    bonus_points: parseFloat(row.bonus_points || '0'),
    correct_predictions: row.correct_predictions || 0,
    total_predictions: row.total_predictions || 0,
    accuracy: row.total_predictions > 0 
      ? (row.correct_predictions / row.total_predictions) * 100 
      : 0
  }));
}
