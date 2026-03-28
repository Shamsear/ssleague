/**
 * Fantasy League - Power-Ups System
 * 
 * Implements four power-up chips that teams can use strategically:
 * 1. Triple Captain (1x per season): Captain gets 3x points instead of 2x
 * 2. Bench Boost (2x per season): Bench players earn points
 * 3. Free Hit (1x per season): Temporary lineup changes for one week
 * 4. Wildcard (2x per season): Unlimited transfers in one window
 * 
 * Power-Up Rules:
 * - Each power-up has limited uses per season
 * - Cannot use same power-up twice in same round
 * - Usage tracked in database
 * - Effects applied during points calculation
 */

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.FANTASY_DATABASE_URL || process.env.NEON_DATABASE_URL!);

export type PowerUpType = 'triple_captain' | 'bench_boost' | 'free_hit' | 'wildcard';

export interface PowerUpInventory {
  power_up_id: string;
  team_id: string;
  league_id: string;
  triple_captain_remaining: number;
  bench_boost_remaining: number;
  free_hit_remaining: number;
  wildcard_remaining: number;
  created_at: Date;
  updated_at: Date;
}

export interface PowerUpUsage {
  usage_id: string;
  team_id: string;
  league_id: string;
  round_id: string;
  power_up_type: PowerUpType;
  used_at: Date;
}

export interface ActivatePowerUpResult {
  success: boolean;
  message: string;
  usage_id?: string;
  remaining?: number;
}

/**
 * Get power-up inventory for a team
 */
export async function getPowerUpInventory(
  teamId: string,
  leagueId: string
): Promise<PowerUpInventory | null> {
  const results = await sql`
    SELECT *
    FROM fantasy_power_ups
    WHERE team_id = ${teamId}
    AND league_id = ${leagueId}
  `;

  if (results.length === 0) {
    return null;
  }

  const row = results[0];
  return {
    power_up_id: row.power_up_id,
    team_id: row.team_id,
    league_id: row.league_id,
    triple_captain_remaining: row.triple_captain_remaining,
    bench_boost_remaining: row.bench_boost_remaining,
    free_hit_remaining: row.free_hit_remaining,
    wildcard_remaining: row.wildcard_remaining,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at)
  };
}

/**
 * Initialize power-up inventory for a team
 */
export async function initializePowerUps(
  teamId: string,
  leagueId: string
): Promise<PowerUpInventory> {
  const powerUpId = `pu_${teamId}_${Date.now()}`;

  await sql`
    INSERT INTO fantasy_power_ups (
      power_up_id,
      team_id,
      league_id,
      triple_captain_remaining,
      bench_boost_remaining,
      free_hit_remaining,
      wildcard_remaining
    ) VALUES (
      ${powerUpId},
      ${teamId},
      ${leagueId},
      1,
      2,
      1,
      2
    )
    ON CONFLICT (team_id, league_id) DO NOTHING
  `;

  const inventory = await getPowerUpInventory(teamId, leagueId);
  if (!inventory) {
    throw new Error('Failed to initialize power-ups');
  }

  return inventory;
}

/**
 * Check if a power-up is available for use
 */
export async function isPowerUpAvailable(
  teamId: string,
  leagueId: string,
  powerUpType: PowerUpType
): Promise<boolean> {
  const inventory = await getPowerUpInventory(teamId, leagueId);
  
  if (!inventory) {
    return false;
  }

  const fieldMap: Record<PowerUpType, keyof PowerUpInventory> = {
    triple_captain: 'triple_captain_remaining',
    bench_boost: 'bench_boost_remaining',
    free_hit: 'free_hit_remaining',
    wildcard: 'wildcard_remaining'
  };

  const field = fieldMap[powerUpType];
  return (inventory[field] as number) > 0;
}

/**
 * Check if a power-up is already active for a round
 */
export async function isPowerUpActive(
  teamId: string,
  powerUpType: PowerUpType,
  roundId: string
): Promise<boolean> {
  const results = await sql`
    SELECT usage_id
    FROM fantasy_power_up_usage
    WHERE team_id = ${teamId}
    AND power_up_type = ${powerUpType}
    AND round_id = ${roundId}
  `;

  return results.length > 0;
}

/**
 * Activate a power-up for a specific round
 */
export async function activatePowerUp(
  teamId: string,
  leagueId: string,
  roundId: string,
  powerUpType: PowerUpType
): Promise<ActivatePowerUpResult> {
  // Check if already active for this round (check this FIRST)
  const alreadyActive = await isPowerUpActive(teamId, powerUpType, roundId);
  if (alreadyActive) {
    return {
      success: false,
      message: `${powerUpType.replace('_', ' ')} already active for this round`
    };
  }

  // Check if power-up is available
  const available = await isPowerUpAvailable(teamId, leagueId, powerUpType);
  if (!available) {
    return {
      success: false,
      message: `No ${powerUpType.replace('_', ' ')} remaining`
    };
  }

  // Create usage record
  const usageId = `usage_${teamId}_${powerUpType}_${roundId}_${Date.now()}`;
  
  await sql`
    INSERT INTO fantasy_power_up_usage (
      usage_id,
      team_id,
      league_id,
      round_id,
      power_up_type,
      used_at
    ) VALUES (
      ${usageId},
      ${teamId},
      ${leagueId},
      ${roundId},
      ${powerUpType},
      NOW()
    )
  `;

  // Decrement inventory
  const fieldMap: Record<PowerUpType, keyof PowerUpInventory> = {
    triple_captain: 'triple_captain_remaining',
    bench_boost: 'bench_boost_remaining',
    free_hit: 'free_hit_remaining',
    wildcard: 'wildcard_remaining'
  };

  // Get current inventory
  const currentInventory = await getPowerUpInventory(teamId, leagueId);
  if (!currentInventory) {
    throw new Error('Power-up inventory not found');
  }

  const field = fieldMap[powerUpType];
  const currentValue = currentInventory[field] as number;
  const newValue = currentValue - 1;

  // Update with new value
  if (powerUpType === 'triple_captain') {
    await sql`UPDATE fantasy_power_ups SET triple_captain_remaining = ${newValue}, updated_at = NOW() WHERE team_id = ${teamId} AND league_id = ${leagueId}`;
  } else if (powerUpType === 'bench_boost') {
    await sql`UPDATE fantasy_power_ups SET bench_boost_remaining = ${newValue}, updated_at = NOW() WHERE team_id = ${teamId} AND league_id = ${leagueId}`;
  } else if (powerUpType === 'free_hit') {
    await sql`UPDATE fantasy_power_ups SET free_hit_remaining = ${newValue}, updated_at = NOW() WHERE team_id = ${teamId} AND league_id = ${leagueId}`;
  } else if (powerUpType === 'wildcard') {
    await sql`UPDATE fantasy_power_ups SET wildcard_remaining = ${newValue}, updated_at = NOW() WHERE team_id = ${teamId} AND league_id = ${leagueId}`;
  }

  // Get remaining count
  const inventory = await getPowerUpInventory(teamId, leagueId);
  const remaining = inventory ? (inventory[field] as number) : 0;

  return {
    success: true,
    message: `${powerUpType.replace('_', ' ')} activated successfully`,
    usage_id: usageId,
    remaining
  };
}

/**
 * Deactivate a power-up (cancel before round starts)
 */
export async function deactivatePowerUp(
  teamId: string,
  leagueId: string,
  roundId: string,
  powerUpType: PowerUpType
): Promise<ActivatePowerUpResult> {
  // Check if power-up is active
  const active = await isPowerUpActive(teamId, powerUpType, roundId);
  if (!active) {
    return {
      success: false,
      message: `${powerUpType.replace('_', ' ')} is not active for this round`
    };
  }

  // Delete usage record
  await sql`
    DELETE FROM fantasy_power_up_usage
    WHERE team_id = ${teamId}
    AND round_id = ${roundId}
    AND power_up_type = ${powerUpType}
  `;

  // Increment inventory
  const fieldMap: Record<PowerUpType, keyof PowerUpInventory> = {
    triple_captain: 'triple_captain_remaining',
    bench_boost: 'bench_boost_remaining',
    free_hit: 'free_hit_remaining',
    wildcard: 'wildcard_remaining'
  };

  // Get current inventory
  const currentInventory = await getPowerUpInventory(teamId, leagueId);
  if (!currentInventory) {
    throw new Error('Power-up inventory not found');
  }

  const field = fieldMap[powerUpType];
  const currentValue = currentInventory[field] as number;
  const newValue = currentValue + 1;

  // Update with new value
  if (powerUpType === 'triple_captain') {
    await sql`UPDATE fantasy_power_ups SET triple_captain_remaining = ${newValue}, updated_at = NOW() WHERE team_id = ${teamId} AND league_id = ${leagueId}`;
  } else if (powerUpType === 'bench_boost') {
    await sql`UPDATE fantasy_power_ups SET bench_boost_remaining = ${newValue}, updated_at = NOW() WHERE team_id = ${teamId} AND league_id = ${leagueId}`;
  } else if (powerUpType === 'free_hit') {
    await sql`UPDATE fantasy_power_ups SET free_hit_remaining = ${newValue}, updated_at = NOW() WHERE team_id = ${teamId} AND league_id = ${leagueId}`;
  } else if (powerUpType === 'wildcard') {
    await sql`UPDATE fantasy_power_ups SET wildcard_remaining = ${newValue}, updated_at = NOW() WHERE team_id = ${teamId} AND league_id = ${leagueId}`;
  }

  return {
    success: true,
    message: `${powerUpType.replace('_', ' ')} deactivated successfully`
  };
}

/**
 * Get all power-up usage for a team
 */
export async function getPowerUpUsageHistory(
  teamId: string,
  leagueId: string
): Promise<PowerUpUsage[]> {
  const results = await sql`
    SELECT *
    FROM fantasy_power_up_usage
    WHERE team_id = ${teamId}
    AND league_id = ${leagueId}
    ORDER BY used_at DESC
  `;

  return results.map(row => ({
    usage_id: row.usage_id,
    team_id: row.team_id,
    league_id: row.league_id,
    round_id: row.round_id,
    power_up_type: row.power_up_type as PowerUpType,
    used_at: new Date(row.used_at)
  }));
}

/**
 * Get active power-ups for a specific round
 */
export async function getActivePowerUps(
  teamId: string,
  roundId: string
): Promise<PowerUpType[]> {
  const results = await sql`
    SELECT power_up_type
    FROM fantasy_power_up_usage
    WHERE team_id = ${teamId}
    AND round_id = ${roundId}
  `;

  return results.map(row => row.power_up_type as PowerUpType);
}

/**
 * Get captain multiplier (considers Triple Captain power-up)
 */
export async function getCaptainMultiplier(
  teamId: string,
  roundId: string
): Promise<number> {
  const tripleCaptainActive = await isPowerUpActive(teamId, 'triple_captain', roundId);
  return tripleCaptainActive ? 3.0 : 2.0;
}

/**
 * Check if Bench Boost is active
 */
export async function isBenchBoostActive(
  teamId: string,
  roundId: string
): Promise<boolean> {
  return await isPowerUpActive(teamId, 'bench_boost', roundId);
}

/**
 * Check if Free Hit is active
 */
export async function isFreeHitActive(
  teamId: string,
  roundId: string
): Promise<boolean> {
  return await isPowerUpActive(teamId, 'free_hit', roundId);
}

/**
 * Check if Wildcard is active
 */
export async function isWildcardActive(
  teamId: string,
  roundId: string
): Promise<boolean> {
  return await isPowerUpActive(teamId, 'wildcard', roundId);
}

/**
 * Get power-up display name
 */
export function getPowerUpDisplayName(powerUpType: PowerUpType): string {
  const names: Record<PowerUpType, string> = {
    triple_captain: 'Triple Captain',
    bench_boost: 'Bench Boost',
    free_hit: 'Free Hit',
    wildcard: 'Wildcard'
  };
  return names[powerUpType];
}

/**
 * Get power-up description
 */
export function getPowerUpDescription(powerUpType: PowerUpType): string {
  const descriptions: Record<PowerUpType, string> = {
    triple_captain: 'Your captain scores 3x points instead of 2x for one round',
    bench_boost: 'Your bench players earn points for one round',
    free_hit: 'Make unlimited lineup changes for one round (reverts after)',
    wildcard: 'Make unlimited transfers during one transfer window'
  };
  return descriptions[powerUpType];
}

/**
 * Get power-up emoji
 */
export function getPowerUpEmoji(powerUpType: PowerUpType): string {
  const emojis: Record<PowerUpType, string> = {
    triple_captain: '⚡',
    bench_boost: '🔋',
    free_hit: '🎯',
    wildcard: '🃏'
  };
  return emojis[powerUpType];
}

/**
 * Validate power-up activation
 */
export async function validatePowerUpActivation(
  teamId: string,
  leagueId: string,
  roundId: string,
  powerUpType: PowerUpType
): Promise<{ valid: boolean; error?: string }> {
  // Check if already active (check this FIRST)
  const alreadyActive = await isPowerUpActive(teamId, powerUpType, roundId);
  if (alreadyActive) {
    return {
      valid: false,
      error: `${getPowerUpDisplayName(powerUpType)} is already active for this round`
    };
  }

  // Check if power-up is available
  const available = await isPowerUpAvailable(teamId, leagueId, powerUpType);
  if (!available) {
    return {
      valid: false,
      error: `You have no ${getPowerUpDisplayName(powerUpType)} remaining`
    };
  }

  // Check for conflicting power-ups
  if (powerUpType === 'triple_captain') {
    // Cannot use Triple Captain with Free Hit (lineup is temporary)
    const freeHitActive = await isFreeHitActive(teamId, roundId);
    if (freeHitActive) {
      return {
        valid: false,
        error: 'Cannot use Triple Captain with Free Hit active'
      };
    }
  }

  return { valid: true };
}

/**
 * Get all teams with active power-ups for a round
 */
export async function getTeamsWithActivePowerUps(
  leagueId: string,
  roundId: string
): Promise<Map<string, PowerUpType[]>> {
  const results = await sql`
    SELECT team_id, power_up_type
    FROM fantasy_power_up_usage
    WHERE league_id = ${leagueId}
    AND round_id = ${roundId}
  `;

  const map = new Map<string, PowerUpType[]>();
  
  for (const row of results) {
    const teamId = row.team_id;
    const powerUpType = row.power_up_type as PowerUpType;
    
    if (!map.has(teamId)) {
      map.set(teamId, []);
    }
    map.get(teamId)!.push(powerUpType);
  }

  return map;
}
