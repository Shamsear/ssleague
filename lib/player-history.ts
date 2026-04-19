/**
 * Player History Helper Functions
 * 
 * These functions maintain the player_history table whenever footballplayers are modified.
 * MUST be called whenever players are acquired, released, transferred, or swapped.
 */

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.NEON_DATABASE_URL!);

export interface PlayerHistoryData {
  playerId: string;
  playerName: string;
  position: string | null;
  teamId: string;
  teamName: string;
  seasonId: string;
  acquisitionType: 'auction' | 'transfer' | 'swap' | 'takeover' | 'carryover';
  acquisitionValue: number;
  contractStartSeason: string;
  contractEndSeason: string;
  roundId?: string;
  transactionId?: string;
}

/**
 * Close an active player_history record
 * Called when a player is released, transferred, or swapped
 */
export async function closePlayerHistory(
  playerId: string,
  teamId: string,
  reason: 'release' | 'transfer' | 'swap' | 'takeover',
  currentSeason: string,
  transactionId?: string
): Promise<void> {
  const status = reason === 'release' ? 'released' : 
                 reason === 'transfer' ? 'transferred' : 
                 reason === 'swap' ? 'swapped' : 'takeover';

  await sql`
    UPDATE player_history 
    SET 
      status = ${status},
      end_date = NOW(),
      end_reason = ${reason},
      contract_end_season = ${currentSeason},
      transaction_id = ${transactionId || null},
      updated_at = NOW()
    WHERE player_id = ${playerId}
    AND team_id = ${teamId}
    AND status = 'active'
  `;
}

/**
 * Create a new player_history record
 * Called when a player is acquired through auction, transfer, swap, or takeover
 */
export async function createPlayerHistory(data: PlayerHistoryData): Promise<void> {
  await sql`
    INSERT INTO player_history (
      player_id,
      player_name,
      position,
      team_id,
      team_name,
      season_id,
      acquisition_type,
      acquisition_value,
      contract_start_season,
      contract_end_season,
      round_id,
      transaction_id,
      status,
      acquisition_date
    ) VALUES (
      ${data.playerId},
      ${data.playerName},
      ${data.position},
      ${data.teamId},
      ${data.teamName},
      ${data.seasonId},
      ${data.acquisitionType},
      ${data.acquisitionValue},
      ${data.contractStartSeason},
      ${data.contractEndSeason},
      ${data.roundId || null},
      ${data.transactionId || null},
      'active',
      NOW()
    )
  `;
}

/**
 * Get team name by team ID
 * Helper function to fetch team name when not available
 */
export async function getTeamName(teamId: string): Promise<string> {
  const result = await sql`
    SELECT name FROM teams WHERE id = ${teamId} LIMIT 1
  `;
  return result[0]?.name || 'Unknown Team';
}

/**
 * Batch create player history records
 * Useful for bulk operations like auction finalization
 */
export async function batchCreatePlayerHistory(records: PlayerHistoryData[]): Promise<void> {
  if (records.length === 0) return;

  // Insert all records in a single transaction
  for (const data of records) {
    await createPlayerHistory(data);
  }
}
