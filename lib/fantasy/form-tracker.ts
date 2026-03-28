/**
 * Fantasy League - Player Form Tracker
 * 
 * Tracks player performance over last 5 games and calculates form status.
 * Form affects points multiplier (0.85x - 1.15x).
 * 
 * Form Status:
 * - 🔥 ON FIRE: 3+ excellent games (15+ points) → 1.15x multiplier
 * - 📈 HOT: 2 excellent games → 1.10x multiplier
 * - ➡️ STEADY: Normal performance → 1.00x multiplier
 * - 📉 COLD: 2 poor games (<5 points) → 0.90x multiplier
 * - ❄️ FROZEN: 3+ poor games → 0.85x multiplier
 */

import { neon } from '@neondatabase/serverless';

export type FormStatus = 'fire' | 'hot' | 'steady' | 'cold' | 'frozen';

export interface PlayerPerformance {
  round_id: string;
  round_number: number;
  points: number;
  played_at: Date;
}

export interface FormData {
  status: FormStatus;
  streak: number;
  last_5_avg: number;
  multiplier: number;
  games_played: number;
}

/**
 * Get last N performances for a player
 */
export async function getLastNPerformances(
  playerId: string,
  n: number = 5
): Promise<PlayerPerformance[]> {
  const sql = neon(process.env.NEON_DATABASE_URL!);

  const performances = await sql`
    SELECT 
      COALESCE(fixture_id, 'round_' || round_number) as round_id,
      round_number,
      total_points as points,
      recorded_at as played_at
    FROM fantasy_player_points
    WHERE real_player_id = ${playerId}
    ORDER BY round_number DESC
    LIMIT ${n}
  `;

  return performances.map(p => ({
    round_id: p.round_id,
    round_number: p.round_number,
    points: parseFloat(p.points.toString()),
    played_at: new Date(p.played_at)
  }));
}

/**
 * Calculate form status based on recent performances
 */
export function calculateFormStatus(performances: PlayerPerformance[]): FormData {
  if (performances.length === 0) {
    return {
      status: 'steady',
      streak: 0,
      last_5_avg: 0,
      multiplier: 1.0,
      games_played: 0
    };
  }

  // Calculate average points
  const totalPoints = performances.reduce((sum, p) => sum + p.points, 0);
  const avgPoints = totalPoints / performances.length;

  // Count excellent games (15+ points) and poor games (<5 points)
  const excellentGames = performances.filter(p => p.points >= 15).length;
  const poorGames = performances.filter(p => p.points < 5).length;

  // Determine form status and multiplier
  let status: FormStatus = 'steady';
  let multiplier = 1.0;
  let streak = 0;

  if (excellentGames >= 3) {
    status = 'fire';
    multiplier = 1.15;
    streak = excellentGames;
  } else if (excellentGames >= 2) {
    status = 'hot';
    multiplier = 1.10;
    streak = excellentGames;
  } else if (poorGames >= 3) {
    status = 'frozen';
    multiplier = 0.85;
    streak = -poorGames;
  } else if (poorGames >= 2) {
    status = 'cold';
    multiplier = 0.90;
    streak = -poorGames;
  }

  return {
    status,
    streak,
    last_5_avg: parseFloat(avgPoints.toFixed(2)),
    multiplier,
    games_played: performances.length
  };
}

/**
 * Update player form in database
 */
export async function updatePlayerForm(
  playerId: string,
  formData: FormData
): Promise<void> {
  const sql = neon(process.env.NEON_DATABASE_URL!);

  await sql`
    UPDATE fantasy_players
    SET 
      form_status = ${formData.status},
      form_streak = ${formData.streak},
      last_5_games_avg = ${formData.last_5_avg},
      form_multiplier = ${formData.multiplier},
      games_played = ${formData.games_played}
    WHERE real_player_id = ${playerId}
  `;
}

/**
 * Calculate and update form for a single player
 */
export async function trackPlayerForm(playerId: string): Promise<FormData> {
  // Get last 5 performances
  const performances = await getLastNPerformances(playerId, 5);

  // Calculate form
  const formData = calculateFormStatus(performances);

  // Update database
  await updatePlayerForm(playerId, formData);

  return formData;
}

/**
 * Calculate and update form for all players in a league
 */
export async function trackAllPlayersForm(leagueId: string): Promise<number> {
  const sql = neon(process.env.NEON_DATABASE_URL!);

  // Get all players in league
  const players = await sql`
    SELECT DISTINCT real_player_id
    FROM fantasy_squad
    WHERE league_id = ${leagueId}
  `;

  let updatedCount = 0;

  for (const player of players) {
    try {
      await trackPlayerForm(player.real_player_id);
      updatedCount++;
    } catch (error) {
      console.error(`Failed to update form for player ${player.real_player_id}:`, error);
    }
  }

  return updatedCount;
}

/**
 * Get form emoji for display
 */
export function getFormEmoji(status: FormStatus): string {
  const emojiMap: Record<FormStatus, string> = {
    fire: '🔥',
    hot: '📈',
    steady: '➡️',
    cold: '📉',
    frozen: '❄️'
  };

  return emojiMap[status];
}

/**
 * Get form label for display
 */
export function getFormLabel(status: FormStatus): string {
  const labelMap: Record<FormStatus, string> = {
    fire: 'ON FIRE',
    hot: 'HOT',
    steady: 'STEADY',
    cold: 'COLD',
    frozen: 'FROZEN'
  };

  return labelMap[status];
}

/**
 * Get form color for UI
 */
export function getFormColor(status: FormStatus): string {
  const colorMap: Record<FormStatus, string> = {
    fire: 'text-red-500',
    hot: 'text-orange-500',
    steady: 'text-gray-500',
    cold: 'text-blue-400',
    frozen: 'text-blue-600'
  };

  return colorMap[status];
}
