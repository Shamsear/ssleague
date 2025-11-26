/**
 * Player Transfer System V2 - Enhanced Transfer and Swap System
 * 
 * This module implements the enhanced transfer system with:
 * - Transfer limits (2 per team per season)
 * - Committee fees (10% for transfers, fixed for swaps)
 * - Star-based value increases
 * - Automatic player upgrades
 * - Comprehensive transaction logging
 * 
 * Requirements: 2.1-2.7, 3.1-3.8, 4.1-4.6, 5.1-5.5
 */

import { getTournamentDb } from '@/lib/neon/tournament-config';
import { getAuctionDb } from '@/lib/neon/auction-config';
import { adminDb } from './firebase/admin';
import admin from 'firebase-admin';
import { 
  calculateTransferDetails,
  TransferCalculation,
  calculateSwapDetails,
  SwapCalculation
} from './player-transfers-v2-utils';
import {
  validateTransferLimit,
  validateMultipleTeamLimits
} from './transfer-limits';
import {
  logTransferPayment,
  logTransferCompensation
} from './transaction-logger';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export type PlayerType = 'real' | 'football';

/**
 * Custom error class for multi-season transfer operations
 * 
 * Error codes:
 * - FUTURE_SEASON_MISMATCH: Future season has different team than current
 * - BUDGET_FIELD_MISSING: Required budget field not found in team_seasons
 * - PARTIAL_UPDATE_FAILURE: Some seasons updated, others failed
 * - BUDGET_VALIDATION_FAILED: Budget would go negative
 * - SEASON_GAP_DETECTED: Non-sequential season IDs found
 */
export class MultiseasonTransferError extends Error {
  constructor(
    public code: string,
    message: string,
    public affectedSeasons?: string[]
  ) {
    super(message);
    this.name = 'MultiseasonTransferError';
  }
}

/**
 * Player data from Neon database
 */
export interface PlayerData {
  id: string;
  player_id: string;
  player_name: string;
  team_id: string;
  team_name?: string;
  auction_value: number;
  star_rating: number;
  points: number;
  salary_per_match?: number;
  season_id: string;
  type: PlayerType;
}

/**
 * Transfer operation result
 */
export interface TransferResult {
  success: boolean;
  message: string;
  calculation?: TransferCalculation;
  transactionId?: string;
  error?: string;
  errorCode?: string;
}

/**
 * Transfer request parameters
 */
export interface TransferRequest {
  playerId: string;
  playerType: PlayerType;
  newTeamId: string;
  seasonId: string;
  transferredBy: string;
  transferredByName: string;
}

/**
 * Swap operation result
 */
export interface SwapResult {
  success: boolean;
  message: string;
  calculation?: SwapCalculation;
  transactionId?: string;
  error?: string;
  errorCode?: string;
}

/**
 * Swap request parameters
 */
export interface SwapRequest {
  playerAId: string;
  playerAType: PlayerType;
  playerBId: string;
  playerBType: PlayerType;
  cashAmount?: number;
  cashDirection?: 'A_to_B' | 'B_to_A' | 'none';
  seasonId: string;
  swappedBy: string;
  swappedByName: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get the appropriate database SQL client based on player type
 */
function getPlayerDb(playerType: PlayerType) {
  return playerType === 'real' ? getTournamentDb() : getAuctionDb();
}

/**
 * Get the appropriate table name based on player type
 */
function getTableName(playerType: PlayerType): string {
  return playerType === 'real' ? 'player_seasons' : 'footballplayers';
}

/**
 * Fetch player data from Neon database
 */
async function fetchPlayerData(
  playerId: string,
  playerType: PlayerType,
  seasonId: string
): Promise<PlayerData | null> {
  try {
    const sql = getPlayerDb(playerType);
    const tableName = getTableName(playerType);
    
    let query: string;
    let result: any[];
    
    if (playerType === 'real') {
      // Query player_seasons table
      query = `
        SELECT 
          id,
          player_id,
          player_name,
          team_id,
          team_id as team_name,
          auction_value,
          star_rating,
          points,
          salary_per_match,
          season_id
        FROM player_seasons
        WHERE player_id = $1 AND season_id = $2
      `;
      result = await sql.query(query, [playerId, seasonId]);
    } else {
      // Query footballplayers table
      query = `
        SELECT 
          id,
          player_id,
          name as player_name,
          team_id,
          team_id as team_name,
          auction_value,
          star_rating,
          points,
          salary_per_match,
          season_id
        FROM footballplayers
        WHERE player_id = $1 AND season_id = $2
      `;
      result = await sql.query(query, [playerId, seasonId]);
    }
    
    if (result.length === 0) {
      return null;
    }
    
    const row = result[0];
    return {
      id: row.id,
      player_id: row.player_id,
      player_name: row.player_name,
      team_id: row.team_id,
      team_name: row.team_name,
      auction_value: parseFloat(row.auction_value),
      star_rating: parseInt(row.star_rating) || 5,
      points: parseInt(row.points) || 180,
      salary_per_match: row.salary_per_match ? parseFloat(row.salary_per_match) : undefined,
      season_id: row.season_id,
      type: playerType
    };
    
  } catch (error) {
    console.error('Error fetching player data:', error);
    throw new Error(`Failed to fetch player data: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Parse season ID to extract season number
 * @example parseSeasonNumber("SSPSLS16") => 16
 */
function parseSeasonNumber(seasonId: string): number {
  const match = seasonId.match(/\d+$/);
  if (!match) {
    throw new Error(`Invalid season ID format: ${seasonId}`);
  }
  return parseInt(match[0], 10);
}

/**
 * Fetch future season contracts for a player
 * 
 * This function identifies all future season contracts for a player where:
 * - The season number is greater than the current season
 * - The team_id matches the current season's team (validation)
 * 
 * @param playerId - Player ID to search for
 * @param playerType - Type of player ('real' or 'football')
 * @param currentSeasonId - Current season ID (e.g., "SSPSLS16")
 * @param currentTeamId - Current team ID to validate against
 * @returns Array of PlayerData for future seasons
 * @throws Error if future season has mismatched team_id
 * 
 * @example
 * // Player with S16 and S17 contracts on same team
 * const futures = await fetchFutureSeasonContracts('SSPSPL0001', 'real', 'SSPSLS16', 'SSPSLT0001');
 * // Returns: [{ season_id: 'SSPSLS17', team_id: 'SSPSLT0001', ... }]
 */
export async function fetchFutureSeasonContracts(
  playerId: string,
  playerType: PlayerType,
  currentSeasonId: string,
  currentTeamId: string
): Promise<PlayerData[]> {
  try {
    console.log(`🔍 Checking for future season contracts for player ${playerId}...`);
    
    // Parse current season number
    const currentSeasonNumber = parseSeasonNumber(currentSeasonId);
    console.log(`   Current season number: ${currentSeasonNumber}`);
    
    const sql = getPlayerDb(playerType);
    const tableName = getTableName(playerType);
    
    let query: string;
    let result: any[];
    
    if (playerType === 'real') {
      // Query player_seasons table for future seasons
      query = `
        SELECT 
          id,
          player_id,
          player_name,
          team_id,
          team_id as team_name,
          auction_value,
          star_rating,
          points,
          salary_per_match,
          season_id
        FROM player_seasons
        WHERE player_id = $1
        ORDER BY season_id
      `;
      result = await sql.query(query, [playerId]);
    } else {
      // Query footballplayers table for future seasons
      query = `
        SELECT 
          id,
          player_id,
          name as player_name,
          team_id,
          team_id as team_name,
          auction_value,
          star_rating,
          points,
          salary_per_match,
          season_id
        FROM footballplayers
        WHERE player_id = $1
        ORDER BY season_id
      `;
      result = await sql.query(query, [playerId]);
    }
    
    // Filter for future seasons and validate team consistency
    const futureContracts: PlayerData[] = [];
    const mismatchedSeasons: string[] = [];
    
    for (const row of result) {
      const seasonNumber = parseSeasonNumber(row.season_id);
      
      // Only include seasons greater than current
      if (seasonNumber > currentSeasonNumber) {
        // Validate team_id matches current team
        if (row.team_id !== currentTeamId) {
          mismatchedSeasons.push(
            `Season ${row.season_id} has team ${row.team_id} (expected ${currentTeamId})`
          );
        }
        
        futureContracts.push({
          id: row.id,
          player_id: row.player_id,
          player_name: row.player_name,
          team_id: row.team_id,
          team_name: row.team_name,
          auction_value: parseFloat(row.auction_value),
          star_rating: parseInt(row.star_rating) || 5,
          points: parseInt(row.points) || 180,
          salary_per_match: row.salary_per_match ? parseFloat(row.salary_per_match) : undefined,
          season_id: row.season_id,
          type: playerType
        });
      }
    }
    
    // Throw error if mismatched teams found
    if (mismatchedSeasons.length > 0) {
      const affectedSeasonIds = futureContracts.map(c => c.season_id);
      const errorMessage = `Future season team mismatch detected for player ${playerId}:\n${mismatchedSeasons.join('\n')}`;
      console.error(`❌ ${errorMessage}`);
      throw new MultiseasonTransferError(
        'FUTURE_SEASON_MISMATCH',
        errorMessage,
        affectedSeasonIds
      );
    }
    
    // Validate that future season IDs are sequential (no gaps)
    if (futureContracts.length > 0) {
      const seasonNumbers = futureContracts.map(c => parseSeasonNumber(c.season_id)).sort((a, b) => a - b);
      const gaps: string[] = [];
      const seasonIdPrefix = currentSeasonId.replace(/\d+$/, '');
      
      // Check gap between current season and first future season
      const firstFutureSeasonNumber = seasonNumbers[0];
      if (firstFutureSeasonNumber - currentSeasonNumber > 1) {
        const missingSeasons: string[] = [];
        for (let missing = currentSeasonNumber + 1; missing < firstFutureSeasonNumber; missing++) {
          missingSeasons.push(`${seasonIdPrefix}${missing}`);
        }
        gaps.push(`Gap detected between season ${currentSeasonNumber} and ${firstFutureSeasonNumber}: missing ${missingSeasons.join(', ')}`);
      }
      
      // Check gaps between consecutive future seasons
      for (let i = 0; i < seasonNumbers.length - 1; i++) {
        const current = seasonNumbers[i];
        const next = seasonNumbers[i + 1];
        
        // Check if there's a gap (difference > 1)
        if (next - current > 1) {
          const missingSeasons: string[] = [];
          
          for (let missing = current + 1; missing < next; missing++) {
            missingSeasons.push(`${seasonIdPrefix}${missing}`);
          }
          
          gaps.push(`Gap detected between season ${current} and ${next}: missing ${missingSeasons.join(', ')}`);
        }
      }
      
      if (gaps.length > 0) {
        const affectedSeasonIds = futureContracts.map(c => c.season_id);
        const errorMessage = `Non-sequential season contracts detected for player ${playerId}:\n${gaps.join('\n')}`;
        console.error(`❌ ${errorMessage}`);
        throw new MultiseasonTransferError(
          'SEASON_GAP_DETECTED',
          errorMessage,
          affectedSeasonIds
        );
      }
    }
    
    if (futureContracts.length > 0) {
      console.log(`✅ Found ${futureContracts.length} future season contract(s): ${futureContracts.map(c => c.season_id).join(', ')}`);
    } else {
      console.log(`   No future season contracts found`);
    }
    
    return futureContracts;
    
  } catch (error) {
    console.error('Error fetching future season contracts:', error);
    
    // Re-throw MultiseasonTransferError as-is to preserve error code and affected seasons
    if (error instanceof MultiseasonTransferError) {
      throw error;
    }
    
    // Wrap other errors in a generic error
    throw new Error(`Failed to fetch future season contracts: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Update player record in Neon database with multi-season support
 * 
 * This function updates the current season with full changes (team_id, value, star, points, salary)
 * and updates future seasons with ONLY team_id changes. All updates are performed within a
 * database transaction to ensure atomicity.
 * 
 * @param playerId - Player ID to update
 * @param playerType - Type of player ('real' or 'football')
 * @param currentSeasonId - Current season ID being transferred
 * @param currentSeasonUpdates - Full updates for current season
 * @param futureSeasonIds - Array of future season IDs to update (optional)
 * @returns Array of successfully updated season IDs
 * 
 * @example
 * // Update current season S16 and future season S17
 * const updated = await updatePlayerInNeon(
 *   'SSPSPL0001', 'real', 'SSPSLS16',
 *   { team_id: 'SSPSLT0002', auction_value: 281.25, star_rating: 6, points: 200, salary_per_match: 2.5 },
 *   ['SSPSLS17']
 * );
 * // Returns: ['SSPSLS16', 'SSPSLS17']
 */
async function updatePlayerInNeon(
  playerId: string,
  playerType: PlayerType,
  currentSeasonId: string,
  currentSeasonUpdates: {
    team_id: string;
    auction_value: number;
    star_rating: number;
    points: number;
    salary_per_match: number;
  },
  futureSeasonIds: string[] = []
): Promise<string[]> {
  const sql = getPlayerDb(playerType);
  const tableName = getTableName(playerType);
  const updatedSeasonIds: string[] = [];
  
  try {
    console.log(`📝 Updating player ${playerId} in ${tableName}...`);
    console.log(`   Current season: ${currentSeasonId}`);
    if (futureSeasonIds.length > 0) {
      console.log(`   Future seasons: ${futureSeasonIds.join(', ')}`);
    }
    
    // Begin transaction
    await sql.query('BEGIN');
    
    try {
      // Update current season with full changes
      const currentSeasonQuery = `
        UPDATE ${tableName}
        SET 
          team_id = $1,
          auction_value = $2,
          star_rating = $3,
          points = $4,
          salary_per_match = $5,
          updated_at = NOW()
        WHERE player_id = $6 AND season_id = $7
      `;
      
      await sql.query(currentSeasonQuery, [
        currentSeasonUpdates.team_id,
        Math.round(currentSeasonUpdates.auction_value), // Round to integer
        currentSeasonUpdates.star_rating,
        Math.round(currentSeasonUpdates.points), // Round to integer
        parseFloat(currentSeasonUpdates.salary_per_match.toFixed(2)), // Keep 2 decimals for salary
        playerId,
        currentSeasonId
      ]);
      
      updatedSeasonIds.push(currentSeasonId);
      console.log(`   ✅ Updated current season ${currentSeasonId} with full changes`);
      
      // Update future seasons with team_id only
      for (const futureSeasonId of futureSeasonIds) {
        const futureSeasonQuery = `
          UPDATE ${tableName}
          SET 
            team_id = $1,
            updated_at = NOW()
          WHERE player_id = $2 AND season_id = $3
        `;
        
        await sql.query(futureSeasonQuery, [
          currentSeasonUpdates.team_id,
          playerId,
          futureSeasonId
        ]);
        
        updatedSeasonIds.push(futureSeasonId);
        console.log(`   ✅ Updated future season ${futureSeasonId} with team_id only`);
      }
      
      // Commit transaction
      await sql.query('COMMIT');
      console.log(`✅ Successfully updated ${updatedSeasonIds.length} season(s) in transaction`);
      
      return updatedSeasonIds;
      
    } catch (error) {
      // Rollback transaction on error
      await sql.query('ROLLBACK');
      console.error('❌ Transaction rolled back due to error');
      throw error;
    }
    
  } catch (error) {
    console.error('Error updating player in Neon:', error);
    throw new Error(`Failed to update player: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get team balance from Firestore
 * 
 * This function retrieves the correct budget field based on player type.
 * It does NOT fall back to deprecated dollar_balance or euro_balance fields.
 * 
 * @param teamId - Team ID
 * @param seasonId - Season ID
 * @param playerType - Type of player ('real' or 'football')
 * @returns The team's budget for the specified player type
 * @throws Error if the required budget field is missing
 * 
 * @example
 * // Get real player budget
 * const budget = await getTeamBalance('SSPSLT0001', 'SSPSLS16', 'real');
 * 
 * // Get football player budget
 * const budget = await getTeamBalance('SSPSLT0001', 'SSPSLS16', 'football');
 */
async function getTeamBalance(teamId: string, seasonId: string, playerType: PlayerType = 'real'): Promise<number> {
  try {
    const teamSeasonId = `${teamId}_${seasonId}`;
    const teamSeasonRef = adminDb.collection('team_seasons').doc(teamSeasonId);
    const doc = await teamSeasonRef.get();
    
    if (!doc.exists) {
      throw new Error(`Team season document not found: ${teamSeasonId}`);
    }
    
    const data = doc.data();
    
    // Return the appropriate budget based on player type
    // Throw error if the required field is missing (no fallback to deprecated fields)
    if (playerType === 'real') {
      if (data?.real_player_budget === undefined) {
        throw new Error(
          `Team ${teamId} season ${seasonId} is missing required field 'real_player_budget'. ` +
          `The team_seasons document needs to be migrated to include budget tracking fields.`
        );
      }
      return data.real_player_budget;
    } else {
      if (data?.football_budget === undefined) {
        throw new Error(
          `Team ${teamId} season ${seasonId} is missing required field 'football_budget'. ` +
          `The team_seasons document needs to be migrated to include budget tracking fields.`
        );
      }
      return data.football_budget;
    }
    
  } catch (error) {
    console.error('Error getting team balance:', error);
    throw error; // Re-throw the original error to preserve the error message
  }
}

/**
 * Validate team budget for a transfer operation
 * 
 * This function validates that:
 * 1. The team has sufficient budget for the operation
 * 2. The budget update won't result in negative values
 * 3. The correct budget field exists based on player type
 * 
 * @param teamId - Team ID to validate
 * @param seasonId - Season ID
 * @param playerType - Type of player ('real' or 'football')
 * @param requiredAmount - Amount required for the operation
 * @param operationType - Type of operation ('transfer' or 'swap')
 * @param teamLabel - Label for error messages (e.g., 'Buying team', 'Team A')
 * @throws MultiseasonTransferError if validation fails
 * @returns The team's current budget
 * 
 * @example
 * // Validate buying team has sufficient budget for transfer
 * const budget = await validateTeamBudget(
 *   'SSPSLT0002', 'SSPSLS16', 'real', 309.38, 'transfer', 'Buying team'
 * );
 */
async function validateTeamBudget(
  teamId: string,
  seasonId: string,
  playerType: PlayerType,
  requiredAmount: number,
  operationType: 'transfer' | 'swap',
  teamLabel: string
): Promise<number> {
  try {
    console.log(`💵 Validating ${teamLabel} budget for ${playerType} player...`);
    
    // Get the current budget using the correct field
    const currentBudget = await getTeamBalance(teamId, seasonId, playerType);
    
    // Determine which budget field is being used for logging
    const budgetFieldName = playerType === 'real' ? 'real_player_budget' : 'football_budget';
    
    console.log(`   ${teamLabel} current ${budgetFieldName}: ${currentBudget.toFixed(2)}`);
    console.log(`   Required amount: ${requiredAmount.toFixed(2)}`);
    
    // Validate sufficient funds
    if (currentBudget < requiredAmount) {
      const shortfall = requiredAmount - currentBudget;
      const errorMessage = 
        `${teamLabel} has insufficient ${playerType} player budget. ` +
        `Required: ${requiredAmount.toFixed(2)}, Available: ${currentBudget.toFixed(2)}, ` +
        `Shortfall: ${shortfall.toFixed(2)}`;
      
      console.error(`❌ ${errorMessage}`);
      
      throw new MultiseasonTransferError(
        'BUDGET_VALIDATION_FAILED',
        errorMessage
      );
    }
    
    // Validate that the update won't result in negative budget
    const projectedBudget = currentBudget - requiredAmount;
    if (projectedBudget < 0) {
      const errorMessage = 
        `${teamLabel} budget would become negative after ${operationType}. ` +
        `Current: ${currentBudget.toFixed(2)}, Required: ${requiredAmount.toFixed(2)}, ` +
        `Projected: ${projectedBudget.toFixed(2)}`;
      
      console.error(`❌ ${errorMessage}`);
      
      throw new MultiseasonTransferError(
        'BUDGET_VALIDATION_FAILED',
        errorMessage
      );
    }
    
    console.log(`   ✅ Budget validation passed. Projected balance: ${projectedBudget.toFixed(2)}`);
    
    return currentBudget;
    
  } catch (error) {
    // Re-throw MultiseasonTransferError as-is
    if (error instanceof MultiseasonTransferError) {
      throw error;
    }
    
    // Wrap other errors (like missing budget fields) in MultiseasonTransferError
    if (error instanceof Error && error.message.includes('missing required field')) {
      throw new MultiseasonTransferError(
        'BUDGET_FIELD_MISSING',
        error.message
      );
    }
    
    // Wrap any other errors
    throw new MultiseasonTransferError(
      'BUDGET_VALIDATION_FAILED',
      `Failed to validate team budget: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Update team budgets in Firestore with budget-specific fields
 * 
 * This function updates the correct budget fields based on player type:
 * - For real players: Updates real_player_budget and real_player_spent
 * - For football players: Updates football_budget and football_spent
 * - Does NOT update dollar_balance field
 * 
 * @param buyingTeamId - ID of the team acquiring the player
 * @param sellingTeamId - ID of the team releasing the player
 * @param seasonId - Season ID for the transfer
 * @param playerType - Type of player ('real' or 'football')
 * @param buyingTeamCost - Total cost to buying team (new_value + committee_fee)
 * @param newPlayerValue - New player value only (without fee)
 * @param sellingTeamCompensation - Amount selling team receives (new_value - committee_fee)
 * @param originalPlayerValue - Original auction value of the player
 * 
 * @example
 * // Real player transfer
 * await updateTeamBudgets(
 *   'SSPSLT0002', 'SSPSLT0001', 'SSPSLS16', 'real',
 *   309.38, 281.25, 253.13, 225
 * );
 * // Buying team: real_player_budget -= 309.38, real_player_spent += 281.25
 * // Selling team: real_player_budget += 253.13, real_player_spent -= 225
 */
async function updateTeamBudgets(
  buyingTeamId: string,
  sellingTeamId: string,
  seasonId: string,
  playerType: PlayerType,
  buyingTeamCost: number,
  newPlayerValue: number,
  sellingTeamCompensation: number,
  originalPlayerValue: number
): Promise<void> {
  try {
    console.log(`💰 Updating team budgets for ${playerType} player...`);
    
    const buyingTeamSeasonId = `${buyingTeamId}_${seasonId}`;
    const sellingTeamSeasonId = `${sellingTeamId}_${seasonId}`;
    
    const buyingTeamRef = adminDb.collection('team_seasons').doc(buyingTeamSeasonId);
    const sellingTeamRef = adminDb.collection('team_seasons').doc(sellingTeamSeasonId);
    
    // Verify documents exist
    const [buyingDoc, sellingDoc] = await Promise.all([
      buyingTeamRef.get(),
      sellingTeamRef.get()
    ]);
    
    if (!buyingDoc.exists) {
      throw new Error(`Buying team season document not found: ${buyingTeamSeasonId}`);
    }
    
    if (!sellingDoc.exists) {
      throw new Error(`Selling team season document not found: ${sellingTeamSeasonId}`);
    }
    
    // Determine which budget fields to use based on player type
    const budgetField = playerType === 'real' ? 'real_player_budget' : 'football_budget';
    const spentField = playerType === 'real' ? 'real_player_spent' : 'football_spent';
    
    console.log(`   Using fields: ${budgetField}, ${spentField}`);
    console.log(`   Buying team: -${buyingTeamCost} budget, +${newPlayerValue} spent`);
    console.log(`   Selling team: +${sellingTeamCompensation} budget, -${originalPlayerValue} spent`);
    
    // Update both teams' budgets atomically using FieldValue.increment()
    await Promise.all([
      buyingTeamRef.update({
        [budgetField]: admin.firestore.FieldValue.increment(-buyingTeamCost),
        [spentField]: admin.firestore.FieldValue.increment(newPlayerValue),
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      }),
      sellingTeamRef.update({
        [budgetField]: admin.firestore.FieldValue.increment(sellingTeamCompensation),
        [spentField]: admin.firestore.FieldValue.increment(-originalPlayerValue),
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      })
    ]);
    
    console.log(`✅ Team budgets updated successfully`);
    
  } catch (error) {
    console.error('Error updating team budgets:', error);
    throw new Error(`Failed to update team budgets: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * @deprecated Use updateTeamBudgets instead
 * Legacy function for backward compatibility - redirects to updateTeamBudgets
 */
async function updateTeamBalances(
  buyingTeamId: string,
  sellingTeamId: string,
  seasonId: string,
  buyingTeamAmount: number,
  sellingTeamAmount: number
): Promise<void> {
  console.warn('⚠️ updateTeamBalances is deprecated. Use updateTeamBudgets instead.');
  // This is kept for backward compatibility but should not be used
  // The function signature doesn't have enough information to determine player type
  throw new Error('updateTeamBalances is deprecated. Use updateTeamBudgets with playerType parameter.');
}

// ============================================================================
// ROLLBACK HELPER FUNCTIONS
// ============================================================================

/**
 * Rollback a single player season update
 * 
 * This helper function restores a player's original data for a specific season.
 * It's used during rollback operations when a multi-season transfer fails.
 * 
 * @param playerId - Player ID to rollback
 * @param playerType - Type of player ('real' or 'football')
 * @param seasonId - Season ID to rollback
 * @param originalData - Original player data to restore
 * @returns Promise that resolves when rollback is complete
 * 
 * @example
 * await rollbackPlayerUpdate('SSPSPL0001', 'real', 'SSPSLS16', originalPlayerData);
 */
async function rollbackPlayerUpdate(
  playerId: string,
  playerType: PlayerType,
  seasonId: string,
  originalData: PlayerData
): Promise<void> {
  try {
    console.log(`   🔄 Rolling back player ${playerId} season ${seasonId}...`);
    
    const sql = getPlayerDb(playerType);
    const tableName = getTableName(playerType);
    
    // Restore all original values for this season
    const query = `
      UPDATE ${tableName}
      SET 
        team_id = $1,
        auction_value = $2,
        star_rating = $3,
        points = $4,
        salary_per_match = $5,
        updated_at = NOW()
      WHERE player_id = $6 AND season_id = $7
    `;
    
    await sql.query(query, [
      originalData.team_id,
      Math.round(originalData.auction_value),
      originalData.star_rating,
      Math.round(originalData.points),
      originalData.salary_per_match ? parseFloat(originalData.salary_per_match.toFixed(2)) : 0,
      playerId,
      seasonId
    ]);
    
    console.log(`   ✅ Successfully rolled back season ${seasonId}`);
    
  } catch (error) {
    console.error(`   ❌ Failed to rollback season ${seasonId}:`, error);
    throw new Error(`Failed to rollback player update for season ${seasonId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Rollback budget updates for both teams
 * 
 * This helper function reverses budget changes made during a transfer.
 * It restores the original budget and spent values for both buying and selling teams.
 * 
 * @param buyingTeamId - ID of the team that acquired the player
 * @param sellingTeamId - ID of the team that released the player
 * @param seasonId - Season ID for the transfer
 * @param playerType - Type of player ('real' or 'football')
 * @param buyingTeamCost - Amount to reverse from buying team (will be added back)
 * @param newPlayerValue - New player value to reverse from buying team spent
 * @param sellingTeamCompensation - Amount to reverse from selling team (will be deducted)
 * @param originalPlayerValue - Original value to reverse from selling team spent
 * 
 * @example
 * await rollbackBudgetUpdates(
 *   'SSPSLT0002', 'SSPSLT0001', 'SSPSLS16', 'real',
 *   309.38, 281.25, 253.13, 225
 * );
 */
async function rollbackBudgetUpdates(
  buyingTeamId: string,
  sellingTeamId: string,
  seasonId: string,
  playerType: PlayerType,
  buyingTeamCost: number,
  newPlayerValue: number,
  sellingTeamCompensation: number,
  originalPlayerValue: number
): Promise<void> {
  try {
    console.log(`   🔄 Rolling back budget updates for ${playerType} player...`);
    
    const buyingTeamSeasonId = `${buyingTeamId}_${seasonId}`;
    const sellingTeamSeasonId = `${sellingTeamId}_${seasonId}`;
    
    const buyingTeamRef = adminDb.collection('team_seasons').doc(buyingTeamSeasonId);
    const sellingTeamRef = adminDb.collection('team_seasons').doc(sellingTeamSeasonId);
    
    // Determine which budget fields to use based on player type
    const budgetField = playerType === 'real' ? 'real_player_budget' : 'football_budget';
    const spentField = playerType === 'real' ? 'real_player_spent' : 'football_spent';
    
    console.log(`   Reversing budget changes using fields: ${budgetField}, ${spentField}`);
    console.log(`   Buying team: +${buyingTeamCost} budget, -${newPlayerValue} spent`);
    console.log(`   Selling team: -${sellingTeamCompensation} budget, +${originalPlayerValue} spent`);
    
    // Reverse the budget updates by applying opposite increments
    await Promise.all([
      buyingTeamRef.update({
        [budgetField]: admin.firestore.FieldValue.increment(buyingTeamCost), // Add back what was deducted
        [spentField]: admin.firestore.FieldValue.increment(-newPlayerValue), // Remove what was added
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      }),
      sellingTeamRef.update({
        [budgetField]: admin.firestore.FieldValue.increment(-sellingTeamCompensation), // Remove what was added
        [spentField]: admin.firestore.FieldValue.increment(originalPlayerValue), // Add back what was removed
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      })
    ]);
    
    console.log(`   ✅ Budget rollback successful`);
    
  } catch (error) {
    console.error(`   ❌ Failed to rollback budgets:`, error);
    throw new Error(`Failed to rollback budget updates: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Create transaction record in player_transactions collection
 * 
 * Enhanced to support multi-season transfer tracking and budget field logging.
 * 
 * @param seasonId - Primary season where transfer occurred
 * @param playerData - Player data being transferred
 * @param oldTeamId - Original team ID
 * @param newTeamId - New team ID
 * @param calculation - Transfer calculation details
 * @param transferredBy - User ID who processed the transfer
 * @param transferredByName - User name who processed the transfer
 * @param affectedSeasonIds - All season IDs affected by this transfer (current + future)
 * @param futureSeasonIds - Future season IDs only (empty array if single-season)
 * 
 * @example
 * // Single-season transfer
 * await createTransactionRecord(
 *   'SSPSLS16', playerData, 'SSPSLT0001', 'SSPSLT0002',
 *   calculation, 'admin', 'Admin User',
 *   ['SSPSLS16'], []
 * );
 * 
 * // Multi-season transfer
 * await createTransactionRecord(
 *   'SSPSLS16', playerData, 'SSPSLT0001', 'SSPSLT0002',
 *   calculation, 'admin', 'Admin User',
 *   ['SSPSLS16', 'SSPSLS17'], ['SSPSLS17']
 * );
 */
async function createTransactionRecord(
  seasonId: string,
  playerData: PlayerData,
  oldTeamId: string,
  newTeamId: string,
  calculation: TransferCalculation,
  transferredBy: string,
  transferredByName: string,
  affectedSeasonIds: string[] = [seasonId],
  futureSeasonIds: string[] = []
): Promise<string> {
  try {
    const transactionRef = adminDb.collection('player_transactions').doc();
    
    // Determine which budget fields were used based on player type
    const budgetFieldUsed = playerData.type === 'real' ? 'real_player_budget' : 'football_budget';
    const spentFieldUsed = playerData.type === 'real' ? 'real_player_spent' : 'football_spent';
    
    // Determine if this is a multi-season transfer
    const isMultiSeason = futureSeasonIds.length > 0;
    
    console.log(`   Transaction type: ${isMultiSeason ? 'Multi-season' : 'Single-season'}`);
    console.log(`   Affected seasons: ${affectedSeasonIds.join(', ')}`);
    console.log(`   Budget fields: ${budgetFieldUsed}, ${spentFieldUsed}`);
    
    await transactionRef.set({
      // Existing fields
      transaction_type: 'transfer',
      season_id: seasonId,
      player_id: playerData.player_id,
      player_name: playerData.player_name,
      player_type: playerData.type,
      old_team_id: oldTeamId,
      new_team_id: newTeamId,
      old_value: calculation.originalValue,
      new_value: calculation.newValue,
      committee_fee: calculation.committeeFee,
      buying_team_paid: calculation.buyingTeamPays,
      selling_team_received: calculation.sellingTeamReceives,
      old_star_rating: playerData.star_rating,
      new_star_rating: calculation.newStarRating,
      points_added: calculation.pointsAdded,
      new_salary: calculation.newSalary,
      processed_by: transferredBy,
      processed_by_name: transferredByName,
      
      // NEW: Multi-season tracking fields
      affected_season_ids: affectedSeasonIds,
      is_multi_season: isMultiSeason,
      future_seasons_updated: futureSeasonIds,
      
      // NEW: Budget field tracking
      budget_field_used: budgetFieldUsed,
      spent_field_used: spentFieldUsed,
      
      // Timestamps
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    });
    
    return transactionRef.id;
    
  } catch (error) {
    console.error('Error creating transaction record:', error);
    throw new Error(`Failed to create transaction record: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Create news entry for transfer
 */
async function createTransferNews(
  seasonId: string,
  playerData: PlayerData,
  oldTeamName: string,
  newTeamName: string,
  calculation: TransferCalculation
): Promise<void> {
  try {
    const newsRef = adminDb.collection('news').doc();
    
    const starUpgradeText = calculation.newStarRating > playerData.star_rating
      ? ` ${playerData.player_name}'s star rating has been upgraded from ${playerData.star_rating}⭐ to ${calculation.newStarRating}⭐.`
      : '';
    
    const content = `${playerData.player_name} has been transferred from ${oldTeamName} to ${newTeamName}. ` +
      `The player's new value is $${calculation.newValue.toFixed(2)} (increased from $${calculation.originalValue.toFixed(2)}). ` +
      `${newTeamName} paid $${calculation.buyingTeamPays.toFixed(2)} (including $${calculation.committeeFee.toFixed(2)} committee fee), ` +
      `while ${oldTeamName} received $${calculation.sellingTeamReceives.toFixed(2)}.${starUpgradeText}`;
    
    await newsRef.set({
      title: `Transfer: ${playerData.player_name} Joins ${newTeamName}`,
      content,
      season_id: seasonId,
      category: 'player_movement',
      is_published: true,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('✅ Transfer news created');
    
  } catch (error) {
    console.error('Error creating transfer news:', error);
    // Don't throw - news creation failure shouldn't block transfer
  }
}

// ============================================================================
// MAIN TRANSFER FUNCTION
// ============================================================================

/**
 * Execute a player transfer with committee fees and star upgrades
 * 
 * This function performs a complete transfer operation:
 * 1. Validates transfer limits for both teams
 * 2. Validates buying team has sufficient funds
 * 3. Calculates new value, fees, and upgrades
 * 4. Updates player record in Neon
 * 5. Updates team balances in Firestore
 * 6. Creates transaction records
 * 7. Logs financial transactions
 * 8. Creates news entry
 * 
 * All operations are performed with error handling and rollback support.
 * 
 * @param request - Transfer request parameters
 * @returns Transfer result with success status and details
 * 
 * @example
 * const result = await executeTransferV2({
 *   playerId: 'SSPSPL0001',
 *   playerType: 'real',
 *   newTeamId: 'SSPSLT0002',
 *   seasonId: 'SSPSLS16',
 *   transferredBy: 'admin123',
 *   transferredByName: 'Admin User'
 * });
 */
export async function executeTransferV2(
  request: TransferRequest
): Promise<TransferResult> {
  const {
    playerId,
    playerType,
    newTeamId,
    seasonId,
    transferredBy,
    transferredByName
  } = request;
  
  let updatedSeasonIds: string[] = [];
  let balancesUpdated = false;
  let originalPlayerData: Map<string, PlayerData> = new Map();
  let buyingTeamOriginalBalance = 0;
  let sellingTeamOriginalBalance = 0;
  let calculation: TransferCalculation | null = null;
  let oldTeamId: string = '';
  let futureContracts: PlayerData[] = [];
  
  try {
    // Step 1: Fetch player data
    console.log('📋 Fetching player data...');
    const playerData = await fetchPlayerData(playerId, playerType, seasonId);
    
    if (!playerData) {
      return {
        success: false,
        message: 'Player not found',
        error: 'Player not found or not available for transfer',
        errorCode: 'PLAYER_NOT_FOUND'
      };
    }
    
    // Store original data for current season
    originalPlayerData.set(seasonId, { ...playerData });
    oldTeamId = playerData.team_id;
    
    // Step 1.5: Fetch future season contracts (NEW)
    console.log('🔍 Checking for future season contracts...');
    try {
      futureContracts = await fetchFutureSeasonContracts(
        playerId,
        playerType,
        seasonId,
        oldTeamId
      );
      
      // Store original data for all future seasons
      futureContracts.forEach(contract => {
        originalPlayerData.set(contract.season_id, { ...contract });
      });
      
      if (futureContracts.length > 0) {
        console.log(`✅ Found ${futureContracts.length} future season contract(s) that will be transferred`);
      }
    } catch (error) {
      console.error('❌ Error fetching future season contracts:', error);
      return {
        success: false,
        message: 'Failed to validate multi-season contracts',
        error: error instanceof Error ? error.message : 'Unknown error',
        errorCode: 'FUTURE_SEASON_ERROR'
      };
    }
    
    // Validate not transferring to same team
    if (oldTeamId === newTeamId) {
      return {
        success: false,
        message: 'Cannot transfer player to the same team',
        error: 'Player is already on this team',
        errorCode: 'SAME_TEAM'
      };
    }
    
    // Step 2: Validate transfer limits for both teams
    console.log('🔍 Validating transfer limits...');
    const sellingTeamValidation = await validateTransferLimit(oldTeamId, seasonId);
    if (!sellingTeamValidation.valid) {
      return {
        success: false,
        message: `Selling team: ${sellingTeamValidation.message}`,
        error: sellingTeamValidation.message,
        errorCode: 'TRANSFER_LIMIT_EXCEEDED'
      };
    }
    
    const buyingTeamValidation = await validateTransferLimit(newTeamId, seasonId);
    if (!buyingTeamValidation.valid) {
      return {
        success: false,
        message: `Buying team: ${buyingTeamValidation.message}`,
        error: buyingTeamValidation.message,
        errorCode: 'TRANSFER_LIMIT_EXCEEDED'
      };
    }
    
    // Step 3: Calculate transfer details
    console.log('💰 Calculating transfer details...');
    calculation = calculateTransferDetails(
      playerData.auction_value,
      playerData.star_rating,
      playerData.points,
      playerData.type
    );
    
    // Step 4: Validate buying team has sufficient funds
    console.log('💵 Validating team balance...');
    try {
      buyingTeamOriginalBalance = await validateTeamBudget(
        newTeamId,
        seasonId,
        playerType,
        calculation.buyingTeamPays,
        'transfer',
        'Buying team'
      );
    } catch (error) {
      if (error instanceof MultiseasonTransferError) {
        return {
          success: false,
          message: 'Budget validation failed',
          error: error.message,
          errorCode: error.code,
          calculation
        };
      }
      throw error;
    }
    
    // Get selling team balance for transaction logging
    sellingTeamOriginalBalance = await getTeamBalance(oldTeamId, seasonId, playerType);
    
    // Validation complete - proceed with transfer
    if (false) {
      return {
        success: false,
        message: 'Insufficient funds',
        error: `Insufficient funds. Required: $${calculation.buyingTeamPays.toFixed(2)}, Available: $${buyingTeamOriginalBalance.toFixed(2)}`,
        errorCode: 'INSUFFICIENT_FUNDS',
        calculation
      };
    }
    
    sellingTeamOriginalBalance = await getTeamBalance(oldTeamId, seasonId, playerType);
    
    // Step 5: Update player record in Neon (with multi-season support)
    console.log('📝 Updating player record...');
    const futureSeasonIds = futureContracts.map(c => c.season_id);
    updatedSeasonIds = await updatePlayerInNeon(playerId, playerType, seasonId, {
      team_id: newTeamId,
      auction_value: calculation.newValue,
      star_rating: calculation.newStarRating,
      points: playerData.points + calculation.pointsAdded,
      salary_per_match: calculation.newSalary
    }, futureSeasonIds);
    
    console.log(`✅ Updated ${updatedSeasonIds.length} season(s): ${updatedSeasonIds.join(', ')}`);
    
    // Step 6: Update team budgets in Firestore
    console.log('💸 Updating team budgets...');
    await updateTeamBudgets(
      newTeamId,
      oldTeamId,
      seasonId,
      playerType,
      calculation.buyingTeamPays,
      calculation.newValue,
      calculation.sellingTeamReceives,
      calculation.originalValue
    );
    balancesUpdated = true;
    
    // Step 7: Create transaction record
    console.log('📊 Creating transaction record...');
    const transactionId = await createTransactionRecord(
      seasonId,
      playerData,
      oldTeamId,
      newTeamId,
      calculation,
      transferredBy,
      transferredByName,
      updatedSeasonIds, // All affected season IDs (current + future)
      futureSeasonIds   // Future season IDs only (already declared in Step 5)
    );
    
    // Step 8: Log financial transactions
    console.log('📝 Logging financial transactions...');
    await Promise.all([
      logTransferPayment(
        newTeamId,
        seasonId,
        playerData.player_name,
        playerData.player_id,
        playerData.type,
        calculation.buyingTeamPays,
        buyingTeamOriginalBalance,
        oldTeamId
      ),
      logTransferCompensation(
        oldTeamId,
        seasonId,
        playerData.player_name,
        playerData.player_id,
        playerData.type,
        calculation.sellingTeamReceives,
        sellingTeamOriginalBalance,
        newTeamId
      )
    ]);
    
    // Step 9: Create news entry
    console.log('📰 Creating news entry...');
    await createTransferNews(
      seasonId,
      playerData,
      playerData.team_name || 'Previous Team',
      'New Team', // Will be fetched in news creation if needed
      calculation
    );
    
    console.log('✅ Transfer completed successfully');
    
    // Build success message with season information
    const seasonInfo = updatedSeasonIds.length > 1 
      ? ` (${updatedSeasonIds.length} seasons updated: ${updatedSeasonIds.join(', ')})`
      : '';
    
    return {
      success: true,
      message: `${playerData.player_name} successfully transferred${seasonInfo}`,
      calculation,
      transactionId
    };
    
  } catch (error) {
    console.error('❌ Transfer failed:', error);
    
    // Enhanced rollback logic for multi-season transfers
    console.log(`🔄 Initiating rollback for ${updatedSeasonIds.length} season(s)...`);
    console.log(`   Affected seasons: ${updatedSeasonIds.join(', ') || 'none'}`);
    
    let rollbackErrors: string[] = [];
    
    // Rollback all updated season records using helper function
    if (updatedSeasonIds.length > 0) {
      console.log(`🔄 Rolling back ${updatedSeasonIds.length} season record(s)...`);
      
      for (const seasonIdToRollback of updatedSeasonIds) {
        const original = originalPlayerData.get(seasonIdToRollback);
        if (original) {
          try {
            await rollbackPlayerUpdate(playerId, playerType, seasonIdToRollback, original);
          } catch (rollbackError) {
            const errorMsg = `Failed to rollback season ${seasonIdToRollback}: ${rollbackError instanceof Error ? rollbackError.message : 'Unknown error'}`;
            rollbackErrors.push(errorMsg);
            console.error(`   ❌ ${errorMsg}`);
          }
        } else {
          const errorMsg = `No original data found for season ${seasonIdToRollback}`;
          rollbackErrors.push(errorMsg);
          console.error(`   ❌ ${errorMsg}`);
        }
      }
    }
    
    // Rollback budget updates using helper function
    if (balancesUpdated && calculation) {
      console.log('🔄 Rolling back team budgets...');
      try {
        await rollbackBudgetUpdates(
          newTeamId,  // buying team
          oldTeamId,  // selling team
          seasonId,
          playerType,
          calculation.buyingTeamPays,
          calculation.newValue,
          calculation.sellingTeamReceives,
          calculation.originalValue
        );
      } catch (rollbackError) {
        const errorMsg = `Failed to rollback budgets: ${rollbackError instanceof Error ? rollbackError.message : 'Unknown error'}`;
        rollbackErrors.push(errorMsg);
        console.error(`   ❌ ${errorMsg}`);
      }
    }
    
    // Log summary of rollback attempts
    if (rollbackErrors.length > 0) {
      console.error(`❌ Rollback completed with ${rollbackErrors.length} error(s):`);
      rollbackErrors.forEach(err => console.error(`   - ${err}`));
    } else if (updatedSeasonIds.length > 0 || balancesUpdated) {
      console.log(`✅ Rollback completed successfully for all affected resources`);
    }
    
    return {
      success: false,
      message: 'Transfer failed due to system error',
      error: error instanceof Error ? error.message : 'Unknown error',
      errorCode: 'SYSTEM_ERROR'
    };
  }
}

// ============================================================================
// SWAP SYSTEM FUNCTIONS
// ============================================================================

/**
 * Update team budgets for swap operation with budget-specific fields
 * 
 * This function updates the correct budget fields based on player types for both teams.
 * It handles:
 * - Same-type swaps (real for real, football for football)
 * - Mixed swaps (real for football, football for real)
 * - Cash payments between teams
 * - Does NOT update dollar_balance field
 * 
 * @param teamAId - ID of Team A
 * @param teamBId - ID of Team B
 * @param seasonId - Season ID for the swap
 * @param playerAType - Type of player A ('real' or 'football')
 * @param playerBType - Type of player B ('real' or 'football')
 * @param playerANewValue - New value of player A after swap
 * @param playerBNewValue - New value of player B after swap
 * @param playerAOriginalValue - Original value of player A
 * @param playerBOriginalValue - Original value of player B
 * @param teamAPays - Total amount Team A pays (committee fee + cash)
 * @param teamBPays - Total amount Team B pays (committee fee + cash)
 * 
 * @example
 * // Real player for real player swap
 * await updateSwapBalances(
 *   'SSPSLT0001', 'SSPSLT0002', 'SSPSLS16',
 *   'real', 'real',
 *   281.25, 390.00,
 *   225, 300,
 *   60, 50
 * );
 * 
 * @example
 * // Mixed swap: real player for football player
 * await updateSwapBalances(
 *   'SSPSLT0001', 'SSPSLT0002', 'SSPSLS16',
 *   'real', 'football',
 *   281.25, 57.50,
 *   225, 46,
 *   40, 50
 * );
 */
async function updateSwapBalances(
  teamAId: string,
  teamBId: string,
  seasonId: string,
  playerAType: PlayerType,
  playerBType: PlayerType,
  playerANewValue: number,
  playerBNewValue: number,
  playerAOriginalValue: number,
  playerBOriginalValue: number,
  teamAPays: number,
  teamBPays: number
): Promise<void> {
  try {
    console.log(`💰 Updating team budgets for swap...`);
    console.log(`   Player A type: ${playerAType}, Player B type: ${playerBType}`);
    
    const teamASeasonId = `${teamAId}_${seasonId}`;
    const teamBSeasonId = `${teamBId}_${seasonId}`;
    
    const teamARef = adminDb.collection('team_seasons').doc(teamASeasonId);
    const teamBRef = adminDb.collection('team_seasons').doc(teamBSeasonId);
    
    // Verify documents exist
    const [teamADoc, teamBDoc] = await Promise.all([
      teamARef.get(),
      teamBRef.get()
    ]);
    
    if (!teamADoc.exists) {
      throw new Error(`Team A season document not found: ${teamASeasonId}`);
    }
    
    if (!teamBDoc.exists) {
      throw new Error(`Team B season document not found: ${teamBSeasonId}`);
    }
    
    // Team A is giving away Player A (playerAType) and receiving Player B (playerBType)
    // Team B is giving away Player B (playerBType) and receiving Player A (playerAType)
    
    // Determine which budget fields Team A needs to update
    // Team A loses playerAType budget and gains playerBType budget
    const teamAGivingBudgetField = playerAType === 'real' ? 'real_player_budget' : 'football_budget';
    const teamAGivingSpentField = playerAType === 'real' ? 'real_player_spent' : 'football_spent';
    const teamAReceivingBudgetField = playerBType === 'real' ? 'real_player_budget' : 'football_budget';
    const teamAReceivingSpentField = playerBType === 'real' ? 'real_player_spent' : 'football_spent';
    
    // Determine which budget fields Team B needs to update
    // Team B loses playerBType budget and gains playerAType budget
    const teamBGivingBudgetField = playerBType === 'real' ? 'real_player_budget' : 'football_budget';
    const teamBGivingSpentField = playerBType === 'real' ? 'real_player_spent' : 'football_spent';
    const teamBReceivingBudgetField = playerAType === 'real' ? 'real_player_budget' : 'football_budget';
    const teamBReceivingSpentField = playerAType === 'real' ? 'real_player_spent' : 'football_spent';
    
    console.log(`   Team A: Giving ${playerAType} player, receiving ${playerBType} player`);
    console.log(`   Team B: Giving ${playerBType} player, receiving ${playerAType} player`);
    
    // Build Team A update object
    const teamAUpdate: any = {
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    };
    
    // Team A releases Player A (playerAType)
    // Add back original value to budget, remove from spent
    teamAUpdate[teamAGivingBudgetField] = admin.firestore.FieldValue.increment(playerAOriginalValue);
    teamAUpdate[teamAGivingSpentField] = admin.firestore.FieldValue.increment(-playerAOriginalValue);
    
    // Team A receives Player B (playerBType)
    // Deduct payment (fee + cash) from budget, add new value to spent
    teamAUpdate[teamAReceivingBudgetField] = admin.firestore.FieldValue.increment(-teamAPays);
    teamAUpdate[teamAReceivingSpentField] = admin.firestore.FieldValue.increment(playerBNewValue);
    
    // Build Team B update object
    const teamBUpdate: any = {
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    };
    
    // Team B releases Player B (playerBType)
    // Add back original value to budget, remove from spent
    teamBUpdate[teamBGivingBudgetField] = admin.firestore.FieldValue.increment(playerBOriginalValue);
    teamBUpdate[teamBGivingSpentField] = admin.firestore.FieldValue.increment(-playerBOriginalValue);
    
    // Team B receives Player A (playerAType)
    // Deduct payment (fee + cash) from budget, add new value to spent
    teamBUpdate[teamBReceivingBudgetField] = admin.firestore.FieldValue.increment(-teamBPays);
    teamBUpdate[teamBReceivingSpentField] = admin.firestore.FieldValue.increment(playerANewValue);
    
    console.log(`   Team A updates:`, teamAUpdate);
    console.log(`   Team B updates:`, teamBUpdate);
    
    // Update both teams atomically
    await Promise.all([
      teamARef.update(teamAUpdate),
      teamBRef.update(teamBUpdate)
    ]);
    
    console.log(`✅ Team budgets updated successfully for swap`);
    
  } catch (error) {
    console.error('Error updating swap balances:', error);
    throw new Error(`Failed to update swap balances: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Create transaction record for swap in player_transactions collection
 * 
 * Enhanced to support multi-season swap tracking and budget field logging.
 * 
 * @param seasonId - Primary season where swap occurred
 * @param playerAData - Player A data
 * @param playerBData - Player B data
 * @param calculation - Swap calculation details
 * @param swappedBy - User ID who processed the swap
 * @param swappedByName - User name who processed the swap
 * @param playerASeasonIds - All season IDs affected for Player A (current + future)
 * @param playerBSeasonIds - All season IDs affected for Player B (current + future)
 * @param playerAFutureSeasonIds - Future season IDs only for Player A
 * @param playerBFutureSeasonIds - Future season IDs only for Player B
 */
async function createSwapTransactionRecord(
  seasonId: string,
  playerAData: PlayerData,
  playerBData: PlayerData,
  calculation: SwapCalculation,
  swappedBy: string,
  swappedByName: string,
  playerASeasonIds: string[] = [seasonId],
  playerBSeasonIds: string[] = [seasonId],
  playerAFutureSeasonIds: string[] = [],
  playerBFutureSeasonIds: string[] = []
): Promise<string> {
  try {
    const transactionRef = adminDb.collection('player_transactions').doc();
    
    // Determine which budget fields were used for each player
    const playerABudgetField = playerAData.type === 'real' ? 'real_player_budget' : 'football_budget';
    const playerASpentField = playerAData.type === 'real' ? 'real_player_spent' : 'football_spent';
    const playerBBudgetField = playerBData.type === 'real' ? 'real_player_budget' : 'football_budget';
    const playerBSpentField = playerBData.type === 'real' ? 'real_player_spent' : 'football_spent';
    
    // Determine if this is a multi-season swap
    const isMultiSeason = playerAFutureSeasonIds.length > 0 || playerBFutureSeasonIds.length > 0;
    
    // Combine all affected season IDs (deduplicated)
    const allAffectedSeasons = Array.from(new Set([...playerASeasonIds, ...playerBSeasonIds]));
    
    console.log(`   Transaction type: ${isMultiSeason ? 'Multi-season' : 'Single-season'} swap`);
    console.log(`   Player A affected seasons: ${playerASeasonIds.join(', ')}`);
    console.log(`   Player B affected seasons: ${playerBSeasonIds.join(', ')}`);
    console.log(`   Player A budget fields: ${playerABudgetField}, ${playerASpentField}`);
    console.log(`   Player B budget fields: ${playerBBudgetField}, ${playerBSpentField}`);
    
    await transactionRef.set({
      transaction_type: 'swap',
      season_id: seasonId,
      
      // Player A details
      player_a_id: playerAData.player_id,
      player_a_name: playerAData.player_name,
      player_a_type: playerAData.type,
      player_a_old_value: calculation.playerA.originalValue,
      player_a_new_value: calculation.playerA.newValue,
      player_a_old_star: playerAData.star_rating,
      player_a_new_star: calculation.playerA.newStarRating,
      player_a_points_added: calculation.playerA.pointsAdded,
      player_a_new_salary: calculation.playerA.newSalary,
      
      // Player B details
      player_b_id: playerBData.player_id,
      player_b_name: playerBData.player_name,
      player_b_type: playerBData.type,
      player_b_old_value: calculation.playerB.originalValue,
      player_b_new_value: calculation.playerB.newValue,
      player_b_old_star: playerBData.star_rating,
      player_b_new_star: calculation.playerB.newStarRating,
      player_b_points_added: calculation.playerB.pointsAdded,
      player_b_new_salary: calculation.playerB.newSalary,
      
      // Team details
      team_a_id: playerAData.team_id,
      team_b_id: playerBData.team_id,
      team_a_fee: calculation.playerB.committeeFee, // Team A pays fee for Player B
      team_b_fee: calculation.playerA.committeeFee, // Team B pays fee for Player A
      team_a_pays: calculation.teamAPays,
      team_b_pays: calculation.teamBPays,
      
      // Cash details
      cash_amount: calculation.cashAmount,
      cash_direction: calculation.cashDirection,
      
      // Committee fees
      total_committee_fees: calculation.totalCommitteeFees,
      
      // NEW: Multi-season tracking fields
      affected_season_ids: allAffectedSeasons,
      is_multi_season: isMultiSeason,
      player_a_affected_seasons: playerASeasonIds,
      player_b_affected_seasons: playerBSeasonIds,
      player_a_future_seasons: playerAFutureSeasonIds,
      player_b_future_seasons: playerBFutureSeasonIds,
      
      // NEW: Budget field tracking
      player_a_budget_field: playerABudgetField,
      player_a_spent_field: playerASpentField,
      player_b_budget_field: playerBBudgetField,
      player_b_spent_field: playerBSpentField,
      
      // Metadata
      processed_by: swappedBy,
      processed_by_name: swappedByName,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    });
    
    return transactionRef.id;
    
  } catch (error) {
    console.error('Error creating swap transaction record:', error);
    throw new Error(`Failed to create swap transaction record: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Log swap financial transactions for both teams
 */
async function logSwapTransactions(
  teamAId: string,
  teamBId: string,
  seasonId: string,
  playerAData: PlayerData,
  playerBData: PlayerData,
  calculation: SwapCalculation,
  teamAOriginalBalance: number,
  teamBOriginalBalance: number
): Promise<void> {
  try {
    const transactionsRef = adminDb.collection('transactions');
    
    // Create transaction for Team A
    await transactionsRef.add({
      team_id: teamAId,
      season_id: seasonId,
      transaction_type: 'swap_committee_fee',
      amount: -calculation.teamAPays,
      balance_before: teamAOriginalBalance,
      balance_after: teamAOriginalBalance - calculation.teamAPays,
      description: `Swap: ${playerAData.player_name} ↔ ${playerBData.player_name} (Fee: ${calculation.playerB.committeeFee}${calculation.cashAmount > 0 && calculation.cashDirection === 'A_to_B' ? `, Cash: ${calculation.cashAmount}` : ''})`,
      player_id: playerBData.player_id,
      player_name: playerBData.player_name,
      player_type: playerBData.type,
      related_team_id: teamBId,
      created_at: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Create transaction for Team B
    await transactionsRef.add({
      team_id: teamBId,
      season_id: seasonId,
      transaction_type: 'swap_committee_fee',
      amount: -calculation.teamBPays,
      balance_before: teamBOriginalBalance,
      balance_after: teamBOriginalBalance - calculation.teamBPays,
      description: `Swap: ${playerBData.player_name} ↔ ${playerAData.player_name} (Fee: ${calculation.playerA.committeeFee}${calculation.cashAmount > 0 && calculation.cashDirection === 'B_to_A' ? `, Cash: ${calculation.cashAmount}` : ''})`,
      player_id: playerAData.player_id,
      player_name: playerAData.player_name,
      player_type: playerAData.type,
      related_team_id: teamAId,
      created_at: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('✅ Swap financial transactions logged');
    
  } catch (error) {
    console.error('Error logging swap transactions:', error);
    // Don't throw - transaction logging failure shouldn't block swap
  }
}

/**
 * Create news entry for swap
 */
async function createSwapNews(
  seasonId: string,
  playerAData: PlayerData,
  playerBData: PlayerData,
  calculation: SwapCalculation
): Promise<void> {
  try {
    const newsRef = adminDb.collection('news').doc();
    
    // Build upgrade text for both players
    const playerAUpgradeText = calculation.playerA.newStarRating > playerAData.star_rating
      ? ` ${playerAData.player_name} upgraded from ${playerAData.star_rating}⭐ to ${calculation.playerA.newStarRating}⭐.`
      : '';
    
    const playerBUpgradeText = calculation.playerB.newStarRating > playerBData.star_rating
      ? ` ${playerBData.player_name} upgraded from ${playerBData.star_rating}⭐ to ${calculation.playerB.newStarRating}⭐.`
      : '';
    
    const upgradesText = (playerAUpgradeText || playerBUpgradeText)
      ? ` Star Rating Upgrades:${playerAUpgradeText}${playerBUpgradeText}`
      : '';
    
    // Build cash text
    const cashText = calculation.cashAmount > 0
      ? ` ${calculation.cashDirection === 'A_to_B' ? playerAData.team_name : playerBData.team_name} also paid ${calculation.cashAmount.toFixed(2)} in cash.`
      : '';
    
    const content = `Player swap completed: ${playerAData.player_name} (${playerAData.team_name}) ↔ ${playerBData.player_name} (${playerBData.team_name}). ` +
      `${playerAData.player_name}'s new value: ${calculation.playerA.newValue.toFixed(2)} (from ${calculation.playerA.originalValue.toFixed(2)}). ` +
      `${playerBData.player_name}'s new value: ${calculation.playerB.newValue.toFixed(2)} (from ${calculation.playerB.originalValue.toFixed(2)}). ` +
      `${playerAData.team_name} paid ${calculation.teamAPays.toFixed(2)} (committee fee: ${calculation.playerB.committeeFee}). ` +
      `${playerBData.team_name} paid ${calculation.teamBPays.toFixed(2)} (committee fee: ${calculation.playerA.committeeFee}).` +
      `${cashText}${upgradesText}`;
    
    await newsRef.set({
      title: `Player Swap: ${playerAData.player_name} ↔ ${playerBData.player_name}`,
      content,
      season_id: seasonId,
      category: 'player_movement',
      is_published: true,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('✅ Swap news created');
    
  } catch (error) {
    console.error('Error creating swap news:', error);
    // Don't throw - news creation failure shouldn't block swap
  }
}

/**
 * Execute a player swap with fixed committee fees and star upgrades
 * 
 * This function performs a complete swap operation:
 * 1. Validates transfer limits for both teams
 * 2. Validates both teams have sufficient funds for fees
 * 3. Validates cash amount within 30% limit
 * 4. Validates players are from different teams
 * 5. Calculates new values, fees, and upgrades for both players
 * 6. Updates both player records in Neon
 * 7. Updates team balances in Firestore (fees + cash)
 * 8. Creates transaction record
 * 9. Logs financial transactions for both teams
 * 10. Creates news entry with swap details including upgrades
 * 
 * All operations are performed with error handling and rollback support.
 * 
 * @param request - Swap request parameters
 * @returns Swap result with success status and details
 * 
 * @example
 * const result = await executeSwapV2({
 *   playerAId: 'SSPSPL0001',
 *   playerAType: 'real',
 *   playerBId: 'SSPSPF0001',
 *   playerBType: 'football',
 *   cashAmount: 50,
 *   cashDirection: 'A_to_B',
 *   seasonId: 'SSPSLS16',
 *   swappedBy: 'admin123',
 *   swappedByName: 'Admin User'
 * });
 */
export async function executeSwapV2(
  request: SwapRequest
): Promise<SwapResult> {
  const {
    playerAId,
    playerAType,
    playerBId,
    playerBType,
    cashAmount = 0,
    cashDirection = 'none',
    seasonId,
    swappedBy,
    swappedByName
  } = request;
  
  let playerAUpdated = false;
  let playerBUpdated = false;
  let balancesUpdated = false;
  let originalPlayerAData: PlayerData | null = null;
  let originalPlayerBData: PlayerData | null = null;
  let teamAOriginalBalance = 0;
  let teamBOriginalBalance = 0;
  let teamAId: string = '';
  let teamBId: string = '';
  let calculation: SwapCalculation | null = null;
  
  try {
    // Step 1: Fetch both player data
    console.log('📋 Fetching player data...');
    const [playerAData, playerBData] = await Promise.all([
      fetchPlayerData(playerAId, playerAType, seasonId),
      fetchPlayerData(playerBId, playerBType, seasonId)
    ]);
    
    if (!playerAData) {
      return {
        success: false,
        message: 'Player A not found',
        error: 'Player A not found or not available for swap',
        errorCode: 'PLAYER_NOT_FOUND'
      };
    }
    
    if (!playerBData) {
      return {
        success: false,
        message: 'Player B not found',
        error: 'Player B not found or not available for swap',
        errorCode: 'PLAYER_NOT_FOUND'
      };
    }
    
    originalPlayerAData = { ...playerAData };
    originalPlayerBData = { ...playerBData };
    
    teamAId = playerAData.team_id;
    teamBId = playerBData.team_id;
    
    // Validate players are from different teams
    if (teamAId === teamBId) {
      return {
        success: false,
        message: 'Cannot swap players from the same team',
        error: 'Both players belong to the same team',
        errorCode: 'SAME_TEAM_SWAP'
      };
    }
    
    // Step 2: Validate transfer limits for both teams
    console.log('🔍 Validating transfer limits...');
    const limitsValidation = await validateMultipleTeamLimits([teamAId, teamBId], seasonId);
    
    if (!limitsValidation.valid) {
      return {
        success: false,
        message: limitsValidation.message || 'Transfer limit exceeded',
        error: limitsValidation.message,
        errorCode: 'TRANSFER_LIMIT_EXCEEDED'
      };
    }
    
    // Step 3: Calculate swap details
    console.log('💰 Calculating swap details...');
    calculation = calculateSwapDetails(
      {
        value: playerAData.auction_value,
        starRating: playerAData.star_rating,
        points: playerAData.points,
        type: playerAData.type
      },
      {
        value: playerBData.auction_value,
        starRating: playerBData.star_rating,
        points: playerBData.points,
        type: playerBData.type
      },
      cashAmount,
      cashDirection
    );
    
    // Step 4: Validate both teams have sufficient funds
    console.log('💵 Validating team balances...');
    try {
      teamAOriginalBalance = await validateTeamBudget(
        teamAId,
        seasonId,
        playerAType,
        calculation.teamAPays,
        'swap',
        'Team A'
      );
      
      teamBOriginalBalance = await validateTeamBudget(
        teamBId,
        seasonId,
        playerBType,
        calculation.teamBPays,
        'swap',
        'Team B'
      );
    } catch (error) {
      if (error instanceof MultiseasonTransferError) {
        return {
          success: false,
          message: 'Budget validation failed',
          error: error.message,
          errorCode: error.code,
          calculation
        };
      }
      throw error;
    }
    
    // Step 5: Update Player A record in Neon (swap to Team B)
    console.log('📝 Updating Player A record...');
    await updatePlayerInNeon(playerAId, playerAType, seasonId, {
      team_id: teamBId,
      auction_value: calculation.playerA.newValue,
      star_rating: calculation.playerA.newStarRating,
      points: playerAData.points + calculation.playerA.pointsAdded,
      salary_per_match: calculation.playerA.newSalary
    }, []); // Empty array for now - will be populated with future seasons in task 11
    playerAUpdated = true;
    
    // Step 6: Update Player B record in Neon (swap to Team A)
    console.log('📝 Updating Player B record...');
    await updatePlayerInNeon(playerBId, playerBType, seasonId, {
      team_id: teamAId,
      auction_value: calculation.playerB.newValue,
      star_rating: calculation.playerB.newStarRating,
      points: playerBData.points + calculation.playerB.pointsAdded,
      salary_per_match: calculation.playerB.newSalary
    }, []); // Empty array for now - will be populated with future seasons in task 11
    playerBUpdated = true;
    
    // Step 7: Update team budgets in Firestore
    console.log('💸 Updating team budgets...');
    await updateSwapBalances(
      teamAId,
      teamBId,
      seasonId,
      playerAType,
      playerBType,
      calculation.playerA.newValue,
      calculation.playerB.newValue,
      calculation.playerA.originalValue,
      calculation.playerB.originalValue,
      calculation.teamAPays,
      calculation.teamBPays
    );
    balancesUpdated = true;
    
    // Step 8: Create transaction record
    console.log('📊 Creating transaction record...');
    const transactionId = await createSwapTransactionRecord(
      seasonId,
      playerAData,
      playerBData,
      calculation,
      swappedBy,
      swappedByName
    );
    
    // Step 9: Log financial transactions
    console.log('📝 Logging financial transactions...');
    await logSwapTransactions(
      teamAId,
      teamBId,
      seasonId,
      playerAData,
      playerBData,
      calculation,
      teamAOriginalBalance,
      teamBOriginalBalance
    );
    
    // Step 10: Create news entry
    console.log('📰 Creating news entry...');
    await createSwapNews(
      seasonId,
      playerAData,
      playerBData,
      calculation
    );
    
    console.log('✅ Swap completed successfully');
    
    return {
      success: true,
      message: `${playerAData.player_name} and ${playerBData.player_name} successfully swapped`,
      calculation,
      transactionId
    };
    
  } catch (error) {
    console.error('❌ Swap failed:', error);
    
    // Rollback logic
    if (balancesUpdated && originalPlayerAData && originalPlayerBData && calculation) {
      console.log('🔄 Rolling back team budgets...');
      try {
        // Reverse the swap by swapping back with original values
        // This effectively undoes the budget changes
        await updateSwapBalances(
          teamBId, // Swap team order
          teamAId,
          seasonId,
          playerBType, // Swap player types
          playerAType,
          originalPlayerBData.auction_value, // Use original values
          originalPlayerAData.auction_value,
          calculation.playerB.newValue, // What was "new" is now "original"
          calculation.playerA.newValue,
          calculation.teamBPays, // Reverse payments
          calculation.teamAPays
        );
      } catch (rollbackError) {
        console.error('Failed to rollback budgets:', rollbackError);
      }
    }
    
    if (playerBUpdated && originalPlayerBData) {
      console.log('🔄 Rolling back Player B record...');
      try {
        await updatePlayerInNeon(playerBId, playerBType, seasonId, {
          team_id: originalPlayerBData.team_id,
          auction_value: originalPlayerBData.auction_value,
          star_rating: originalPlayerBData.star_rating,
          points: originalPlayerBData.points,
          salary_per_match: originalPlayerBData.salary_per_match || 0
        }, []); // No future seasons in rollback
      } catch (rollbackError) {
        console.error('Failed to rollback Player B:', rollbackError);
      }
    }
    
    if (playerAUpdated && originalPlayerAData) {
      console.log('🔄 Rolling back Player A record...');
      try {
        await updatePlayerInNeon(playerAId, playerAType, seasonId, {
          team_id: originalPlayerAData.team_id,
          auction_value: originalPlayerAData.auction_value,
          star_rating: originalPlayerAData.star_rating,
          points: originalPlayerAData.points,
          salary_per_match: originalPlayerAData.salary_per_match || 0
        }, []); // No future seasons in rollback
      } catch (rollbackError) {
        console.error('Failed to rollback Player A:', rollbackError);
      }
    }
    
    return {
      success: false,
      message: 'Swap failed due to system error',
      error: error instanceof Error ? error.message : 'Unknown error',
      errorCode: 'SYSTEM_ERROR'
    };
  }
}

