/**
 * Transfer Limit Tracking and Validation
 * 
 * This module handles the enforcement of transfer limits (2 per team per season).
 * It tracks transfers, swaps, and releases, and validates whether teams can perform
 * additional operations.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4
 */

import { adminDb } from './firebase/admin';

// Maximum number of transfer operations allowed per team per season
export const MAX_TRANSFERS_PER_SEASON = 2;

/**
 * Transfer limit status for a team in a season
 */
export interface TransferLimitStatus {
  teamId: string;
  seasonId: string;
  transfersUsed: number;
  transfersRemaining: number;
  canTransfer: boolean;
}

/**
 * Validation result for transfer limit checks
 */
export interface TransferLimitValidation {
  valid: boolean;
  message?: string;
  status?: TransferLimitStatus;
}

/**
 * Get the current transfer limit status for a team in a season
 * 
 * This function queries the player_transactions collection to count all
 * transfer, swap, and release operations performed by the team in the season.
 * 
 * @param teamId - The team's unique identifier
 * @param seasonId - The season's unique identifier
 * @returns Transfer limit status including used and remaining slots
 * 
 * @example
 * const status = await getTransferLimitStatus('SSPSLT0001', 'SSPSLS16');
 * console.log(`Transfers used: ${status.transfersUsed} of ${MAX_TRANSFERS_PER_SEASON}`);
 */
export async function getTransferLimitStatus(
  teamId: string,
  seasonId: string
): Promise<TransferLimitStatus> {
  try {
    // Query player_transactions collection for all operations involving this team
    const transactionsRef = adminDb.collection('player_transactions');
    
    // Count operations where this team is involved
    // For transfers: count as old_team_id (selling) or new_team_id (buying)
    // For swaps: count as team_a_id or team_b_id
    // For releases: count as old_team_id
    
    const snapshot = await transactionsRef
      .where('season_id', '==', seasonId)
      .get();
    
    let transfersUsed = 0;
    
    // Count unique operations involving this team
    const processedOperations = new Set<string>();
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      const operationId = doc.id;
      
      // Skip if already processed (shouldn't happen, but safety check)
      if (processedOperations.has(operationId)) {
        continue;
      }
      
      let teamInvolved = false;
      
      // Check if team is involved in this transaction
      if (data.transaction_type === 'transfer' || data.transaction_type === 'release') {
        // For transfers and releases, count if team is old_team_id or new_team_id
        if (data.old_team_id === teamId || data.new_team_id === teamId) {
          teamInvolved = true;
        }
      } else if (data.transaction_type === 'swap') {
        // For swaps, count if team is team_a_id or team_b_id
        if (data.team_a_id === teamId || data.team_b_id === teamId) {
          teamInvolved = true;
        }
      }
      
      if (teamInvolved) {
        transfersUsed++;
        processedOperations.add(operationId);
      }
    }
    
    const transfersRemaining = Math.max(0, MAX_TRANSFERS_PER_SEASON - transfersUsed);
    const canTransfer = transfersUsed < MAX_TRANSFERS_PER_SEASON;
    
    return {
      teamId,
      seasonId,
      transfersUsed,
      transfersRemaining,
      canTransfer
    };
    
  } catch (error) {
    console.error('Error getting transfer limit status:', error);
    throw new Error(`Failed to get transfer limit status: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validate if a team can perform a transfer operation
 * 
 * Checks if the team has remaining transfer slots available.
 * Returns validation result with detailed message if validation fails.
 * 
 * @param teamId - The team's unique identifier
 * @param seasonId - The season's unique identifier
 * @returns Validation result with status and error message if invalid
 * 
 * @example
 * const validation = await validateTransferLimit('SSPSLT0001', 'SSPSLS16');
 * if (!validation.valid) {
 *   console.error(validation.message);
 * }
 */
export async function validateTransferLimit(
  teamId: string,
  seasonId: string
): Promise<TransferLimitValidation> {
  try {
    const status = await getTransferLimitStatus(teamId, seasonId);
    
    if (!status.canTransfer) {
      return {
        valid: false,
        message: `Team has used all ${MAX_TRANSFERS_PER_SEASON} transfer slots for this season (${status.transfersUsed}/${MAX_TRANSFERS_PER_SEASON})`,
        status
      };
    }
    
    return {
      valid: true,
      status
    };
    
  } catch (error) {
    console.error('Error validating transfer limit:', error);
    throw new Error(`Failed to validate transfer limit: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validate transfer limits for multiple teams (used in swaps)
 * 
 * Checks if all provided teams have remaining transfer slots.
 * Returns validation result for all teams.
 * 
 * @param teamIds - Array of team identifiers to validate
 * @param seasonId - The season's unique identifier
 * @returns Validation result with details for all teams
 * 
 * @example
 * const validation = await validateMultipleTeamLimits(['SSPSLT0001', 'SSPSLT0002'], 'SSPSLS16');
 * if (!validation.valid) {
 *   console.error(validation.message);
 * }
 */
export async function validateMultipleTeamLimits(
  teamIds: string[],
  seasonId: string
): Promise<TransferLimitValidation> {
  try {
    const validations = await Promise.all(
      teamIds.map(teamId => validateTransferLimit(teamId, seasonId))
    );
    
    // Check if any team has exceeded limit
    const failedValidation = validations.find(v => !v.valid);
    
    if (failedValidation) {
      return failedValidation;
    }
    
    return {
      valid: true
    };
    
  } catch (error) {
    console.error('Error validating multiple team limits:', error);
    throw new Error(`Failed to validate multiple team limits: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Increment the transfer count for a team after a successful operation
 * 
 * This function updates the transfer_count field in the team_seasons document
 * and creates a transaction record in player_transactions collection.
 * 
 * Note: This function should be called as part of the transfer/swap transaction,
 * not separately, to ensure atomicity.
 * 
 * @param teamId - The team's unique identifier
 * @param seasonId - The season's unique identifier
 * @returns The new transfer count
 * 
 * @example
 * await incrementTransferCount('SSPSLT0001', 'SSPSLS16');
 */
export async function incrementTransferCount(
  teamId: string,
  seasonId: string
): Promise<number> {
  try {
    const teamSeasonId = `${teamId}_${seasonId}`;
    const teamSeasonRef = adminDb.collection('team_seasons').doc(teamSeasonId);
    
    // Get current document
    const doc = await teamSeasonRef.get();
    
    if (!doc.exists) {
      throw new Error(`Team season document not found: ${teamSeasonId}`);
    }
    
    const data = doc.data();
    const currentCount = data?.transfer_count || 0;
    const newCount = currentCount + 1;
    
    // Update the transfer count
    await teamSeasonRef.update({
      transfer_count: newCount,
      updated_at: adminDb.FieldValue.serverTimestamp()
    });
    
    return newCount;
    
  } catch (error) {
    console.error('Error incrementing transfer count:', error);
    throw new Error(`Failed to increment transfer count: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Reset transfer count for a team (used when starting a new season)
 * 
 * @param teamId - The team's unique identifier
 * @param seasonId - The season's unique identifier
 * @returns Success status
 */
export async function resetTransferCount(
  teamId: string,
  seasonId: string
): Promise<void> {
  try {
    const teamSeasonId = `${teamId}_${seasonId}`;
    const teamSeasonRef = adminDb.collection('team_seasons').doc(teamSeasonId);
    
    await teamSeasonRef.update({
      transfer_count: 0,
      updated_at: adminDb.FieldValue.serverTimestamp()
    });
    
  } catch (error) {
    console.error('Error resetting transfer count:', error);
    throw new Error(`Failed to reset transfer count: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get transfer limit status for multiple teams at once
 * 
 * Useful for displaying status in UI for multiple teams.
 * 
 * @param teamIds - Array of team identifiers
 * @param seasonId - The season's unique identifier
 * @returns Array of transfer limit statuses
 */
export async function getMultipleTeamLimitStatuses(
  teamIds: string[],
  seasonId: string
): Promise<TransferLimitStatus[]> {
  try {
    return await Promise.all(
      teamIds.map(teamId => getTransferLimitStatus(teamId, seasonId))
    );
  } catch (error) {
    console.error('Error getting multiple team limit statuses:', error);
    throw new Error(`Failed to get multiple team limit statuses: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
