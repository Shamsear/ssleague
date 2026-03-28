/**
 * Tier Generation Algorithm
 * 
 * Divides players into N equal tiers based on performance (points).
 * Used for tiered draft system where teams bid on players tier-by-tier.
 */

import { fantasySql } from '@/lib/neon/fantasy-config';
import { tournamentSql } from '@/lib/neon/tournament-config';

export interface Player {
  real_player_id: string;
  player_name: string;
  position: string;
  real_team_name: string;
  total_points: number;
  games_played: number;
  avg_points_per_game: number;
}

export interface Tier {
  tier_id: string;
  tier_number: number;
  tier_name: string;
  players: Player[];
  player_count: number;
  min_points: number;
  max_points: number;
  avg_points: number;
}

export interface TierGenerationOptions {
  leagueId: string;
  numberOfTiers: number;
  draftType: 'initial' | 'transfer';
  minGamesPlayed?: number;
}

// Tier names for different tier numbers
const TIER_NAMES: Record<number, string[]> = {
  5: ['Elite', 'Stars', 'Quality', 'Solid', 'Prospects'],
  6: ['Elite', 'Premium', 'Stars', 'Quality', 'Solid', 'Prospects'],
  7: ['Elite', 'Premium', 'Stars', 'Quality', 'Solid', 'Reliable', 'Prospects'],
  8: ['Elite', 'Premium', 'Stars', 'Quality', 'Solid', 'Reliable', 'Prospects', 'Emerging'],
  9: ['Elite', 'Premium', 'Stars', 'Quality', 'Solid', 'Reliable', 'Prospects', 'Emerging', 'Depth'],
  10: ['Elite', 'Premium', 'Stars', 'Quality', 'Solid', 'Reliable', 'Prospects', 'Emerging', 'Depth', 'Reserve']
};

/**
 * Generate tiers for draft
 */
export async function generateDraftTiers(
  options: TierGenerationOptions
): Promise<Tier[]> {
  const { leagueId, numberOfTiers, draftType, minGamesPlayed = 1 } = options;

  console.log(`🎯 Generating ${numberOfTiers} tiers for league: ${leagueId}`);
  console.log(`   Draft type: ${draftType}`);
  console.log(`   Min games played: ${minGamesPlayed}`);

  // 1. Get available players sorted by points
  const players = await getAvailablePlayers(leagueId, draftType, minGamesPlayed);

  if (players.length === 0) {
    throw new Error('No available players found for tier generation');
  }

  console.log(`📊 Found ${players.length} available players`);

  // 2. Sort players by total points (descending)
  const sortedPlayers = sortPlayersByPoints(players);

  // 3. Divide into tiers
  const tiers = dividePlayersIntoTiers(sortedPlayers, numberOfTiers, leagueId, draftType);

  console.log(`✅ Generated ${tiers.length} tiers successfully`);
  
  // Log tier summary
  tiers.forEach(tier => {
    console.log(`   Tier ${tier.tier_number} (${tier.tier_name}): ${tier.player_count} players, ${tier.min_points}-${tier.max_points} pts (avg: ${tier.avg_points})`);
  });

  return tiers;
}

/**
 * Get available players for draft
 */
async function getAvailablePlayers(
  leagueId: string,
  draftType: 'initial' | 'transfer',
  minGamesPlayed: number
): Promise<Player[]> {
  // First, get the league's season_id from fantasy database
  const league = await fantasySql`
    SELECT season_id FROM fantasy_leagues WHERE league_id = ${leagueId} LIMIT 1
  `;
  
  if (!league || league.length === 0) {
    throw new Error(`League not found: ${leagueId}`);
  }
  
  const seasonId = league[0].season_id;
  
  if (!seasonId) {
    throw new Error(`League ${leagueId} does not have a season_id`);
  }
  
  if (!tournamentSql) {
    throw new Error('Tournament database not configured');
  }
  
  console.log(`   Using season_id: ${seasonId}`);
  
  // For initial draft: all players from player_seasons (tournament DB)
  // For transfer draft: only available (not owned) players
  
  if (draftType === 'initial') {
    // Get all players from player_seasons for this season
    const players = await tournamentSql<Player[]>`
      SELECT 
        ps.player_id as real_player_id,
        ps.player_name,
        COALESCE(ps.category, 'Unknown') as position,
        COALESCE(ps.team, 'Unknown') as real_team_name,
        COALESCE(ps.points, 0) as total_points,
        10 as games_played,
        CASE 
          WHEN 10 > 0 THEN ROUND(COALESCE(ps.points, 0)::numeric / 10, 2)
          ELSE 0
        END as avg_points_per_game
      FROM player_seasons ps
      WHERE ps.season_id = ${seasonId}
        AND ps.player_id IS NOT NULL
        AND ps.player_name IS NOT NULL
      ORDER BY COALESCE(ps.points, 0) DESC
    `;
    return players;
  } else {
    // For transfer draft, only get available players (not in fantasy_squad)
    // Need to query both databases
    const players = await tournamentSql<Player[]>`
      SELECT 
        ps.player_id as real_player_id,
        ps.player_name,
        COALESCE(ps.category, 'Unknown') as position,
        COALESCE(ps.team, 'Unknown') as real_team_name,
        COALESCE(ps.points, 0) as total_points,
        10 as games_played,
        CASE 
          WHEN 10 > 0 THEN ROUND(COALESCE(ps.points, 0)::numeric / 10, 2)
          ELSE 0
        END as avg_points_per_game
      FROM player_seasons ps
      WHERE ps.season_id = ${seasonId}
        AND ps.player_id IS NOT NULL
        AND ps.player_name IS NOT NULL
      ORDER BY COALESCE(ps.points, 0) DESC
    `;
    
    // Filter out players already in fantasy_squad
    const ownedPlayers = await fantasySql`
      SELECT DISTINCT real_player_id FROM fantasy_squad WHERE league_id = ${leagueId}
    `;
    const ownedPlayerIds = new Set(ownedPlayers.map((p: any) => p.real_player_id));
    
    return players.filter(p => !ownedPlayerIds.has(p.real_player_id));
  }
}

/**
 * Sort players by total points (descending)
 */
function sortPlayersByPoints(players: Player[]): Player[] {
  return [...players].sort((a, b) => {
    // Primary: total points (descending)
    if (b.total_points !== a.total_points) {
      return b.total_points - a.total_points;
    }
    
    // Secondary: avg points per game (descending)
    if (b.avg_points_per_game !== a.avg_points_per_game) {
      return b.avg_points_per_game - a.avg_points_per_game;
    }
    
    // Tertiary: alphabetical by name
    return a.player_name.localeCompare(b.player_name);
  });
}

/**
 * Divide players into N equal tiers
 */
function dividePlayersIntoTiers(
  sortedPlayers: Player[],
  numberOfTiers: number,
  leagueId: string,
  draftType: 'initial' | 'transfer'
): Tier[] {
  const totalPlayers = sortedPlayers.length;
  const basePlayersPerTier = Math.floor(totalPlayers / numberOfTiers);
  const remainder = totalPlayers % numberOfTiers;

  console.log(`   Base players per tier: ${basePlayersPerTier}`);
  console.log(`   Remainder: ${remainder}`);

  const tiers: Tier[] = [];
  let currentIndex = 0;

  for (let tierNumber = 1; tierNumber <= numberOfTiers; tierNumber++) {
    // Distribute remainder players to first tiers
    const playersInThisTier = basePlayersPerTier + (tierNumber <= remainder ? 1 : 0);
    
    // Extract players for this tier
    const tierPlayers = sortedPlayers.slice(currentIndex, currentIndex + playersInThisTier);
    
    // Calculate tier stats
    const tierStats = calculateTierStats(tierPlayers);
    
    // Get tier name
    const tierName = getTierName(tierNumber, numberOfTiers);
    
    // Create tier ID
    const tierId = `tier_${leagueId}_${draftType}_${tierNumber}_${Date.now()}`;
    
    const tier: Tier = {
      tier_id: tierId,
      tier_number: tierNumber,
      tier_name: tierName,
      players: tierPlayers,
      player_count: tierPlayers.length,
      min_points: tierStats.min,
      max_points: tierStats.max,
      avg_points: tierStats.avg
    };
    
    tiers.push(tier);
    currentIndex += playersInThisTier;
  }

  return tiers;
}

/**
 * Calculate tier statistics
 */
function calculateTierStats(players: Player[]): {
  min: number;
  max: number;
  avg: number;
} {
  if (players.length === 0) {
    return { min: 0, max: 0, avg: 0 };
  }

  const points = players.map(p => p.total_points);
  const min = Math.min(...points);
  const max = Math.max(...points);
  const sum = points.reduce((acc, p) => acc + p, 0);
  const avg = Math.round((sum / players.length) * 100) / 100; // Round to 2 decimals

  return { min, max, avg };
}

/**
 * Get tier name based on tier number
 */
function getTierName(tierNumber: number, totalTiers: number): string {
  const names = TIER_NAMES[totalTiers];
  
  if (!names) {
    // Fallback for unsupported tier counts
    return `Tier ${tierNumber}`;
  }
  
  return names[tierNumber - 1] || `Tier ${tierNumber}`;
}

/**
 * Save tiers to database
 */
export async function saveTiersToDatabase(
  leagueId: string,
  tiers: Tier[],
  draftType: 'initial' | 'transfer' = 'initial'
): Promise<void> {
  console.log(`💾 Saving ${tiers.length} tiers to database...`);

  for (const tier of tiers) {
    // Convert players array to JSONB (just IDs)
    const playerIds = tier.players.map(p => p.real_player_id);

    await fantasySql`
      INSERT INTO fantasy_draft_tiers (
        tier_id, league_id, draft_type, tier_number, tier_name,
        player_ids, player_count, min_points, max_points, avg_points
      ) VALUES (
        ${tier.tier_id},
        ${leagueId},
        ${draftType},
        ${tier.tier_number},
        ${tier.tier_name},
        ${JSON.stringify(playerIds)},
        ${tier.player_count},
        ${tier.min_points},
        ${tier.max_points},
        ${tier.avg_points}
      )
      ON CONFLICT (league_id, draft_type, tier_number)
      DO UPDATE SET
        tier_id = EXCLUDED.tier_id,
        tier_name = EXCLUDED.tier_name,
        player_ids = EXCLUDED.player_ids,
        player_count = EXCLUDED.player_count,
        min_points = EXCLUDED.min_points,
        max_points = EXCLUDED.max_points,
        avg_points = EXCLUDED.avg_points,
        created_at = NOW()
    `;
  }

  console.log(`✅ All tiers saved to database`);
}

/**
 * Get tiers from database
 */
export async function getTiersFromDatabase(
  leagueId: string,
  draftType: 'initial' | 'transfer',
  tierNumber?: number
): Promise<Tier[]> {
  let dbTiers;
  
  if (tierNumber !== undefined) {
    // Fetch specific tier
    dbTiers = await fantasySql<any[]>`
      SELECT 
        tier_id, tier_number, tier_name,
        player_ids, player_count,
        min_points, max_points, avg_points
      FROM fantasy_draft_tiers
      WHERE league_id = ${leagueId}
        AND draft_type = ${draftType}
        AND tier_number = ${tierNumber}
      ORDER BY tier_number ASC
    `;
  } else {
    // Fetch all tiers
    dbTiers = await fantasySql<any[]>`
      SELECT 
        tier_id, tier_number, tier_name,
        player_ids, player_count,
        min_points, max_points, avg_points
      FROM fantasy_draft_tiers
      WHERE league_id = ${leagueId}
        AND draft_type = ${draftType}
      ORDER BY tier_number ASC
    `;
  }

  // Fetch player details for each tier
  const tiers: Tier[] = [];

  for (const dbTier of dbTiers) {
    const playerIds = dbTier.player_ids as string[];
    
    // Get player details
    const players = await fantasySql<Player[]>`
      SELECT 
        real_player_id, player_name, position, real_team_name,
        total_points, games_played,
        CASE 
          WHEN games_played > 0 THEN ROUND(total_points::numeric / games_played, 2)
          ELSE 0
        END as avg_points_per_game
      FROM fantasy_players
      WHERE league_id = ${leagueId}
        AND real_player_id = ANY(${playerIds})
      ORDER BY total_points DESC
    `;

    tiers.push({
      tier_id: dbTier.tier_id,
      tier_number: dbTier.tier_number,
      tier_name: dbTier.tier_name,
      players,
      player_count: dbTier.player_count,
      min_points: dbTier.min_points,
      max_points: dbTier.max_points,
      avg_points: parseFloat(dbTier.avg_points)
    });
  }

  return tiers;
}

/**
 * Delete tiers from database
 */
export async function deleteTiersFromDatabase(
  leagueId: string,
  draftType: 'initial' | 'transfer'
): Promise<void> {
  await fantasySql`
    DELETE FROM fantasy_draft_tiers
    WHERE league_id = ${leagueId}
      AND draft_type = ${draftType}
  `;
  
  console.log(`🗑️  Deleted tiers for league ${leagueId} (${draftType})`);
}
