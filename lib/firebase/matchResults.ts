import { db } from './config';
import {
  doc,
  getDoc,
  updateDoc,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import { getISTNow } from '../utils/timezone';
import {
  updateRealPlayerAfterMatch,
  recalculateTeamCategories,
  validateMatchLineup,
} from '../contracts';

/**
 * Process match result with multi-season contract logic
 * - Deducts real player salaries from dollarBalance
 * - Updates player points and star ratings
 * - Recalculates player categories
 * - Applies lineup violation fines if needed
 */
export async function processMatchResultWithContracts(
  matchId: string,
  homeTeamId: string,
  awayTeamId: string,
  homeScore: number,
  awayScore: number,
  seasonId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get season to check if it's multi-season type
    const seasonRef = doc(db, 'seasons', seasonId);
    const seasonDoc = await getDoc(seasonRef);
    
    if (!seasonDoc.exists()) {
      return { success: false, error: 'Season not found' };
    }
    
    const season = seasonDoc.data();
    const isMultiSeason = season.type === 'multi';
    
    if (!isMultiSeason) {
      // For single-season, just return success (no additional processing)
      return { success: true };
    }
    
    // Multi-season processing
    const batch = writeBatch(db);
    const categoryFine = season.category_fine_amount || 20;
    const categoryFineCurrency = season.category_fine_currency || 'dollar'; // Default to dollar
    
    // Process home team
    const homeTeamRef = doc(db, 'teams', homeTeamId);
    const homeTeamDoc = await getDoc(homeTeamRef);
    
    if (homeTeamDoc.exists()) {
      const homeTeamData = homeTeamDoc.data();
      const homeRealPlayers = homeTeamData.real_players || [];
      const goalDifference = homeScore - awayScore;
      
      let totalSalaryDeducted = 0;
      const updatedHomePlayers = [];
      
      // Process each real player
      for (const player of homeRealPlayers) {
        // Deduct salary
        const salary = player.salaryPerMatch || 0;
        totalSalaryDeducted += salary;
        
        // Update player points and star rating
        const updatedPlayer = updateRealPlayerAfterMatch(player, goalDifference);
        updatedHomePlayers.push(updatedPlayer);
      }
      
      // Recalculate categories based on new points
      const playersWithCategories = recalculateTeamCategories(updatedHomePlayers);
      
      // Validate lineup (check if category requirements were met)
      const lineupValid = validateMatchLineup(playersWithCategories);
      const lineupFine = lineupValid ? 0 : categoryFine;
      
      // Update team - deduct salary and fine from appropriate balances
      const newDollarBalance = (homeTeamData.dollarBalance || 0) - totalSalaryDeducted;
      const updateData: any = {
        real_players: playersWithCategories,
        dollarBalance: newDollarBalance,
        updated_at: Timestamp.fromDate(getISTNow()),
      };
      
      // Deduct fine from the specified currency
      if (lineupFine > 0) {
        if (categoryFineCurrency === 'euro') {
          updateData.euroBalance = (homeTeamData.euroBalance || 0) - lineupFine;
        } else {
          updateData.dollarBalance = newDollarBalance - lineupFine;
        }
      }
      
      batch.update(homeTeamRef, updateData);
    }
    
    // Process away team
    const awayTeamRef = doc(db, 'teams', awayTeamId);
    const awayTeamDoc = await getDoc(awayTeamRef);
    
    if (awayTeamDoc.exists()) {
      const awayTeamData = awayTeamDoc.data();
      const awayRealPlayers = awayTeamData.real_players || [];
      const goalDifference = awayScore - homeScore;
      
      let totalSalaryDeducted = 0;
      const updatedAwayPlayers = [];
      
      // Process each real player
      for (const player of awayRealPlayers) {
        // Deduct salary
        const salary = player.salaryPerMatch || 0;
        totalSalaryDeducted += salary;
        
        // Update player points and star rating
        const updatedPlayer = updateRealPlayerAfterMatch(player, goalDifference);
        updatedAwayPlayers.push(updatedPlayer);
      }
      
      // Recalculate categories based on new points
      const playersWithCategories = recalculateTeamCategories(updatedAwayPlayers);
      
      // Validate lineup (check if category requirements were met)
      const lineupValid = validateMatchLineup(playersWithCategories);
      const lineupFine = lineupValid ? 0 : categoryFine;
      
      // Update team - deduct salary and fine from appropriate balances
      const newDollarBalance = (awayTeamData.dollarBalance || 0) - totalSalaryDeducted;
      const updateData: any = {
        real_players: playersWithCategories,
        dollarBalance: newDollarBalance,
        updated_at: Timestamp.fromDate(getISTNow()),
      };
      
      // Deduct fine from the specified currency
      if (lineupFine > 0) {
        if (categoryFineCurrency === 'euro') {
          updateData.euroBalance = (awayTeamData.euroBalance || 0) - lineupFine;
        } else {
          updateData.dollarBalance = newDollarBalance - lineupFine;
        }
      }
      
      batch.update(awayTeamRef, updateData);
    }
    
    // Commit all updates
    await batch.commit();
    
    return { success: true };
  } catch (error) {
    console.error('Error processing match result with contracts:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to process match result' 
    };
  }
}

/**
 * Simplified version for API route usage
 */
export async function processMatchResult(data: {
  matchId: string;
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number;
  awayScore: number;
  seasonId: string;
}): Promise<{ success: boolean; error?: string }> {
  return processMatchResultWithContracts(
    data.matchId,
    data.homeTeamId,
    data.awayTeamId,
    data.homeScore,
    data.awayScore,
    data.seasonId
  );
}
