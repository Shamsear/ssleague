/**
 * Multi-Season Player Operations
 * 
 * Functions for assigning players with contracts, salaries, and managing
 * points/categories for multi-season system (Season 16+)
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from './config';
import { RealPlayerData } from '@/types/realPlayer';
import { FootballPlayerData } from '@/types/footballPlayer';
import {
  createRealPlayerContract,
  createFootballPlayerContract,
  AssignRealPlayerContractData,
  AssignFootballPlayerContractData,
  updatePlayerPoints,
  calculateStarRating,
  updateAllPlayerCategories,
  calculateTeamRealPlayerSalaries,
} from '../contracts';
import {
  deductDollarBalance,
  deductEuroBalance,
  addDollarSalaryCommitment,
  addEuroSalaryCommitment,
  hasEnoughDollarBalance,
  hasEnoughEuroBalance,
} from './multiSeasonTeams';

/**
 * Assign real player to team with contract (from WhatsApp auction)
 */
export async function assignRealPlayerWithContract(
  data: AssignRealPlayerContractData
): Promise<void> {
  try {
    const { playerId, teamId, starRating, auctionValue, startSeasonId } = data;
    
    // Check if team has enough balance
    const hasBalance = await hasEnoughDollarBalance(teamId, auctionValue);
    if (!hasBalance) {
      throw new Error('Insufficient dollar balance');
    }
    
    // Create contract data
    const contractData = createRealPlayerContract(data);
    
    // Update player with contract
    const playerRef = doc(db, 'realplayers', playerId);
    await updateDoc(playerRef, {
      ...contractData,
      updated_at: serverTimestamp(),
    });
    
    // Deduct auction value from team balance
    await deductDollarBalance(teamId, auctionValue);
    
    // Add salary commitment
    await addDollarSalaryCommitment(teamId, contractData.salary_per_match!);
    
    // Update team's real_players array
    const teamRef = doc(db, 'teams', teamId);
    const teamDoc = await getDoc(teamRef);
    
    if (teamDoc.exists()) {
      const teamData = teamDoc.data();
      const realPlayers = teamData.real_players || [];
      
      if (!realPlayers.includes(playerId)) {
        realPlayers.push(playerId);
        await updateDoc(teamRef, {
          real_players: realPlayers,
          real_players_count: realPlayers.length,
          updatedAt: serverTimestamp(),
        });
      }
    }
    
    // Recalculate all player categories league-wide
    await recalculatePlayerCategories(startSeasonId);
    
  } catch (error: any) {
    console.error('Error assigning real player with contract:', error);
    throw new Error(error.message || 'Failed to assign real player with contract');
  }
}

/**
 * Assign football player to team with contract (from in-app auction)
 */
export async function assignFootballPlayerWithContract(
  data: AssignFootballPlayerContractData
): Promise<void> {
  try {
    const { playerId, teamId, auctionValue, startSeasonId } = data;
    
    // Check if team has enough balance
    const hasBalance = await hasEnoughEuroBalance(teamId, auctionValue);
    if (!hasBalance) {
      throw new Error('Insufficient euro balance');
    }
    
    // Create contract data
    const contractData = createFootballPlayerContract(data);
    
    // Update player with contract
    const playerRef = doc(db, 'footballplayers', playerId);
    await updateDoc(playerRef, {
      ...contractData,
      updated_at: serverTimestamp(),
    });
    
    // Deduct auction value from team balance
    await deductEuroBalance(teamId, auctionValue);
    
    // Add salary commitment
    await addEuroSalaryCommitment(teamId, contractData.salary_per_half_season!);
    
    // Update team's football_players array
    const teamRef = doc(db, 'teams', teamId);
    const teamDoc = await getDoc(teamRef);
    
    if (teamDoc.exists()) {
      const teamData = teamDoc.data();
      const footballPlayers = teamData.football_players || [];
      
      if (!footballPlayers.includes(playerId)) {
        footballPlayers.push(playerId);
        await updateDoc(teamRef, {
          football_players: footballPlayers,
          football_players_count: footballPlayers.length,
          updatedAt: serverTimestamp(),
        });
      }
    }
    
  } catch (error: any) {
    console.error('Error assigning football player with contract:', error);
    throw new Error(error.message || 'Failed to assign football player with contract');
  }
}

/**
 * Update real player points after match and deduct salary
 */
export async function updateRealPlayerAfterMatch(
  playerId: string,
  teamId: string,
  goalDifference: number
): Promise<void> {
  try {
    const playerRef = doc(db, 'realplayers', playerId);
    const playerDoc = await getDoc(playerRef);
    
    if (!playerDoc.exists()) {
      throw new Error('Player not found');
    }
    
    const playerData = playerDoc.data() as RealPlayerData;
    
    // Update points
    const currentPoints = playerData.points || 0;
    const newPoints = updatePlayerPoints(currentPoints, goalDifference);
    
    // Recalculate star rating based on new points
    const newStarRating = calculateStarRating(newPoints);
    
    // Update player
    await updateDoc(playerRef, {
      points: newPoints,
      star_rating: newStarRating,
      updated_at: serverTimestamp(),
    });
    
    // Deduct salary from team's dollar balance
    const salaryPerMatch = playerData.salary_per_match || 0;
    if (salaryPerMatch > 0) {
      await deductDollarBalance(teamId, salaryPerMatch);
    }
    
  } catch (error: any) {
    console.error('Error updating real player after match:', error);
    throw new Error(error.message || 'Failed to update real player after match');
  }
}

/**
 * Recalculate all player categories league-wide for a season
 */
export async function recalculatePlayerCategories(
  seasonId: string
): Promise<void> {
  try {
    // Get all real players in the season (those with active contracts)
    const playersRef = collection(db, 'realplayers');
    const q = query(
      playersRef,
      where('contract_start_season', '<=', seasonId),
      where('contract_status', '==', 'active')
    );
    
    const querySnapshot = await getDocs(q);
    const players: RealPlayerData[] = [];
    
    querySnapshot.forEach((doc) => {
      players.push({ id: doc.id, ...doc.data() } as RealPlayerData);
    });
    
    // Calculate new categories
    const categoryMap = updateAllPlayerCategories(players);
    
    // Update all players with new categories
    const batch = writeBatch(db);
    
    players.forEach((player) => {
      const newCategory = categoryMap.get(player.id);
      if (newCategory && newCategory !== player.category) {
        const playerRef = doc(db, 'realplayers', player.id);
        batch.update(playerRef, {
          category: newCategory,
          updated_at: serverTimestamp(),
        });
      }
    });
    
    await batch.commit();
    
  } catch (error: any) {
    console.error('Error recalculating player categories:', error);
    throw new Error(error.message || 'Failed to recalculate player categories');
  }
}

/**
 * Process match result for all real players
 */
export async function processMatchForRealPlayers(
  teamAId: string,
  teamBId: string,
  teamAScore: number,
  teamBScore: number,
  teamAPlayerIds: string[],
  teamBPlayerIds: string[]
): Promise<void> {
  try {
    const teamAGD = teamAScore - teamBScore;
    const teamBGD = teamBScore - teamAScore;
    
    // Update team A players
    for (const playerId of teamAPlayerIds) {
      await updateRealPlayerAfterMatch(playerId, teamAId, teamAGD);
    }
    
    // Update team B players
    for (const playerId of teamBPlayerIds) {
      await updateRealPlayerAfterMatch(playerId, teamBId, teamBGD);
    }
    
    // Recalculate categories after all updates
    // Assuming we can get season from one of the players
    if (teamAPlayerIds.length > 0) {
      const playerRef = doc(db, 'realplayers', teamAPlayerIds[0]);
      const playerDoc = await getDoc(playerRef);
      if (playerDoc.exists()) {
        const playerData = playerDoc.data() as RealPlayerData;
        if (playerData.contract_start_season) {
          await recalculatePlayerCategories(playerData.contract_start_season);
        }
      }
    }
    
  } catch (error: any) {
    console.error('Error processing match for real players:', error);
    throw new Error(error.message || 'Failed to process match for real players');
  }
}

/**
 * Remove expired contracts at season end
 */
export async function removeExpiredContracts(
  currentSeasonId: string
): Promise<{ removed: number; errors: number }> {
  try {
    let removed = 0;
    let errors = 0;
    
    // Get all players with contracts ending before current season
    const playersRef = collection(db, 'realplayers');
    const q = query(
      playersRef,
      where('contract_end_season', '<', currentSeasonId),
      where('contract_status', '==', 'active')
    );
    
    const querySnapshot = await getDocs(q);
    const batch = writeBatch(db);
    
    querySnapshot.forEach((playerDoc) => {
      try {
        const playerData = playerDoc.data() as RealPlayerData;
        const playerId = playerDoc.id;
        const teamId = playerData.team_id;
        
        // Mark contract as expired
        const playerRef = doc(db, 'realplayers', playerId);
        batch.update(playerRef, {
          contract_status: 'expired',
          team_id: null,
          updated_at: serverTimestamp(),
        });
        
        // Remove from team's player list
        if (teamId) {
          // This would need additional logic to update team's real_players array
          // For batch operations, you might need to handle this separately
        }
        
        removed++;
      } catch (err) {
        errors++;
        console.error('Error processing player:', err);
      }
    });
    
    await batch.commit();
    
    // Do the same for football players
    const footballPlayersRef = collection(db, 'footballplayers');
    const footballQuery = query(
      footballPlayersRef,
      where('contract_end_season', '<', currentSeasonId),
      where('contract_status', '==', 'active')
    );
    
    const footballSnapshot = await getDocs(footballQuery);
    const footballBatch = writeBatch(db);
    
    footballSnapshot.forEach((playerDoc) => {
      try {
        const playerRef = doc(db, 'footballplayers', playerDoc.id);
        footballBatch.update(playerRef, {
          contract_status: 'expired',
          team_id: null,
          is_sold: false,
          updated_at: serverTimestamp(),
        });
        removed++;
      } catch (err) {
        errors++;
        console.error('Error processing football player:', err);
      }
    });
    
    await footballBatch.commit();
    
    return { removed, errors };
    
  } catch (error: any) {
    console.error('Error removing expired contracts:', error);
    throw new Error(error.message || 'Failed to remove expired contracts');
  }
}

/**
 * Get all real players with active contracts for a season
 */
export async function getActiveRealPlayers(
  seasonId: string
): Promise<RealPlayerData[]> {
  try {
    const playersRef = collection(db, 'realplayers');
    const q = query(
      playersRef,
      where('contract_start_season', '<=', seasonId),
      where('contract_end_season', '>=', seasonId),
      where('contract_status', '==', 'active')
    );
    
    const querySnapshot = await getDocs(q);
    const players: RealPlayerData[] = [];
    
    querySnapshot.forEach((doc) => {
      players.push({ id: doc.id, ...doc.data() } as RealPlayerData);
    });
    
    return players;
  } catch (error: any) {
    console.error('Error getting active real players:', error);
    throw new Error(error.message || 'Failed to get active real players');
  }
}
