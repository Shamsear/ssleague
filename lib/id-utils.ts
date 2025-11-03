/**
 * ID Format Definitions:
 * - Rounds: SSPSLFR{counter} - e.g., SSPSLFR00001
 * - Teams: SSPSLT{counter} - e.g., SSPSLT0001
 * - Bids: {team_id}_{round_id} - e.g., SSPSLT0001_SSPSLFR00001
 * - Tiebreakers: SSPSLTR{counter} - e.g., SSPSLTR00001
 * - Team Tiebreakers: {team_id}_{tiebreaker_id} - e.g., SSPSLT0001_SSPSLTR00001
 * - Bulk Rounds: SSPSLFBR{counter} - e.g., SSPSLFBR00001
 * - Bulk Tiebreakers: SSPSLBT{counter} - e.g., SSPSLBT00001
 * 
 * This file contains ONLY client-safe utilities with no database dependencies
 */

export const ID_PREFIXES = {
  ROUND: 'SSPSLFR',
  TEAM: 'SSPSLT',
  TIEBREAKER: 'SSPSLTR',
  BULK_ROUND: 'SSPSLFBR',
  BULK_TIEBREAKER: 'SSPSLBT',
} as const;

export const ID_PADDING = {
  ROUND: 5,
  TEAM: 4,
  TIEBREAKER: 5,
  BULK_ROUND: 5,
  BULK_TIEBREAKER: 5,
} as const;

/**
 * Generate a formatted ID with prefix and zero-padded counter
 */
export function formatId(prefix: string, counter: number, padding: number): string {
  return `${prefix}${counter.toString().padStart(padding, '0')}`;
}

/**
 * Generate a compound Bid ID from team_id and round_id
 */
export function generateBidId(teamId: string, roundId: string): string {
  return `${teamId}_${roundId}`;
}

/**
 * Generate a compound Team Tiebreaker ID from team_id and tiebreaker_id
 */
export function generateTeamTiebreakerId(teamId: string, tiebreakerId: string): string {
  return `${teamId}_${tiebreakerId}`;
}

/**
 * Parse a compound ID into its components
 */
export function parseBidId(bidId: string): { teamId: string; roundId: string } {
  const [teamId, roundId] = bidId.split('_');
  return { teamId, roundId };
}

/**
 * Parse a team tiebreaker ID into its components
 */
export function parseTeamTiebreakerId(teamTiebreakerId: string): { teamId: string; tiebreakerId: string } {
  const [teamId, tiebreakerId] = teamTiebreakerId.split('_');
  return { teamId, tiebreakerId };
}

/**
 * Validate ID format
 */
export function isValidRoundId(id: string): boolean {
  return new RegExp(`^${ID_PREFIXES.ROUND}\\d{${ID_PADDING.ROUND}}$`).test(id);
}

export function isValidTeamId(id: string): boolean {
  return new RegExp(`^${ID_PREFIXES.TEAM}\\d{${ID_PADDING.TEAM}}$`).test(id);
}

export function isValidTiebreakerId(id: string): boolean {
  return new RegExp(`^${ID_PREFIXES.TIEBREAKER}\\d{${ID_PADDING.TIEBREAKER}}$`).test(id);
}

export function isValidBidId(id: string): boolean {
  const parts = id.split('_');
  return parts.length === 2 && isValidTeamId(parts[0]) && isValidRoundId(parts[1]);
}

export function isValidTeamTiebreakerId(id: string): boolean {
  const parts = id.split('_');
  return parts.length === 2 && isValidTeamId(parts[0]) && isValidTiebreakerId(parts[1]);
}

/**
 * Extract the numeric portion from a readable ID
 * @param id - The full ID (e.g., "SSPSLFR00001")
 * @returns The numeric part as a string (e.g., "00001")
 */
export function extractIdNumber(id: string): string {
  const match = id.match(/\d+$/);
  return match ? match[0] : id;
}

/**
 * Extract the numeric portion from a readable ID as an integer
 * @param id - The full ID (e.g., "SSPSLFR00001")
 * @returns The numeric part as a number (e.g., 1)
 */
export function extractIdNumberAsInt(id: string): number {
  const numStr = extractIdNumber(id);
  return parseInt(numStr, 10) || 0;
}