/**
 * Fantasy League - Auto-Sub Feature
 * 
 * Automatically substitutes bench players when starting players don't play (DNP).
 * Uses bench priority order configured by team.
 * 
 * Auto-Sub Rules:
 * - Only triggers if starter has 0 points AND didn't play
 * - Uses bench priority order (first available bench player)
 * - Substituted player earns points (no multipliers)
 * - Records substitution for transparency
 * - Can be enabled/disabled per team
 */

import { neon } from '@neondatabase/serverless';

export interface AutoSubstitution {
  lineup_id: string;
  starter_out: string;
  bench_in: string;
  reason: string;
  points_earned: number;
  substituted_at: Date;
}

export interface PlayerPerformance {
  player_id: string;
  points: number;
  did_not_play: boolean;
}

export interface LineupWithPlayers {
  lineup_id: string;
  team_id: string;
  league_id: string;
  round_id: string;
  starting_players: string[];
  bench_players: string[];
  captain_id: string;
  vice_captain_id: string;
  auto_sub_enabled: boolean;
  bench_priority: string[];
}

/**
 * Check if a player did not play (DNP)
 */
export function isPlayerDNP(performance: PlayerPerformance): boolean {
  return performance.did_not_play || performance.points === 0;
}

/**
 * Get bench priority order for a team
 */
async function getBenchPriority(teamId: string): Promise<string[]> {
  const sql = neon(process.env.NEON_DATABASE_URL!);

  const result = await sql`
    SELECT bench_priority
    FROM fantasy_teams
    WHERE team_id = ${teamId}
  `;

  if (result.length === 0 || !result[0].bench_priority) {
    return [];
  }

  return result[0].bench_priority as string[];
}

/**
 * Get player performance for a round
 */
async function getPlayerPerformance(
  playerId: string,
  roundId: string
): Promise<PlayerPerformance> {
  const sql = neon(process.env.NEON_DATABASE_URL!);

  const result = await sql`
    SELECT 
      real_player_id as player_id,
      points,
      COALESCE(did_not_play, false) as did_not_play
    FROM fantasy_player_points
    WHERE real_player_id = ${playerId}
    AND round_id = ${roundId}
  `;

  if (result.length === 0) {
    return {
      player_id: playerId,
      points: 0,
      did_not_play: true
    };
  }

  return {
    player_id: result[0].player_id,
    points: parseFloat(result[0].points.toString()),
    did_not_play: result[0].did_not_play
  };
}

/**
 * Find first available bench player to substitute
 */
function findSubstitute(
  benchPlayers: string[],
  benchPriority: string[],
  alreadySubbed: Set<string>
): string | null {
  // If bench priority is set, use it
  if (benchPriority.length > 0) {
    for (const playerId of benchPriority) {
      if (benchPlayers.includes(playerId) && !alreadySubbed.has(playerId)) {
        return playerId;
      }
    }
  }

  // Otherwise, use bench order
  for (const playerId of benchPlayers) {
    if (!alreadySubbed.has(playerId)) {
      return playerId;
    }
  }

  return null;
}

/**
 * Record auto-substitution in database
 */
async function recordSubstitution(
  lineupId: string,
  starterOut: string,
  benchIn: string,
  reason: string,
  pointsEarned: number
): Promise<void> {
  const sql = neon(process.env.NEON_DATABASE_URL!);

  await sql`
    INSERT INTO fantasy_auto_subs (
      lineup_id,
      starter_out,
      bench_in,
      reason,
      points_earned,
      substituted_at
    ) VALUES (
      ${lineupId},
      ${starterOut},
      ${benchIn},
      ${reason},
      ${pointsEarned},
      NOW()
    )
  `;
}

/**
 * Process auto-substitutions for a lineup
 */
export async function processAutoSubs(
  lineup: LineupWithPlayers,
  roundId: string
): Promise<AutoSubstitution[]> {
  const substitutions: AutoSubstitution[] = [];

  // Check if auto-sub is enabled
  if (!lineup.auto_sub_enabled) {
    return substitutions;
  }

  // Get bench priority
  const benchPriority = lineup.bench_priority || [];

  // Track which bench players have been used
  const usedBenchPlayers = new Set<string>();

  // Check each starting player
  for (const starterId of lineup.starting_players) {
    // Skip captain and vice-captain (they should always play)
    if (starterId === lineup.captain_id || starterId === lineup.vice_captain_id) {
      continue;
    }

    // Get player performance
    const performance = await getPlayerPerformance(starterId, roundId);

    // Check if player didn't play
    if (isPlayerDNP(performance)) {
      // Find substitute
      const substituteId = findSubstitute(
        lineup.bench_players,
        benchPriority,
        usedBenchPlayers
      );

      if (substituteId) {
        // Get substitute performance
        const subPerformance = await getPlayerPerformance(substituteId, roundId);

        // Record substitution
        const substitution: AutoSubstitution = {
          lineup_id: lineup.lineup_id,
          starter_out: starterId,
          bench_in: substituteId,
          reason: 'Did not play',
          points_earned: subPerformance.points,
          substituted_at: new Date()
        };

        substitutions.push(substitution);
        usedBenchPlayers.add(substituteId);

        // Record in database
        await recordSubstitution(
          lineup.lineup_id,
          starterId,
          substituteId,
          'Did not play',
          subPerformance.points
        );
      }
    }
  }

  return substitutions;
}

/**
 * Calculate lineup points with auto-subs
 */
export async function calculateLineupPointsWithAutoSubs(
  lineup: LineupWithPlayers,
  roundId: string
): Promise<number> {
  let totalPoints = 0;

  // Process auto-subs first
  const substitutions = await processAutoSubs(lineup, roundId);

  // Create map of substitutions
  const subMap = new Map<string, string>();
  for (const sub of substitutions) {
    subMap.set(sub.starter_out, sub.bench_in);
  }

  // Calculate points for each starting position
  for (const starterId of lineup.starting_players) {
    // Check if this player was substituted
    const actualPlayerId = subMap.get(starterId) || starterId;

    // Get performance
    const performance = await getPlayerPerformance(actualPlayerId, roundId);

    // Apply multipliers
    let multiplier = 1.0;
    if (starterId === lineup.captain_id) {
      multiplier = 2.0;
    } else if (starterId === lineup.vice_captain_id) {
      multiplier = 1.5;
    }

    // Note: Substitutes don't get captain/VC multipliers
    if (subMap.has(starterId)) {
      multiplier = 1.0;
    }

    totalPoints += performance.points * multiplier;
  }

  return totalPoints;
}

/**
 * Get auto-substitutions for a lineup
 */
export async function getAutoSubstitutions(
  lineupId: string
): Promise<AutoSubstitution[]> {
  const sql = neon(process.env.NEON_DATABASE_URL!);

  const results = await sql`
    SELECT *
    FROM fantasy_auto_subs
    WHERE lineup_id = ${lineupId}
    ORDER BY substituted_at ASC
  `;

  return results.map(row => ({
    lineup_id: row.lineup_id,
    starter_out: row.starter_out,
    bench_in: row.bench_in,
    reason: row.reason,
    points_earned: parseFloat(row.points_earned.toString()),
    substituted_at: new Date(row.substituted_at)
  }));
}

/**
 * Enable/disable auto-sub for a team
 */
export async function setAutoSubEnabled(
  teamId: string,
  enabled: boolean
): Promise<void> {
  const sql = neon(process.env.NEON_DATABASE_URL!);

  await sql`
    UPDATE fantasy_teams
    SET auto_sub_enabled = ${enabled}
    WHERE team_id = ${teamId}
  `;
}

/**
 * Set bench priority order for a team
 */
export async function setBenchPriority(
  teamId: string,
  priority: string[]
): Promise<void> {
  const sql = neon(process.env.NEON_DATABASE_URL!);

  await sql`
    UPDATE fantasy_teams
    SET bench_priority = ${JSON.stringify(priority)}::jsonb
    WHERE team_id = ${teamId}
  `;
}

/**
 * Get auto-sub settings for a team
 */
export async function getAutoSubSettings(teamId: string): Promise<{
  enabled: boolean;
  bench_priority: string[];
}> {
  const sql = neon(process.env.NEON_DATABASE_URL!);

  const result = await sql`
    SELECT 
      auto_sub_enabled,
      bench_priority
    FROM fantasy_teams
    WHERE team_id = ${teamId}
  `;

  if (result.length === 0) {
    return {
      enabled: true,
      bench_priority: []
    };
  }

  return {
    enabled: result[0].auto_sub_enabled ?? true,
    bench_priority: (result[0].bench_priority as string[]) || []
  };
}
