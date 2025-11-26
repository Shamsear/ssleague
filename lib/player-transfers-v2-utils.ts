/**
 * Player Transfer System V2 - Core Utilities
 * 
 * This module contains all calculation functions and constants for the enhanced
 * player transfer and swap system with star-based value increases, committee fees,
 * and automatic player upgrades.
 */

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Star rating multipliers for calculating new player values
 * When a player is transferred or swapped, their value increases based on their star rating
 */
export const STAR_VALUE_MULTIPLIERS: Record<number, number> = {
  3: 1.15,  // 115% of original value
  4: 1.20,  // 120% of original value
  5: 1.25,  // 125% of original value
  6: 1.30,  // 130% of original value
  7: 1.35,  // 135% of original value
  8: 1.40,  // 140% of original value
  9: 1.45,  // 145% of original value
  10: 1.50  // 150% of original value
};

/**
 * Fixed committee fees for swap deals based on star rating
 * Each team pays the fee for the player they are receiving
 */
export const SWAP_FEES: Record<number, number> = {
  3: 30,
  4: 40,
  5: 50,
  6: 60,
  7: 70,
  8: 80,
  9: 90,
  10: 100
};

/**
 * Star rating point thresholds
 * Players upgrade their star rating when their points reach these thresholds
 */
export const STAR_POINT_THRESHOLDS: Record<number, { min: number; max: number }> = {
  3: { min: 100, max: 119 },
  4: { min: 120, max: 144 },
  5: { min: 145, max: 174 },
  6: { min: 175, max: 209 },
  7: { min: 210, max: 249 },
  8: { min: 250, max: 299 },
  9: { min: 300, max: 399 },
  10: { min: 400, max: Infinity }
};

/**
 * Salary calculation rates by player type
 */
export const SALARY_RATES = {
  real: 0.007,      // 0.7% of value for real players
  football: 0.003   // 0.3% of value for football players
} as const;

/**
 * Transfer fee percentage (10% of new value)
 */
export const TRANSFER_FEE_PERCENTAGE = 0.10;

/**
 * Points per value ratio for star rating upgrades
 * 1 point for every $5 increase in value = 0.2 ratio
 */
export const POINTS_PER_VALUE_RATIO = 0.2;

// ============================================================================
// CALCULATION FUNCTIONS
// ============================================================================

/**
 * Calculate new player value based on star rating multiplier
 * 
 * @param currentValue - The player's current auction value
 * @param starRating - The player's current star rating (3-10)
 * @returns The new calculated value rounded to 2 decimal places
 * 
 * @example
 * calculateNewValue(225, 5) // Returns 281.25 (225 * 1.25)
 */
export function calculateNewValue(
  currentValue: number,
  starRating: number
): number {
  if (currentValue < 0) {
    throw new Error('Current value must be non-negative');
  }
  
  if (starRating < 3 || starRating > 10) {
    throw new Error('Star rating must be between 3 and 10');
  }
  
  const multiplier = STAR_VALUE_MULTIPLIERS[starRating] || 1.0;
  return Math.round(currentValue * multiplier * 100) / 100;
}

/**
 * Calculate committee fee (10% of new value for transfers)
 * 
 * @param newValue - The new calculated player value
 * @returns The committee fee rounded to 2 decimal places
 * 
 * @example
 * calculateCommitteeFee(281.25) // Returns 28.13 (281.25 * 0.10)
 */
export function calculateCommitteeFee(newValue: number): number {
  if (newValue < 0) {
    throw new Error('New value must be non-negative');
  }
  
  return Math.round(newValue * TRANSFER_FEE_PERCENTAGE * 100) / 100;
}

/**
 * Calculate new star rating based on points accumulated from value increases
 * 
 * Formula: 1 point for every $5 increase in value (ratio = 0.2)
 * 
 * @param currentPoints - The player's current points
 * @param valueIncrease - The increase in player value
 * @param pointsPerValueRatio - Ratio for converting value to points (default: 0.2)
 * @returns Object containing new points and new star rating
 * 
 * @example
 * calculateNewStarRating(180, 100, 0.2)
 * // Returns { newPoints: 200, newStarRating: 5 }
 * // Explanation: 100 / 5 = 20 points added, 180 + 20 = 200 points
 */
export function calculateNewStarRating(
  currentPoints: number,
  valueIncrease: number,
  pointsPerValueRatio: number = POINTS_PER_VALUE_RATIO
): { newPoints: number; newStarRating: number } {
  if (currentPoints < 0) {
    throw new Error('Current points must be non-negative');
  }
  
  if (valueIncrease < 0) {
    throw new Error('Value increase must be non-negative');
  }
  
  if (pointsPerValueRatio < 0 || pointsPerValueRatio > 1) {
    throw new Error('Points per value ratio must be between 0 and 1');
  }
  
  // Calculate points to add based on value increase
  const pointsAdded = Math.round(valueIncrease * pointsPerValueRatio);
  const newPoints = currentPoints + pointsAdded;
  
  // Determine new star rating based on point thresholds
  for (const [star, threshold] of Object.entries(STAR_POINT_THRESHOLDS)) {
    if (newPoints >= threshold.min && newPoints <= threshold.max) {
      return { newPoints, newStarRating: parseInt(star) };
    }
  }
  
  // If points exceed all thresholds, return max star rating
  return { newPoints, newStarRating: 10 };
}

/**
 * Calculate salary per match based on player value and type
 * 
 * @param value - The player's current value
 * @param playerType - Type of player ('real' or 'football')
 * @returns The calculated salary per match rounded to 2 decimal places
 * 
 * @example
 * calculateSalary(390, 'real') // Returns 2.73 (390 * 0.007)
 * calculateSalary(46, 'football') // Returns 0.14 (46 * 0.003)
 */
export function calculateSalary(
  value: number,
  playerType: 'real' | 'football'
): number {
  if (value < 0) {
    throw new Error('Value must be non-negative');
  }
  
  if (playerType !== 'real' && playerType !== 'football') {
    throw new Error('Player type must be either "real" or "football"');
  }
  
  const rate = SALARY_RATES[playerType];
  return Math.round(value * rate * 100) / 100;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get the fixed swap fee for a player based on their star rating
 * 
 * @param starRating - The player's star rating (3-10)
 * @returns The fixed swap fee amount
 */
export function getSwapFee(starRating: number): number {
  if (starRating < 3 || starRating > 10) {
    throw new Error('Star rating must be between 3 and 10');
  }
  
  return SWAP_FEES[starRating] || 0;
}

/**
 * Validate if a cash amount is within the 30% limit of player value
 * 
 * @param cashAmount - The cash amount to validate
 * @param playerValue - The player's value
 * @returns Object with validation result and max allowed amount
 */
export function validateCashAmount(
  cashAmount: number,
  playerValue: number
): { valid: boolean; maxAllowed: number; message?: string } {
  const maxAllowed = Math.round(playerValue * 0.30 * 100) / 100;
  
  if (cashAmount > maxAllowed) {
    return {
      valid: false,
      maxAllowed,
      message: `Cash amount cannot exceed 30% of player value (${maxAllowed})`
    };
  }
  
  return { valid: true, maxAllowed };
}

// ============================================================================
// TRANSFER CALCULATION
// ============================================================================

/**
 * Transfer calculation result interface
 */
export interface TransferCalculation {
  originalValue: number;
  newValue: number;
  starMultiplier: number;
  committeeFee: number;
  buyingTeamPays: number;
  sellingTeamReceives: number;
  newStarRating: number;
  newSalary: number;
  pointsAdded: number;
}

/**
 * Calculate all transfer details including fees, new values, and upgrades
 * 
 * This function performs all calculations needed for a player transfer:
 * - New value based on star rating multiplier
 * - 10% committee fee
 * - Total cost to buying team (new value + fee)
 * - Amount selling team receives (new value - fee)
 * - New star rating based on points
 * - New salary based on new value
 * 
 * @param currentValue - The player's current auction value
 * @param starRating - The player's current star rating (3-10)
 * @param currentPoints - The player's current points
 * @param playerType - Type of player ('real' or 'football')
 * @returns TransferCalculation object with all calculated values
 * 
 * @example
 * calculateTransferDetails(225, 5, 192, 'real')
 * // Returns:
 * // {
 * //   originalValue: 225,
 * //   newValue: 281.25,
 * //   starMultiplier: 1.25,
 * //   committeeFee: 28.13,
 * //   buyingTeamPays: 309.38,
 * //   sellingTeamReceives: 253.12,
 * //   newStarRating: 7,
 * //   newSalary: 1.97,
 * //   pointsAdded: 34
 * // }
 */
export function calculateTransferDetails(
  currentValue: number,
  starRating: number,
  currentPoints: number,
  playerType: 'real' | 'football'
): TransferCalculation {
  // Validate inputs
  if (currentValue < 0) {
    throw new Error('Current value must be non-negative');
  }
  
  if (starRating < 3 || starRating > 10) {
    throw new Error('Star rating must be between 3 and 10');
  }
  
  if (currentPoints < 0) {
    throw new Error('Current points must be non-negative');
  }
  
  if (playerType !== 'real' && playerType !== 'football') {
    throw new Error('Player type must be either "real" or "football"');
  }
  
  // Step 1: Calculate new value using star multiplier
  const starMultiplier = STAR_VALUE_MULTIPLIERS[starRating];
  const newValue = calculateNewValue(currentValue, starRating);
  
  // Step 2: Calculate 10% committee fee
  const committeeFee = calculateCommitteeFee(newValue);
  
  // Step 3: Calculate buying team total cost (new value + fee)
  const buyingTeamPays = Math.round((newValue + committeeFee) * 100) / 100;
  
  // Step 4: Calculate selling team receives (new value - fee)
  const sellingTeamReceives = Math.round((newValue - committeeFee) * 100) / 100;
  
  // Step 5: Calculate value increase for star rating upgrade
  const valueIncrease = newValue - currentValue;
  
  // Step 6: Calculate new star rating and points
  const { newPoints, newStarRating } = calculateNewStarRating(
    currentPoints,
    valueIncrease
  );
  const pointsAdded = newPoints - currentPoints;
  
  // Step 7: Calculate new salary based on new value
  const newSalary = calculateSalary(newValue, playerType);
  
  return {
    originalValue: currentValue,
    newValue,
    starMultiplier,
    committeeFee,
    buyingTeamPays,
    sellingTeamReceives,
    newStarRating,
    newSalary,
    pointsAdded
  };
}

// ============================================================================
// SWAP CALCULATION
// ============================================================================

/**
 * Swap calculation result interface
 */
export interface SwapCalculation {
  playerA: {
    originalValue: number;
    newValue: number;
    starMultiplier: number;
    committeeFee: number;
    newStarRating: number;
    newSalary: number;
    pointsAdded: number;
  };
  playerB: {
    originalValue: number;
    newValue: number;
    starMultiplier: number;
    committeeFee: number;
    newStarRating: number;
    newSalary: number;
    pointsAdded: number;
  };
  cashAmount: number;
  cashDirection: 'A_to_B' | 'B_to_A' | 'none';
  teamAPays: number;
  teamBPays: number;
  totalCommitteeFees: number;
}

/**
 * Calculate all swap details including fees, new values, and upgrades for both players
 * 
 * This function performs all calculations needed for a player swap:
 * - New values for both players based on star rating multipliers
 * - Fixed committee fees based on star ratings
 * - New star ratings based on points for both players
 * - New salaries based on new values
 * - Cash amount validation (max 30% of player value)
 * - Final amounts each team pays (fee + cash)
 * 
 * @param playerAData - Data for player A
 * @param playerBData - Data for player B
 * @param cashAmount - Optional cash amount (default: 0)
 * @param cashDirection - Direction of cash flow ('A_to_B', 'B_to_A', or 'none')
 * @returns SwapCalculation object with all calculated values
 * 
 * @example
 * calculateSwapDetails(
 *   { value: 225, starRating: 5, points: 192, type: 'real' },
 *   { value: 300, starRating: 6, points: 220, type: 'football' },
 *   50,
 *   'A_to_B'
 * )
 * // Returns detailed swap calculation with fees, upgrades, and cash flow
 */
export function calculateSwapDetails(
  playerAData: {
    value: number;
    starRating: number;
    points: number;
    type: 'real' | 'football';
  },
  playerBData: {
    value: number;
    starRating: number;
    points: number;
    type: 'real' | 'football';
  },
  cashAmount: number = 0,
  cashDirection: 'A_to_B' | 'B_to_A' | 'none' = 'none'
): SwapCalculation {
  // Validate inputs
  if (playerAData.value < 0 || playerBData.value < 0) {
    throw new Error('Player values must be non-negative');
  }
  
  if (playerAData.starRating < 3 || playerAData.starRating > 10 ||
      playerBData.starRating < 3 || playerBData.starRating > 10) {
    throw new Error('Star ratings must be between 3 and 10');
  }
  
  if (playerAData.points < 0 || playerBData.points < 0) {
    throw new Error('Player points must be non-negative');
  }
  
  if (cashAmount < 0) {
    throw new Error('Cash amount must be non-negative');
  }
  
  if (!['A_to_B', 'B_to_A', 'none'].includes(cashDirection)) {
    throw new Error('Cash direction must be "A_to_B", "B_to_A", or "none"');
  }
  
  // Validate cash amount is within 30% limit
  if (cashAmount > 0) {
    const maxCashA = Math.round(playerAData.value * 0.30 * 100) / 100;
    const maxCashB = Math.round(playerBData.value * 0.30 * 100) / 100;
    const maxCash = Math.max(maxCashA, maxCashB);
    
    if (cashAmount > maxCash) {
      throw new Error(
        `Cash amount (${cashAmount}) exceeds 30% limit. Maximum allowed: ${maxCash}`
      );
    }
  }
  
  // Calculate Player A details
  const playerAMultiplier = STAR_VALUE_MULTIPLIERS[playerAData.starRating];
  const playerANewValue = calculateNewValue(playerAData.value, playerAData.starRating);
  const playerAValueIncrease = playerANewValue - playerAData.value;
  const playerAUpgrade = calculateNewStarRating(playerAData.points, playerAValueIncrease);
  const playerANewSalary = calculateSalary(playerANewValue, playerAData.type);
  const playerACommitteeFee = getSwapFee(playerAData.starRating);
  
  // Calculate Player B details
  const playerBMultiplier = STAR_VALUE_MULTIPLIERS[playerBData.starRating];
  const playerBNewValue = calculateNewValue(playerBData.value, playerBData.starRating);
  const playerBValueIncrease = playerBNewValue - playerBData.value;
  const playerBUpgrade = calculateNewStarRating(playerBData.points, playerBValueIncrease);
  const playerBNewSalary = calculateSalary(playerBNewValue, playerBData.type);
  const playerBCommitteeFee = getSwapFee(playerBData.starRating);
  
  // Calculate total committee fees
  const totalCommitteeFees = playerACommitteeFee + playerBCommitteeFee;
  
  // Calculate what each team pays
  // Team A receives Player B, so pays Player B's committee fee
  // Team B receives Player A, so pays Player A's committee fee
  let teamAPays = playerBCommitteeFee;
  let teamBPays = playerACommitteeFee;
  
  // Add cash to the appropriate team's payment
  if (cashDirection === 'A_to_B') {
    teamAPays += cashAmount;
  } else if (cashDirection === 'B_to_A') {
    teamBPays += cashAmount;
  }
  
  // Round to 2 decimal places
  teamAPays = Math.round(teamAPays * 100) / 100;
  teamBPays = Math.round(teamBPays * 100) / 100;
  
  return {
    playerA: {
      originalValue: playerAData.value,
      newValue: playerANewValue,
      starMultiplier: playerAMultiplier,
      committeeFee: playerACommitteeFee,
      newStarRating: playerAUpgrade.newStarRating,
      newSalary: playerANewSalary,
      pointsAdded: playerAUpgrade.newPoints - playerAData.points
    },
    playerB: {
      originalValue: playerBData.value,
      newValue: playerBNewValue,
      starMultiplier: playerBMultiplier,
      committeeFee: playerBCommitteeFee,
      newStarRating: playerBUpgrade.newStarRating,
      newSalary: playerBNewSalary,
      pointsAdded: playerBUpgrade.newPoints - playerBData.points
    },
    cashAmount,
    cashDirection,
    teamAPays,
    teamBPays,
    totalCommitteeFees
  };
}
