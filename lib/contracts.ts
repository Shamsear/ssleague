/**
 * Contract Management Utilities
 * 
 * Handles player contracts, salary calculations, and category assignments
 * for multi-season system (Season 16+)
 */

import { RealPlayerData } from '@/types/realPlayer';
import { FootballPlayerData } from '@/types/footballPlayer';
import { PlayerCategory } from '@/types/season';

// Contract duration constants
export const CONTRACT_DURATION_SEASONS = 2; // All contracts are 2 seasons

/**
 * Calculate salary per match for real players
 * Formula: (auction_value ÷ 100) × star_rating ÷ 10
 */
export function calculateRealPlayerSalary(auctionValue: number, starRating: number): number {
  return (auctionValue / 100) * starRating / 10;
}

/**
 * Calculate salary per half-season for football players
 * Formula: auction_value × 10%
 */
export function calculateFootballPlayerSalary(auctionValue: number): number {
  return auctionValue * 0.1;
}

/**
 * Calculate contract end season based on start season
 * All contracts are 2 seasons
 */
export function calculateContractEndSeason(startSeasonId: string): string {
  const seasonNumber = parseInt(startSeasonId);
  if (isNaN(seasonNumber)) {
    throw new Error('Invalid season ID format');
  }
  return (seasonNumber + CONTRACT_DURATION_SEASONS - 1).toString();
}

/**
 * Check if a contract is active for a given season
 */
export function isContractActive(
  contractStartSeason: string,
  contractEndSeason: string,
  currentSeasonId: string
): boolean {
  const start = parseInt(contractStartSeason);
  const end = parseInt(contractEndSeason);
  const current = parseInt(currentSeasonId);
  
  if (isNaN(start) || isNaN(end) || isNaN(current)) {
    return false;
  }
  
  return current >= start && current <= end;
}

/**
 * Check if a contract has expired
 */
export function isContractExpired(
  contractEndSeason: string,
  currentSeasonId: string
): boolean {
  const end = parseInt(contractEndSeason);
  const current = parseInt(currentSeasonId);
  
  if (isNaN(end) || isNaN(current)) {
    return false;
  }
  
  return current > end;
}

/**
 * Star rating thresholds based on points
 */
const STAR_RATING_THRESHOLDS = [
  { points: 400, stars: 10 },
  { points: 350, stars: 10 }, // 10★ max is 350-400p
  { points: 300, stars: 9 },
  { points: 250, stars: 8 },
  { points: 210, stars: 7 },
  { points: 175, stars: 6 },
  { points: 145, stars: 5 },
  { points: 120, stars: 4 },
  { points: 100, stars: 3 },
];

/**
 * Calculate star rating based on points
 */
export function calculateStarRating(points: number): number {
  for (const threshold of STAR_RATING_THRESHOLDS) {
    if (points >= threshold.points) {
      return threshold.stars;
    }
  }
  return 3; // Minimum 3 stars
}

/**
 * Get initial points based on star rating
 */
export function getInitialPoints(starRating: number): number {
  const mapping: { [key: number]: number } = {
    3: 100,
    4: 120,
    5: 145,
    6: 175,
    7: 210,
    8: 250,
    9: 300,
    10: 350,
  };
  return mapping[starRating] || 100;
}

/**
 * Calculate points change based on goal difference
 * Max ±5 points per match
 */
export function calculatePointsChange(goalDifference: number): number {
  // 1 GD = 1 point, capped at ±5
  return Math.max(-5, Math.min(5, goalDifference));
}

/**
 * Update player points after a match
 */
export function updatePlayerPoints(
  currentPoints: number,
  goalDifference: number
): number {
  const change = calculatePointsChange(goalDifference);
  return Math.max(0, currentPoints + change); // Can't go below 0
}

/**
 * Determine player category based on league-wide ranking
 * Top 50% = Legend, Bottom 50% = Classic
 */
export function calculatePlayerCategory(
  playerPoints: number,
  allPlayerPoints: number[]
): PlayerCategory {
  if (allPlayerPoints.length === 0) {
    return 'classic';
  }
  
  // Sort points in descending order
  const sortedPoints = [...allPlayerPoints].sort((a, b) => b - a);
  
  // Find player's rank
  const playerRank = sortedPoints.findIndex(p => p <= playerPoints);
  
  // Top 50% = Legend
  const legendThreshold = Math.ceil(sortedPoints.length * 0.5);
  
  return playerRank < legendThreshold ? 'legend' : 'classic';
}

/**
 * Update all players' categories based on current points
 */
export function updateAllPlayerCategories(
  players: RealPlayerData[]
): Map<string, PlayerCategory> {
  const allPoints = players.map(p => p.points || 0);
  const categoryMap = new Map<string, PlayerCategory>();
  
  players.forEach(player => {
    const category = calculatePlayerCategory(player.points || 0, allPoints);
    categoryMap.set(player.id, category);
  });
  
  return categoryMap;
}

/**
 * Validate match lineup meets category requirements
 * Required: Min 2 Legend + Min 3 Classic
 */
export function validateMatchLineup(
  playerIds: string[],
  playerCategories: Map<string, PlayerCategory>
): { valid: boolean; legendCount: number; classicCount: number } {
  let legendCount = 0;
  let classicCount = 0;
  
  playerIds.forEach(playerId => {
    const category = playerCategories.get(playerId);
    if (category === 'legend') {
      legendCount++;
    } else if (category === 'classic') {
      classicCount++;
    }
  });
  
  const valid = legendCount >= 2 && classicCount >= 3;
  
  return { valid, legendCount, classicCount };
}

/**
 * Contract assignment data for real players
 */
export interface AssignRealPlayerContractData {
  playerId: string;
  teamId: string;
  starRating: number;
  auctionValue: number;
  startSeasonId: string;
}

/**
 * Create contract data for real player
 */
export function createRealPlayerContract(
  data: AssignRealPlayerContractData
): Partial<RealPlayerData> {
  const salaryPerMatch = calculateRealPlayerSalary(data.auctionValue, data.starRating);
  const contractEndSeason = calculateContractEndSeason(data.startSeasonId);
  const initialPoints = getInitialPoints(data.starRating);
  
  return {
    team_id: data.teamId,
    star_rating: data.starRating,
    auction_value: data.auctionValue,
    salary_per_match: salaryPerMatch,
    contract_start_season: data.startSeasonId,
    contract_end_season: contractEndSeason,
    contract_status: 'active',
    points: initialPoints,
    // Category will be calculated league-wide after assignment
  };
}

/**
 * Contract assignment data for football players
 */
export interface AssignFootballPlayerContractData {
  playerId: string;
  teamId: string;
  auctionValue: number;
  startSeasonId: string;
}

/**
 * Create contract data for football player
 */
export function createFootballPlayerContract(
  data: AssignFootballPlayerContractData
): Partial<FootballPlayerData> {
  const salaryPerHalfSeason = calculateFootballPlayerSalary(data.auctionValue);
  const contractEndSeason = calculateContractEndSeason(data.startSeasonId);
  
  return {
    team_id: data.teamId,
    auction_value: data.auctionValue,
    sold_price: data.auctionValue, // Keep both for compatibility
    salary_per_half_season: salaryPerHalfSeason,
    contract_start_season: data.startSeasonId,
    contract_end_season: contractEndSeason,
    contract_status: 'active',
    is_sold: true,
  };
}

/**
 * Calculate total salary commitments for a team's real players
 */
export function calculateTeamRealPlayerSalaries(
  players: RealPlayerData[]
): number {
  return players.reduce((total, player) => {
    return total + (player.salary_per_match || 0);
  }, 0);
}

/**
 * Calculate total salary commitments for a team's football players
 */
export function calculateTeamFootballPlayerSalaries(
  players: FootballPlayerData[]
): number {
  return players.reduce((total, player) => {
    return total + (player.salary_per_half_season || 0);
  }, 0);
}

/**
 * Check if team can afford a new real player
 */
export function canAffordRealPlayer(
  currentBalance: number,
  auctionValue: number,
  minPlayers: number,
  maxPlayers: number,
  currentPlayerCount: number
): { canAfford: boolean; reason?: string } {
  if (currentPlayerCount >= maxPlayers) {
    return { canAfford: false, reason: `Maximum ${maxPlayers} real players allowed` };
  }
  
  if (currentBalance < auctionValue) {
    return { canAfford: false, reason: 'Insufficient dollar balance' };
  }
  
  return { canAfford: true };
}

/**
 * Check if team can afford a new football player
 */
export function canAffordFootballPlayer(
  currentBalance: number,
  auctionValue: number,
  maxPlayers: number,
  currentPlayerCount: number
): { canAfford: boolean; reason?: string } {
  if (currentPlayerCount >= maxPlayers) {
    return { canAfford: false, reason: `Maximum ${maxPlayers} football players allowed` };
  }
  
  if (currentBalance < auctionValue) {
    return { canAfford: false, reason: 'Insufficient euro balance' };
  }
  
  return { canAfford: true };
}

/**
 * Check if a round is a mid-season round
 * Mid-season is typically at half of total rounds
 */
export function isMidSeasonRound(roundNumber: number, totalRounds: number): boolean {
  const midSeasonRound = Math.floor(totalRounds / 2);
  return roundNumber === midSeasonRound;
}
