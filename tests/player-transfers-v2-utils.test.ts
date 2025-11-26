/**
 * Unit tests for Player Transfer System V2 utilities
 */

import { describe, test, expect } from 'vitest';
import {
  STAR_VALUE_MULTIPLIERS,
  SWAP_FEES,
  STAR_POINT_THRESHOLDS,
  SALARY_RATES,
  TRANSFER_FEE_PERCENTAGE,
  POINTS_PER_VALUE_RATIO,
  calculateNewValue,
  calculateCommitteeFee,
  calculateNewStarRating,
  calculateSalary,
  getSwapFee,
  validateCashAmount,
  calculateTransferDetails,
  calculateSwapDetails
} from '../lib/player-transfers-v2-utils';

// ============================================================================
// CONSTANT TESTS
// ============================================================================

describe('Constants', () => {
  test('STAR_VALUE_MULTIPLIERS contains all star ratings 3-10', () => {
    expect(Object.keys(STAR_VALUE_MULTIPLIERS)).toHaveLength(8);
    expect(STAR_VALUE_MULTIPLIERS[3]).toBe(1.15);
    expect(STAR_VALUE_MULTIPLIERS[10]).toBe(1.50);
  });

  test('SWAP_FEES contains all star ratings 3-10', () => {
    expect(Object.keys(SWAP_FEES)).toHaveLength(8);
    expect(SWAP_FEES[3]).toBe(30);
    expect(SWAP_FEES[10]).toBe(100);
  });

  test('STAR_POINT_THRESHOLDS contains all star ratings 3-10', () => {
    expect(Object.keys(STAR_POINT_THRESHOLDS)).toHaveLength(8);
    expect(STAR_POINT_THRESHOLDS[3]).toEqual({ min: 100, max: 149 });
    expect(STAR_POINT_THRESHOLDS[10]).toEqual({ min: 330, max: Infinity });
  });

  test('SALARY_RATES contains real and football rates', () => {
    expect(SALARY_RATES.real).toBe(0.007);
    expect(SALARY_RATES.football).toBe(0.003);
  });

  test('TRANSFER_FEE_PERCENTAGE is 10%', () => {
    expect(TRANSFER_FEE_PERCENTAGE).toBe(0.10);
  });

  test('POINTS_PER_VALUE_RATIO is 0.6', () => {
    expect(POINTS_PER_VALUE_RATIO).toBe(0.6);
  });
});

// ============================================================================
// calculateNewValue TESTS
// ============================================================================

describe('calculateNewValue', () => {
  test('calculates new value with 3-star multiplier (115%)', () => {
    expect(calculateNewValue(100, 3)).toBe(115);
    expect(calculateNewValue(200, 3)).toBe(230);
  });

  test('calculates new value with 5-star multiplier (125%)', () => {
    expect(calculateNewValue(225, 5)).toBe(281.25);
    expect(calculateNewValue(100, 5)).toBe(125);
  });

  test('calculates new value with 7-star multiplier (135%)', () => {
    expect(calculateNewValue(200, 7)).toBe(270);
    expect(calculateNewValue(150, 7)).toBe(202.5);
  });

  test('calculates new value with 10-star multiplier (150%)', () => {
    expect(calculateNewValue(100, 10)).toBe(150);
    expect(calculateNewValue(300, 10)).toBe(450);
  });

  test('rounds result to 2 decimal places', () => {
    expect(calculateNewValue(33.33, 5)).toBe(41.66);
    expect(calculateNewValue(66.67, 7)).toBe(90);
  });

  test('handles zero value', () => {
    expect(calculateNewValue(0, 5)).toBe(0);
  });

  test('throws error for negative value', () => {
    expect(() => calculateNewValue(-100, 5)).toThrow('Current value must be non-negative');
  });

  test('throws error for invalid star rating below 3', () => {
    expect(() => calculateNewValue(100, 2)).toThrow('Star rating must be between 3 and 10');
  });

  test('throws error for invalid star rating above 10', () => {
    expect(() => calculateNewValue(100, 11)).toThrow('Star rating must be between 3 and 10');
  });

  test('calculates correctly for all star ratings', () => {
    const testValue = 200;
    expect(calculateNewValue(testValue, 3)).toBe(230);   // 115%
    expect(calculateNewValue(testValue, 4)).toBe(240);   // 120%
    expect(calculateNewValue(testValue, 5)).toBe(250);   // 125%
    expect(calculateNewValue(testValue, 6)).toBe(260);   // 130%
    expect(calculateNewValue(testValue, 7)).toBe(270);   // 135%
    expect(calculateNewValue(testValue, 8)).toBe(280);   // 140%
    expect(calculateNewValue(testValue, 9)).toBe(290);   // 145%
    expect(calculateNewValue(testValue, 10)).toBe(300);  // 150%
  });
});

// ============================================================================
// calculateCommitteeFee TESTS
// ============================================================================

describe('calculateCommitteeFee', () => {
  test('calculates 10% fee correctly', () => {
    expect(calculateCommitteeFee(100)).toBe(10);
    expect(calculateCommitteeFee(281.25)).toBe(28.13);
    expect(calculateCommitteeFee(500)).toBe(50);
  });

  test('rounds result to 2 decimal places', () => {
    expect(calculateCommitteeFee(33.33)).toBe(3.33);
    expect(calculateCommitteeFee(66.67)).toBe(6.67);
  });

  test('handles zero value', () => {
    expect(calculateCommitteeFee(0)).toBe(0);
  });

  test('throws error for negative value', () => {
    expect(() => calculateCommitteeFee(-100)).toThrow('New value must be non-negative');
  });

  test('calculates fee for large values', () => {
    expect(calculateCommitteeFee(1000)).toBe(100);
    expect(calculateCommitteeFee(5000)).toBe(500);
  });

  test('calculates fee for small values', () => {
    expect(calculateCommitteeFee(1)).toBe(0.1);
    expect(calculateCommitteeFee(0.5)).toBe(0.05);
  });
});

// ============================================================================
// calculateNewStarRating TESTS
// ============================================================================

describe('calculateNewStarRating', () => {
  test('upgrades from 5-star to 7-star with sufficient points', () => {
    // Starting at 192 points (5-star: 180-209)
    // Value increase of 90 adds 54 points (90 * 0.6)
    // New total: 246 points (7-star: 240-269)
    const result = calculateNewStarRating(192, 90);
    expect(result.newPoints).toBe(246);
    expect(result.newStarRating).toBe(7);
  });

  test('stays at same star rating when points insufficient', () => {
    // Starting at 180 points (5-star: 180-209)
    // Value increase of 10 adds 6 points (10 * 0.6)
    // New total: 186 points (still 5-star)
    const result = calculateNewStarRating(180, 10);
    expect(result.newPoints).toBe(186);
    expect(result.newStarRating).toBe(5);
  });

  test('upgrades from 3-star to 4-star', () => {
    // Starting at 140 points (3-star: 100-149)
    // Value increase of 20 adds 12 points (20 * 0.6)
    // New total: 152 points (4-star: 150-179)
    const result = calculateNewStarRating(140, 20);
    expect(result.newPoints).toBe(152);
    expect(result.newStarRating).toBe(4);
  });

  test('upgrades to max 10-star rating', () => {
    // Starting at 320 points (9-star: 300-329)
    // Value increase of 20 adds 12 points (20 * 0.6)
    // New total: 332 points (10-star: 330+)
    const result = calculateNewStarRating(320, 20);
    expect(result.newPoints).toBe(332);
    expect(result.newStarRating).toBe(10);
  });

  test('stays at 10-star when already at max', () => {
    // Starting at 350 points (already 10-star)
    // Value increase of 50 adds 30 points
    // New total: 380 points (still 10-star)
    const result = calculateNewStarRating(350, 50);
    expect(result.newPoints).toBe(380);
    expect(result.newStarRating).toBe(10);
  });

  test('uses custom points per value ratio', () => {
    // Starting at 180 points
    // Value increase of 100 with ratio 0.5 adds 50 points
    // New total: 230 points (6-star: 210-239)
    const result = calculateNewStarRating(180, 100, 0.5);
    expect(result.newPoints).toBe(230);
    expect(result.newStarRating).toBe(6);
  });

  test('handles zero value increase', () => {
    const result = calculateNewStarRating(200, 0);
    expect(result.newPoints).toBe(200);
    expect(result.newStarRating).toBe(5);
  });

  test('throws error for negative current points', () => {
    expect(() => calculateNewStarRating(-10, 50)).toThrow('Current points must be non-negative');
  });

  test('throws error for negative value increase', () => {
    expect(() => calculateNewStarRating(200, -50)).toThrow('Value increase must be non-negative');
  });

  test('throws error for invalid ratio below 0', () => {
    expect(() => calculateNewStarRating(200, 50, -0.1)).toThrow('Points per value ratio must be between 0 and 1');
  });

  test('throws error for invalid ratio above 1', () => {
    expect(() => calculateNewStarRating(200, 50, 1.5)).toThrow('Points per value ratio must be between 0 and 1');
  });

  test('correctly identifies all star rating thresholds', () => {
    expect(calculateNewStarRating(100, 0).newStarRating).toBe(3);  // 100 points
    expect(calculateNewStarRating(149, 0).newStarRating).toBe(3);  // 149 points
    expect(calculateNewStarRating(150, 0).newStarRating).toBe(4);  // 150 points
    expect(calculateNewStarRating(179, 0).newStarRating).toBe(4);  // 179 points
    expect(calculateNewStarRating(180, 0).newStarRating).toBe(5);  // 180 points
    expect(calculateNewStarRating(209, 0).newStarRating).toBe(5);  // 209 points
    expect(calculateNewStarRating(210, 0).newStarRating).toBe(6);  // 210 points
    expect(calculateNewStarRating(239, 0).newStarRating).toBe(6);  // 239 points
    expect(calculateNewStarRating(240, 0).newStarRating).toBe(7);  // 240 points
    expect(calculateNewStarRating(269, 0).newStarRating).toBe(7);  // 269 points
    expect(calculateNewStarRating(270, 0).newStarRating).toBe(8);  // 270 points
    expect(calculateNewStarRating(299, 0).newStarRating).toBe(8);  // 299 points
    expect(calculateNewStarRating(300, 0).newStarRating).toBe(9);  // 300 points
    expect(calculateNewStarRating(329, 0).newStarRating).toBe(9);  // 329 points
    expect(calculateNewStarRating(330, 0).newStarRating).toBe(10); // 330 points
    expect(calculateNewStarRating(500, 0).newStarRating).toBe(10); // 500 points
  });
});

// ============================================================================
// calculateSalary TESTS
// ============================================================================

describe('calculateSalary', () => {
  test('calculates salary for real player (0.7%)', () => {
    expect(calculateSalary(390, 'real')).toBe(2.73);
    expect(calculateSalary(100, 'real')).toBe(0.7);
    expect(calculateSalary(1000, 'real')).toBe(7);
  });

  test('calculates salary for football player (0.3%)', () => {
    expect(calculateSalary(46, 'football')).toBe(0.14);
    expect(calculateSalary(100, 'football')).toBe(0.3);
    expect(calculateSalary(1000, 'football')).toBe(3);
  });

  test('rounds result to 2 decimal places', () => {
    expect(calculateSalary(333.33, 'real')).toBe(2.33);
    expect(calculateSalary(666.67, 'football')).toBe(2);
  });

  test('handles zero value', () => {
    expect(calculateSalary(0, 'real')).toBe(0);
    expect(calculateSalary(0, 'football')).toBe(0);
  });

  test('throws error for negative value', () => {
    expect(() => calculateSalary(-100, 'real')).toThrow('Value must be non-negative');
  });

  test('throws error for invalid player type', () => {
    // @ts-expect-error Testing invalid input
    expect(() => calculateSalary(100, 'invalid')).toThrow('Player type must be either "real" or "football"');
  });

  test('calculates correctly for large values', () => {
    expect(calculateSalary(5000, 'real')).toBe(35);
    expect(calculateSalary(5000, 'football')).toBe(15);
  });

  test('calculates correctly for small values', () => {
    expect(calculateSalary(10, 'real')).toBe(0.07);
    expect(calculateSalary(10, 'football')).toBe(0.03);
  });
});

// ============================================================================
// getSwapFee TESTS
// ============================================================================

describe('getSwapFee', () => {
  test('returns correct fee for each star rating', () => {
    expect(getSwapFee(3)).toBe(30);
    expect(getSwapFee(4)).toBe(40);
    expect(getSwapFee(5)).toBe(50);
    expect(getSwapFee(6)).toBe(60);
    expect(getSwapFee(7)).toBe(70);
    expect(getSwapFee(8)).toBe(80);
    expect(getSwapFee(9)).toBe(90);
    expect(getSwapFee(10)).toBe(100);
  });

  test('throws error for star rating below 3', () => {
    expect(() => getSwapFee(2)).toThrow('Star rating must be between 3 and 10');
  });

  test('throws error for star rating above 10', () => {
    expect(() => getSwapFee(11)).toThrow('Star rating must be between 3 and 10');
  });
});

// ============================================================================
// validateCashAmount TESTS
// ============================================================================

describe('validateCashAmount', () => {
  test('validates cash within 30% limit', () => {
    const result = validateCashAmount(90, 300);
    expect(result.valid).toBe(true);
    expect(result.maxAllowed).toBe(90);
    expect(result.message).toBeUndefined();
  });

  test('rejects cash exceeding 30% limit', () => {
    const result = validateCashAmount(100, 300);
    expect(result.valid).toBe(false);
    expect(result.maxAllowed).toBe(90);
    expect(result.message).toBe('Cash amount cannot exceed 30% of player value (90)');
  });

  test('validates cash at exactly 30% limit', () => {
    const result = validateCashAmount(30, 100);
    expect(result.valid).toBe(true);
    expect(result.maxAllowed).toBe(30);
  });

  test('validates zero cash amount', () => {
    const result = validateCashAmount(0, 300);
    expect(result.valid).toBe(true);
    expect(result.maxAllowed).toBe(90);
  });

  test('calculates max allowed correctly for various values', () => {
    expect(validateCashAmount(0, 100).maxAllowed).toBe(30);
    expect(validateCashAmount(0, 500).maxAllowed).toBe(150);
    expect(validateCashAmount(0, 333.33).maxAllowed).toBe(100);
  });

  test('rounds max allowed to 2 decimal places', () => {
    const result = validateCashAmount(0, 333.33);
    expect(result.maxAllowed).toBe(100);
  });
});

// ============================================================================
// calculateTransferDetails TESTS
// ============================================================================

describe('calculateTransferDetails', () => {
  test('calculates complete transfer for 5-star real player', () => {
    const result = calculateTransferDetails(225, 5, 192, 'real');
    
    expect(result.originalValue).toBe(225);
    expect(result.newValue).toBe(281.25); // 225 * 1.25
    expect(result.starMultiplier).toBe(1.25);
    expect(result.committeeFee).toBe(28.13); // 281.25 * 0.10
    expect(result.buyingTeamPays).toBe(309.38); // 281.25 + 28.13
    expect(result.sellingTeamReceives).toBe(253.12); // 281.25 - 28.13
    expect(result.pointsAdded).toBe(34); // (281.25 - 225) * 0.6 = 33.75 rounded to 34
    expect(result.newStarRating).toBe(6); // 192 + 34 = 226 points (6-star range: 210-239)
    expect(result.newSalary).toBe(1.97); // 281.25 * 0.007
  });

  test('calculates complete transfer for 3-star football player', () => {
    const result = calculateTransferDetails(100, 3, 120, 'football');
    
    expect(result.originalValue).toBe(100);
    expect(result.newValue).toBe(115); // 100 * 1.15
    expect(result.starMultiplier).toBe(1.15);
    expect(result.committeeFee).toBe(11.5); // 115 * 0.10
    expect(result.buyingTeamPays).toBe(126.5); // 115 + 11.5
    expect(result.sellingTeamReceives).toBe(103.5); // 115 - 11.5
    expect(result.pointsAdded).toBe(9); // (115 - 100) * 0.6 = 9
    expect(result.newStarRating).toBe(3); // 120 + 9 = 129 points (still 3-star)
    expect(result.newSalary).toBe(0.35); // 115 * 0.003
  });

  test('calculates transfer with star rating upgrade', () => {
    const result = calculateTransferDetails(200, 6, 235, 'real');
    
    expect(result.originalValue).toBe(200);
    expect(result.newValue).toBe(260); // 200 * 1.30
    expect(result.committeeFee).toBe(26); // 260 * 0.10
    expect(result.buyingTeamPays).toBe(286); // 260 + 26
    expect(result.sellingTeamReceives).toBe(234); // 260 - 26
    expect(result.pointsAdded).toBe(36); // (260 - 200) * 0.6 = 36
    expect(result.newStarRating).toBe(8); // 235 + 36 = 271 points (8-star range)
    expect(result.newSalary).toBe(1.82); // 260 * 0.007
  });

  test('calculates transfer for 10-star player at max rating', () => {
    const result = calculateTransferDetails(500, 10, 400, 'real');
    
    expect(result.originalValue).toBe(500);
    expect(result.newValue).toBe(750); // 500 * 1.50
    expect(result.starMultiplier).toBe(1.50);
    expect(result.committeeFee).toBe(75); // 750 * 0.10
    expect(result.buyingTeamPays).toBe(825); // 750 + 75
    expect(result.sellingTeamReceives).toBe(675); // 750 - 75
    expect(result.pointsAdded).toBe(150); // (750 - 500) * 0.6 = 150
    expect(result.newStarRating).toBe(10); // 400 + 150 = 550 points (still 10-star)
    expect(result.newSalary).toBe(5.25); // 750 * 0.007
  });

  test('calculates transfer with minimal value increase', () => {
    const result = calculateTransferDetails(50, 4, 160, 'football');
    
    expect(result.originalValue).toBe(50);
    expect(result.newValue).toBe(60); // 50 * 1.20
    expect(result.committeeFee).toBe(6); // 60 * 0.10
    expect(result.buyingTeamPays).toBe(66); // 60 + 6
    expect(result.sellingTeamReceives).toBe(54); // 60 - 6
    expect(result.pointsAdded).toBe(6); // (60 - 50) * 0.6 = 6
    expect(result.newStarRating).toBe(4); // 160 + 6 = 166 points (still 4-star)
    expect(result.newSalary).toBe(0.18); // 60 * 0.003
  });

  test('throws error for negative current value', () => {
    expect(() => calculateTransferDetails(-100, 5, 200, 'real'))
      .toThrow('Current value must be non-negative');
  });

  test('throws error for invalid star rating', () => {
    expect(() => calculateTransferDetails(100, 2, 200, 'real'))
      .toThrow('Star rating must be between 3 and 10');
    expect(() => calculateTransferDetails(100, 11, 200, 'real'))
      .toThrow('Star rating must be between 3 and 10');
  });

  test('throws error for negative current points', () => {
    expect(() => calculateTransferDetails(100, 5, -10, 'real'))
      .toThrow('Current points must be non-negative');
  });

  test('throws error for invalid player type', () => {
    // @ts-expect-error Testing invalid input
    expect(() => calculateTransferDetails(100, 5, 200, 'invalid'))
      .toThrow('Player type must be either "real" or "football"');
  });

  test('handles zero value correctly', () => {
    const result = calculateTransferDetails(0, 5, 180, 'real');
    
    expect(result.originalValue).toBe(0);
    expect(result.newValue).toBe(0);
    expect(result.committeeFee).toBe(0);
    expect(result.buyingTeamPays).toBe(0);
    expect(result.sellingTeamReceives).toBe(0);
    expect(result.pointsAdded).toBe(0);
    expect(result.newStarRating).toBe(5);
    expect(result.newSalary).toBe(0);
  });

  test('calculates correctly for all star ratings', () => {
    const testValue = 200;
    const testPoints = 200;
    
    // Test each star rating
    const result3 = calculateTransferDetails(testValue, 3, testPoints, 'real');
    expect(result3.newValue).toBe(230); // 115%
    expect(result3.starMultiplier).toBe(1.15);
    
    const result4 = calculateTransferDetails(testValue, 4, testPoints, 'real');
    expect(result4.newValue).toBe(240); // 120%
    expect(result4.starMultiplier).toBe(1.20);
    
    const result5 = calculateTransferDetails(testValue, 5, testPoints, 'real');
    expect(result5.newValue).toBe(250); // 125%
    expect(result5.starMultiplier).toBe(1.25);
    
    const result6 = calculateTransferDetails(testValue, 6, testPoints, 'real');
    expect(result6.newValue).toBe(260); // 130%
    expect(result6.starMultiplier).toBe(1.30);
    
    const result7 = calculateTransferDetails(testValue, 7, testPoints, 'real');
    expect(result7.newValue).toBe(270); // 135%
    expect(result7.starMultiplier).toBe(1.35);
    
    const result8 = calculateTransferDetails(testValue, 8, testPoints, 'real');
    expect(result8.newValue).toBe(280); // 140%
    expect(result8.starMultiplier).toBe(1.40);
    
    const result9 = calculateTransferDetails(testValue, 9, testPoints, 'real');
    expect(result9.newValue).toBe(290); // 145%
    expect(result9.starMultiplier).toBe(1.45);
    
    const result10 = calculateTransferDetails(testValue, 10, testPoints, 'real');
    expect(result10.newValue).toBe(300); // 150%
    expect(result10.starMultiplier).toBe(1.50);
  });

  test('verifies financial calculations are balanced', () => {
    const result = calculateTransferDetails(300, 7, 250, 'real');
    
    // The committee fee should be the difference between what buyer pays and seller receives
    const calculatedFee = result.buyingTeamPays - result.sellingTeamReceives;
    expect(calculatedFee).toBeCloseTo(result.committeeFee * 2, 1);
    
    // New value should be the midpoint
    const midpoint = (result.buyingTeamPays + result.sellingTeamReceives) / 2;
    expect(midpoint).toBeCloseTo(result.newValue, 1);
  });
});

// ============================================================================
// calculateSwapDetails TESTS
// ============================================================================

describe('calculateSwapDetails', () => {
  test('calculates complete swap without cash', () => {
    const playerA = { value: 225, starRating: 5, points: 192, type: 'real' as const };
    const playerB = { value: 300, starRating: 6, points: 220, type: 'football' as const };
    
    const result = calculateSwapDetails(playerA, playerB, 0, 'none');
    
    // Player A calculations
    expect(result.playerA.originalValue).toBe(225);
    expect(result.playerA.newValue).toBe(281.25); // 225 * 1.25
    expect(result.playerA.starMultiplier).toBe(1.25);
    expect(result.playerA.committeeFee).toBe(50); // 5-star fee
    expect(result.playerA.pointsAdded).toBe(34); // (281.25 - 225) * 0.6 = 33.75 rounded to 34
    expect(result.playerA.newStarRating).toBe(6); // 192 + 34 = 226 points
    expect(result.playerA.newSalary).toBe(1.97); // 281.25 * 0.007
    
    // Player B calculations
    expect(result.playerB.originalValue).toBe(300);
    expect(result.playerB.newValue).toBe(390); // 300 * 1.30
    expect(result.playerB.starMultiplier).toBe(1.30);
    expect(result.playerB.committeeFee).toBe(60); // 6-star fee
    expect(result.playerB.pointsAdded).toBe(54); // (390 - 300) * 0.6 = 54
    expect(result.playerB.newStarRating).toBe(8); // 220 + 54 = 274 points
    expect(result.playerB.newSalary).toBe(1.17); // 390 * 0.003
    
    // Financial calculations
    expect(result.cashAmount).toBe(0);
    expect(result.cashDirection).toBe('none');
    expect(result.teamAPays).toBe(60); // Player B's fee (Team A receives Player B)
    expect(result.teamBPays).toBe(50); // Player A's fee (Team B receives Player A)
    expect(result.totalCommitteeFees).toBe(110); // 50 + 60
  });

  test('calculates swap with cash from Team A to Team B', () => {
    const playerA = { value: 200, starRating: 4, points: 160, type: 'real' as const };
    const playerB = { value: 300, starRating: 6, points: 220, type: 'football' as const };
    const cashAmount = 50;
    
    const result = calculateSwapDetails(playerA, playerB, cashAmount, 'A_to_B');
    
    // Player A calculations
    expect(result.playerA.originalValue).toBe(200);
    expect(result.playerA.newValue).toBe(240); // 200 * 1.20
    expect(result.playerA.committeeFee).toBe(40); // 4-star fee
    
    // Player B calculations
    expect(result.playerB.originalValue).toBe(300);
    expect(result.playerB.newValue).toBe(390); // 300 * 1.30
    expect(result.playerB.committeeFee).toBe(60); // 6-star fee
    
    // Financial calculations with cash
    expect(result.cashAmount).toBe(50);
    expect(result.cashDirection).toBe('A_to_B');
    expect(result.teamAPays).toBe(110); // 60 (Player B's fee) + 50 (cash)
    expect(result.teamBPays).toBe(40); // 40 (Player A's fee)
    expect(result.totalCommitteeFees).toBe(100); // 40 + 60
  });

  test('calculates swap with cash from Team B to Team A', () => {
    const playerA = { value: 400, starRating: 7, points: 250, type: 'real' as const };
    const playerB = { value: 200, starRating: 4, points: 160, type: 'football' as const };
    const cashAmount = 60;
    
    const result = calculateSwapDetails(playerA, playerB, cashAmount, 'B_to_A');
    
    // Player A calculations
    expect(result.playerA.originalValue).toBe(400);
    expect(result.playerA.newValue).toBe(540); // 400 * 1.35
    expect(result.playerA.committeeFee).toBe(70); // 7-star fee
    
    // Player B calculations
    expect(result.playerB.originalValue).toBe(200);
    expect(result.playerB.newValue).toBe(240); // 200 * 1.20
    expect(result.playerB.committeeFee).toBe(40); // 4-star fee
    
    // Financial calculations with cash
    expect(result.cashAmount).toBe(60);
    expect(result.cashDirection).toBe('B_to_A');
    expect(result.teamAPays).toBe(40); // 40 (Player B's fee)
    expect(result.teamBPays).toBe(130); // 70 (Player A's fee) + 60 (cash)
    expect(result.totalCommitteeFees).toBe(110); // 70 + 40
  });

  test('calculates swap with maximum 30% cash', () => {
    const playerA = { value: 300, starRating: 5, points: 190, type: 'real' as const };
    const playerB = { value: 400, starRating: 7, points: 250, type: 'football' as const };
    const maxCash = 120; // 30% of 400
    
    const result = calculateSwapDetails(playerA, playerB, maxCash, 'A_to_B');
    
    expect(result.cashAmount).toBe(120);
    expect(result.cashDirection).toBe('A_to_B');
    expect(result.teamAPays).toBe(190); // 70 (Player B's fee) + 120 (cash)
    expect(result.teamBPays).toBe(50); // 50 (Player A's fee)
  });

  test('calculates swap with star rating upgrades', () => {
    const playerA = { value: 200, starRating: 5, points: 205, type: 'real' as const };
    const playerB = { value: 250, starRating: 6, points: 235, type: 'football' as const };
    
    const result = calculateSwapDetails(playerA, playerB, 0, 'none');
    
    // Player A: 200 * 1.25 = 250, increase = 50, points added = 30, new points = 235 (6-star)
    expect(result.playerA.newValue).toBe(250);
    expect(result.playerA.pointsAdded).toBe(30);
    expect(result.playerA.newStarRating).toBe(6); // Upgraded from 5 to 6
    
    // Player B: 250 * 1.30 = 325, increase = 75, points added = 45, new points = 280 (8-star)
    expect(result.playerB.newValue).toBe(325);
    expect(result.playerB.pointsAdded).toBe(45);
    expect(result.playerB.newStarRating).toBe(8); // Upgraded from 6 to 8
  });

  test('calculates swap for 3-star and 10-star players', () => {
    const playerA = { value: 100, starRating: 3, points: 120, type: 'real' as const };
    const playerB = { value: 500, starRating: 10, points: 400, type: 'football' as const };
    
    const result = calculateSwapDetails(playerA, playerB, 0, 'none');
    
    // Player A: 3-star
    expect(result.playerA.newValue).toBe(115); // 100 * 1.15
    expect(result.playerA.committeeFee).toBe(30); // 3-star fee
    expect(result.playerA.newSalary).toBe(0.81); // 115 * 0.007
    
    // Player B: 10-star
    expect(result.playerB.newValue).toBe(750); // 500 * 1.50
    expect(result.playerB.committeeFee).toBe(100); // 10-star fee
    expect(result.playerB.newSalary).toBe(2.25); // 750 * 0.003
    
    // Financial
    expect(result.teamAPays).toBe(100); // 10-star fee
    expect(result.teamBPays).toBe(30); // 3-star fee
    expect(result.totalCommitteeFees).toBe(130);
  });

  test('calculates swap with both players same star rating', () => {
    const playerA = { value: 200, starRating: 5, points: 190, type: 'real' as const };
    const playerB = { value: 250, starRating: 5, points: 195, type: 'football' as const };
    
    const result = calculateSwapDetails(playerA, playerB, 0, 'none');
    
    // Both have same star rating, so same committee fee
    expect(result.playerA.committeeFee).toBe(50);
    expect(result.playerB.committeeFee).toBe(50);
    expect(result.teamAPays).toBe(50);
    expect(result.teamBPays).toBe(50);
    expect(result.totalCommitteeFees).toBe(100);
  });

  test('calculates new salaries correctly for different player types', () => {
    const playerA = { value: 300, starRating: 6, points: 220, type: 'real' as const };
    const playerB = { value: 300, starRating: 6, points: 220, type: 'football' as const };
    
    const result = calculateSwapDetails(playerA, playerB, 0, 'none');
    
    // Both have same value and star rating, but different salary rates
    expect(result.playerA.newValue).toBe(390); // 300 * 1.30
    expect(result.playerB.newValue).toBe(390); // 300 * 1.30
    expect(result.playerA.newSalary).toBe(2.73); // 390 * 0.007 (real player)
    expect(result.playerB.newSalary).toBe(1.17); // 390 * 0.003 (football player)
  });

  test('throws error for negative player values', () => {
    const playerA = { value: -100, starRating: 5, points: 190, type: 'real' as const };
    const playerB = { value: 300, starRating: 6, points: 220, type: 'football' as const };
    
    expect(() => calculateSwapDetails(playerA, playerB, 0, 'none'))
      .toThrow('Player values must be non-negative');
  });

  test('throws error for invalid star ratings', () => {
    const playerA = { value: 200, starRating: 2, points: 190, type: 'real' as const };
    const playerB = { value: 300, starRating: 6, points: 220, type: 'football' as const };
    
    expect(() => calculateSwapDetails(playerA, playerB, 0, 'none'))
      .toThrow('Star ratings must be between 3 and 10');
  });

  test('throws error for negative points', () => {
    const playerA = { value: 200, starRating: 5, points: -10, type: 'real' as const };
    const playerB = { value: 300, starRating: 6, points: 220, type: 'football' as const };
    
    expect(() => calculateSwapDetails(playerA, playerB, 0, 'none'))
      .toThrow('Player points must be non-negative');
  });

  test('throws error for negative cash amount', () => {
    const playerA = { value: 200, starRating: 5, points: 190, type: 'real' as const };
    const playerB = { value: 300, starRating: 6, points: 220, type: 'football' as const };
    
    expect(() => calculateSwapDetails(playerA, playerB, -50, 'A_to_B'))
      .toThrow('Cash amount must be non-negative');
  });

  test('throws error for invalid cash direction', () => {
    const playerA = { value: 200, starRating: 5, points: 190, type: 'real' as const };
    const playerB = { value: 300, starRating: 6, points: 220, type: 'football' as const };
    
    // @ts-expect-error Testing invalid input
    expect(() => calculateSwapDetails(playerA, playerB, 50, 'invalid'))
      .toThrow('Cash direction must be "A_to_B", "B_to_A", or "none"');
  });

  test('throws error when cash exceeds 30% limit', () => {
    const playerA = { value: 200, starRating: 5, points: 190, type: 'real' as const };
    const playerB = { value: 300, starRating: 6, points: 220, type: 'football' as const };
    const excessiveCash = 100; // 30% of 300 is 90, so 100 exceeds limit
    
    expect(() => calculateSwapDetails(playerA, playerB, excessiveCash, 'A_to_B'))
      .toThrow(/Cash amount.*exceeds 30% limit/);
  });

  test('handles zero value players', () => {
    const playerA = { value: 0, starRating: 3, points: 100, type: 'real' as const };
    const playerB = { value: 0, starRating: 3, points: 100, type: 'football' as const };
    
    const result = calculateSwapDetails(playerA, playerB, 0, 'none');
    
    expect(result.playerA.newValue).toBe(0);
    expect(result.playerB.newValue).toBe(0);
    expect(result.playerA.newSalary).toBe(0);
    expect(result.playerB.newSalary).toBe(0);
    expect(result.teamAPays).toBe(30); // Still pay committee fees
    expect(result.teamBPays).toBe(30);
  });

  test('rounds all financial values to 2 decimal places', () => {
    const playerA = { value: 333.33, starRating: 5, points: 190, type: 'real' as const };
    const playerB = { value: 666.67, starRating: 7, points: 250, type: 'football' as const };
    
    const result = calculateSwapDetails(playerA, playerB, 33.33, 'A_to_B');
    
    // Check all values are properly rounded
    expect(result.playerA.newValue).toBe(416.66);
    expect(result.playerB.newValue).toBe(900);
    expect(result.playerA.newSalary).toBe(2.92);
    expect(result.playerB.newSalary).toBe(2.7);
    expect(result.teamAPays).toBe(103.33); // 70 + 33.33
    expect(result.teamBPays).toBe(50);
  });

  test('calculates correctly when cash equals exactly 30%', () => {
    const playerA = { value: 200, starRating: 5, points: 190, type: 'real' as const };
    const playerB = { value: 300, starRating: 6, points: 220, type: 'football' as const };
    const exactCash = 90; // Exactly 30% of 300
    
    const result = calculateSwapDetails(playerA, playerB, exactCash, 'A_to_B');
    
    expect(result.cashAmount).toBe(90);
    expect(result.teamAPays).toBe(150); // 60 + 90
    expect(result.teamBPays).toBe(50);
  });

  test('verifies committee fees are based on original star ratings', () => {
    // Even if players upgrade, fees are based on their original star ratings
    const playerA = { value: 200, starRating: 5, points: 205, type: 'real' as const };
    const playerB = { value: 250, starRating: 6, points: 235, type: 'football' as const };
    
    const result = calculateSwapDetails(playerA, playerB, 0, 'none');
    
    // Player A upgrades to 6-star, but fee is still based on original 5-star
    expect(result.playerA.newStarRating).toBe(6);
    expect(result.playerA.committeeFee).toBe(50); // 5-star fee, not 6-star
    
    // Player B upgrades to 8-star, but fee is still based on original 6-star
    expect(result.playerB.newStarRating).toBe(8);
    expect(result.playerB.committeeFee).toBe(60); // 6-star fee, not 8-star
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('Integration: Complete Transfer Calculation', () => {
  test('calculates complete transfer for 5-star player', () => {
    const currentValue = 225;
    const starRating = 5;
    
    // Step 1: Calculate new value
    const newValue = calculateNewValue(currentValue, starRating);
    expect(newValue).toBe(281.25); // 225 * 1.25
    
    // Step 2: Calculate committee fee
    const fee = calculateCommitteeFee(newValue);
    expect(fee).toBe(28.13); // 281.25 * 0.10
    
    // Step 3: Calculate amounts
    const buyingTeamPays = newValue + fee;
    const sellingTeamReceives = newValue - fee;
    expect(buyingTeamPays).toBe(309.38);
    expect(sellingTeamReceives).toBe(253.12);
  });

  test('calculates complete swap with star upgrades', () => {
    // Player A: 6-star, 300 value, 220 points
    const playerAValue = 300;
    const playerAStarRating = 6;
    const playerAPoints = 220;
    
    // Player B: 5-star, 250 value, 190 points
    const playerBValue = 250;
    const playerBStarRating = 5;
    const playerBPoints = 190;
    
    // Calculate new values
    const playerANewValue = calculateNewValue(playerAValue, playerAStarRating);
    const playerBNewValue = calculateNewValue(playerBValue, playerBStarRating);
    expect(playerANewValue).toBe(390); // 300 * 1.30
    expect(playerBNewValue).toBe(312.5); // 250 * 1.25
    
    // Calculate star upgrades
    const playerAUpgrade = calculateNewStarRating(playerAPoints, playerANewValue - playerAValue);
    const playerBUpgrade = calculateNewStarRating(playerBPoints, playerBNewValue - playerBValue);
    expect(playerAUpgrade.newPoints).toBe(274); // 220 + (90 * 0.6) = 220 + 54
    expect(playerAUpgrade.newStarRating).toBe(8); // Upgraded from 6 to 8
    expect(playerBUpgrade.newPoints).toBe(228); // 190 + (62.5 * 0.6) = 190 + 37.5 rounded to 38
    expect(playerBUpgrade.newStarRating).toBe(6); // Upgraded from 5 to 6
    
    // Calculate swap fees
    const teamAFee = getSwapFee(playerBStarRating); // Fee for player they're receiving
    const teamBFee = getSwapFee(playerAStarRating);
    expect(teamAFee).toBe(50); // 5-star fee
    expect(teamBFee).toBe(60); // 6-star fee
    
    // Calculate new salaries
    const playerANewSalary = calculateSalary(playerANewValue, 'real');
    const playerBNewSalary = calculateSalary(playerBNewValue, 'football');
    expect(playerANewSalary).toBe(2.73); // 390 * 0.007
    expect(playerBNewSalary).toBe(0.94); // 312.5 * 0.003
  });

  test('complete swap calculation using calculateSwapDetails', () => {
    const playerA = { value: 300, starRating: 6, points: 220, type: 'real' as const };
    const playerB = { value: 250, starRating: 5, points: 190, type: 'football' as const };
    
    const result = calculateSwapDetails(playerA, playerB, 50, 'A_to_B');
    
    // Verify all calculations are consistent
    expect(result.playerA.newValue).toBe(390);
    expect(result.playerB.newValue).toBe(312.5);
    expect(result.playerA.newStarRating).toBe(8);
    expect(result.playerB.newStarRating).toBe(6);
    expect(result.teamAPays).toBe(100); // 50 (fee) + 50 (cash)
    expect(result.teamBPays).toBe(60); // 60 (fee)
    expect(result.totalCommitteeFees).toBe(110); // 60 + 50
  });
});
