/**
 * Multi-Season Team Operations
 * 
 * Helper functions for managing teams in multi-season format (Season 16+)
 */

import {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp,
  increment,
  writeBatch,
} from 'firebase/firestore';
import { db } from './config';
import { TeamData } from '@/types/team';
import { Season } from '@/types/season';

/**
 * Initialize team with dual currency balances for multi-season
 */
export async function initializeMultiSeasonTeam(
  teamId: string,
  season: Season
): Promise<void> {
  try {
    const teamRef = doc(db, 'teams', teamId);
    const teamDoc = await getDoc(teamRef);
    
    if (!teamDoc.exists()) {
      throw new Error('Team not found');
    }
    
    if (season.type !== 'multi') {
      throw new Error('Season is not multi-season type');
    }
    
    // Initialize dual balances
    await updateDoc(teamRef, {
      dollar_balance: season.dollar_budget || 1000,
      euro_balance: season.euro_budget || 10000,
      dollar_spent: 0,
      euro_spent: 0,
      dollar_salaries_committed: 0,
      euro_salaries_committed: 0,
      updatedAt: serverTimestamp(),
    });
  } catch (error: any) {
    console.error('Error initializing multi-season team:', error);
    throw new Error(error.message || 'Failed to initialize multi-season team');
  }
}

/**
 * Deduct amount from team's dollar balance
 */
export async function deductDollarBalance(
  teamId: string,
  amount: number
): Promise<void> {
  try {
    const teamRef = doc(db, 'teams', teamId);
    await updateDoc(teamRef, {
      dollar_balance: increment(-amount),
      dollar_spent: increment(amount),
      updatedAt: serverTimestamp(),
    });
  } catch (error: any) {
    console.error('Error deducting dollar balance:', error);
    throw new Error(error.message || 'Failed to deduct dollar balance');
  }
}

/**
 * Deduct amount from team's euro balance
 */
export async function deductEuroBalance(
  teamId: string,
  amount: number
): Promise<void> {
  try {
    const teamRef = doc(db, 'teams', teamId);
    await updateDoc(teamRef, {
      euro_balance: increment(-amount),
      euro_spent: increment(amount),
      updatedAt: serverTimestamp(),
    });
  } catch (error: any) {
    console.error('Error deducting euro balance:', error);
    throw new Error(error.message || 'Failed to deduct euro balance');
  }
}

/**
 * Add to team's dollar salaries committed
 */
export async function addDollarSalaryCommitment(
  teamId: string,
  salaryAmount: number
): Promise<void> {
  try {
    const teamRef = doc(db, 'teams', teamId);
    await updateDoc(teamRef, {
      dollar_salaries_committed: increment(salaryAmount),
      updatedAt: serverTimestamp(),
    });
  } catch (error: any) {
    console.error('Error adding dollar salary commitment:', error);
    throw new Error(error.message || 'Failed to add dollar salary commitment');
  }
}

/**
 * Add to team's euro salaries committed
 */
export async function addEuroSalaryCommitment(
  teamId: string,
  salaryAmount: number
): Promise<void> {
  try {
    const teamRef = doc(db, 'teams', teamId);
    await updateDoc(teamRef, {
      euro_salaries_committed: increment(salaryAmount),
      updatedAt: serverTimestamp(),
    });
  } catch (error: any) {
    console.error('Error adding euro salary commitment:', error);
    throw new Error(error.message || 'Failed to add euro salary commitment');
  }
}

/**
 * Get team's current balances
 */
export async function getTeamBalances(teamId: string): Promise<{
  dollar_balance: number;
  euro_balance: number;
  dollar_spent: number;
  euro_spent: number;
  dollar_salaries_committed: number;
  euro_salaries_committed: number;
}> {
  try {
    const teamRef = doc(db, 'teams', teamId);
    const teamDoc = await getDoc(teamRef);
    
    if (!teamDoc.exists()) {
      throw new Error('Team not found');
    }
    
    const data = teamDoc.data() as TeamData;
    
    return {
      dollar_balance: data.dollar_balance || 0,
      euro_balance: data.euro_balance || 0,
      dollar_spent: data.dollar_spent || 0,
      euro_spent: data.euro_spent || 0,
      dollar_salaries_committed: data.dollar_salaries_committed || 0,
      euro_salaries_committed: data.euro_salaries_committed || 0,
    };
  } catch (error: any) {
    console.error('Error getting team balances:', error);
    throw new Error(error.message || 'Failed to get team balances');
  }
}

/**
 * Check if team has sufficient dollar balance
 */
export async function hasEnoughDollarBalance(
  teamId: string,
  amount: number
): Promise<boolean> {
  try {
    const balances = await getTeamBalances(teamId);
    return balances.dollar_balance >= amount;
  } catch (error) {
    return false;
  }
}

/**
 * Check if team has sufficient euro balance
 */
export async function hasEnoughEuroBalance(
  teamId: string,
  amount: number
): Promise<boolean> {
  try {
    const balances = await getTeamBalances(teamId);
    return balances.euro_balance >= amount;
  } catch (error) {
    return false;
  }
}

/**
 * Batch deduct salaries from all teams at mid-season
 * For football players: deduct half-season salary from euro balance
 */
export async function deductMidSeasonSalaries(
  seasonId: string
): Promise<{ success: number; failed: number }> {
  try {
    const batch = writeBatch(db);
    let successCount = 0;
    let failedCount = 0;
    
    // This would need to be implemented based on your team/player structure
    // For now, returning placeholder
    console.log('Mid-season salary deduction for season:', seasonId);
    
    // Implementation would:
    // 1. Get all teams in season
    // 2. For each team, get all football players
    // 3. Calculate total euro salaries
    // 4. Deduct from euro_balance
    
    return { success: successCount, failed: failedCount };
  } catch (error: any) {
    console.error('Error deducting mid-season salaries:', error);
    throw new Error(error.message || 'Failed to deduct mid-season salaries');
  }
}

/**
 * Reset team's salary commitments (used when all players removed)
 */
export async function resetSalaryCommitments(teamId: string): Promise<void> {
  try {
    const teamRef = doc(db, 'teams', teamId);
    await updateDoc(teamRef, {
      dollar_salaries_committed: 0,
      euro_salaries_committed: 0,
      updatedAt: serverTimestamp(),
    });
  } catch (error: any) {
    console.error('Error resetting salary commitments:', error);
    throw new Error(error.message || 'Failed to reset salary commitments');
  }
}
