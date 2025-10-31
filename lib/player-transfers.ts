/**
 * Player Transfer System
 * 
 * Handles:
 * 1. Release - Player to free agent with refund
 * 2. Transfer - Player from Team A to Team B with compensation
 * 3. Swap - Player A (Team A) ↔ Player B (Team B) with optional fee
 */

import { db } from '@/lib/firebase/config';
import { doc, getDoc, updateDoc, setDoc, serverTimestamp, collection, addDoc } from 'firebase/firestore';

export interface PlayerData {
  id: string;
  name: string;
  team_id: string;
  team_name?: string;
  auction_value: number;
  star_rating?: number;
  salary_per_match?: number;
  contract_start_season: string;
  contract_end_season: string;
  season_id: string;
}

export interface ReleaseResult {
  success: boolean;
  refund_amount: number;
  message: string;
  error?: string;
}

export interface TransferResult {
  success: boolean;
  compensation: number;
  new_contract_value: number;
  message: string;
  error?: string;
}

export interface SwapResult {
  success: boolean;
  fee_paid_to?: string; // team_id that receives fee
  fee_amount: number;
  message: string;
  error?: string;
}

/**
 * Calculate refund amount for released player
 * Formula: (auction_value × remaining_contract_percentage) × 0.7
 * 70% refund of remaining contract value
 */
export function calculateReleaseRefund(
  auctionValue: number,
  contractStartSeason: string,
  contractEndSeason: string,
  currentSeasonId: string
): number {
  const startNum = parseInt(contractStartSeason.replace(/\D/g, ''));
  const endNum = parseInt(contractEndSeason.replace(/\D/g, ''));
  const currentNum = parseInt(currentSeasonId.replace(/\D/g, ''));
  
  if (isNaN(startNum) || isNaN(endNum) || isNaN(currentNum)) {
    return 0;
  }
  
  // Total contract duration
  const totalSeasons = endNum - startNum + 1;
  
  // Remaining seasons (including current)
  const remainingSeasons = Math.max(0, endNum - currentNum + 1);
  
  // Remaining percentage
  const remainingPercentage = remainingSeasons / totalSeasons;
  
  // 70% refund of remaining value
  const refund = Math.floor(auctionValue * remainingPercentage * 0.7);
  
  return Math.max(0, refund);
}

/**
 * Calculate transfer compensation
 * Team A releases player, Team B acquires with new contract
 */
export function calculateTransferCompensation(
  auctionValue: number,
  contractStartSeason: string,
  contractEndSeason: string,
  currentSeasonId: string
): { refundToTeamA: number; costToTeamB: number } {
  // Team A gets release refund
  const refundToTeamA = calculateReleaseRefund(
    auctionValue,
    contractStartSeason,
    contractEndSeason,
    currentSeasonId
  );
  
  // Team B pays new contract value (can be different from original)
  // For now, use 80% of original auction value
  const costToTeamB = Math.floor(auctionValue * 0.8);
  
  return {
    refundToTeamA,
    costToTeamB
  };
}

/**
 * Create news entry for player transaction
 */
async function createNewsEntry(
  title: string,
  content: string,
  seasonId: string,
  category: 'player_movement' | 'contract' | 'announcement'
) {
  try {
    const newsId = `news_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await setDoc(doc(db, 'news', newsId), {
      title,
      content,
      season_id: seasonId,
      category,
      is_published: true,
      created_at: serverTimestamp(),
      updated_at: serverTimestamp()
    });
    console.log('✅ News entry created:', title);
  } catch (error) {
    console.error('Error creating news:', error);
  }
}

/**
 * Release player to free agent
 */
export async function releasePlayer(
  playerId: string,
  playerData: PlayerData,
  currentSeasonId: string,
  releasedBy: string,
  releasedByName: string
): Promise<ReleaseResult> {
  try {
    // Calculate refund
    const refundAmount = calculateReleaseRefund(
      playerData.auction_value,
      playerData.contract_start_season,
      playerData.contract_end_season,
      currentSeasonId
    );
    
    // Get team_season document to update balance
    const teamSeasonRef = doc(db, 'team_seasons', `${playerData.team_id}_${currentSeasonId}`);
    const teamSeasonSnap = await getDoc(teamSeasonRef);
    
    if (!teamSeasonSnap.exists()) {
      return {
        success: false,
        refund_amount: 0,
        message: 'Team season not found',
        error: 'Team not registered for this season'
      };
    }
    
    const teamSeasonData = teamSeasonSnap.data();
    const currentDollarBalance = teamSeasonData.dollar_balance || 0;
    const newDollarBalance = currentDollarBalance + refundAmount;
    
    // Update player status to free agent
    const playerRef = doc(db, 'realplayer', playerId);
    await updateDoc(playerRef, {
      team_id: null,
      status: 'free_agent',
      released_at: serverTimestamp(),
      released_by: releasedBy,
      released_by_name: releasedByName,
      release_refund: refundAmount,
      previous_team_id: playerData.team_id,
      updated_at: serverTimestamp()
    });
    
    // Update team balance
    await updateDoc(teamSeasonRef, {
      dollar_balance: newDollarBalance,
      updated_at: serverTimestamp()
    });
    
    // Create transaction record
    await addDoc(collection(db, 'player_transactions'), {
      transaction_type: 'release',
      player_id: playerId,
      player_name: playerData.name,
      team_id: playerData.team_id,
      season_id: currentSeasonId,
      refund_amount: refundAmount,
      auction_value: playerData.auction_value,
      processed_by: releasedBy,
      processed_by_name: releasedByName,
      created_at: serverTimestamp()
    });
    
    // Create news entry
    await createNewsEntry(
      `Player Released: ${playerData.name}`,
      `${playerData.team_name || 'A team'} has released ${playerData.name} to free agency. The team received a refund of $${refundAmount}. ${playerData.name} is now available for re-signing.`,
      currentSeasonId,
      'player_movement'
    );
    
    console.log(`✅ Released ${playerData.name} from team. Refund: $${refundAmount}`);
    
    return {
      success: true,
      refund_amount: refundAmount,
      message: `Player released successfully. Team refunded $${refundAmount}`
    };
  } catch (error: any) {
    console.error('Error releasing player:', error);
    return {
      success: false,
      refund_amount: 0,
      message: 'Failed to release player',
      error: error.message
    };
  }
}

/**
 * Transfer player from Team A to Team B
 */
export async function transferPlayer(
  playerId: string,
  playerData: PlayerData,
  newTeamId: string,
  newContractValue: number,
  currentSeasonId: string,
  transferredBy: string,
  transferredByName: string
): Promise<TransferResult> {
  try {
    // Calculate compensation
    const { refundToTeamA, costToTeamB } = calculateTransferCompensation(
      playerData.auction_value,
      playerData.contract_start_season,
      playerData.contract_end_season,
      currentSeasonId
    );
    
    // Get both team_season documents
    const oldTeamSeasonRef = doc(db, 'team_seasons', `${playerData.team_id}_${currentSeasonId}`);
    const newTeamSeasonRef = doc(db, 'team_seasons', `${newTeamId}_${currentSeasonId}`);
    
    const [oldTeamSnap, newTeamSnap] = await Promise.all([
      getDoc(oldTeamSeasonRef),
      getDoc(newTeamSeasonRef)
    ]);
    
    if (!oldTeamSnap.exists() || !newTeamSnap.exists()) {
      return {
        success: false,
        compensation: 0,
        new_contract_value: 0,
        message: 'One or both teams not found',
        error: 'Team season data missing'
      };
    }
    
    const oldTeamData = oldTeamSnap.data();
    const newTeamData = newTeamSnap.data();
    
    // Check if new team can afford
    const newTeamBalance = newTeamData.dollar_balance || 0;
    if (newTeamBalance < newContractValue) {
      return {
        success: false,
        compensation: 0,
        new_contract_value: newContractValue,
        message: 'New team has insufficient funds',
        error: `Requires $${newContractValue}, has $${newTeamBalance}`
      };
    }
    
    // Update player
    const playerRef = doc(db, 'realplayer', playerId);
    await updateDoc(playerRef, {
      team_id: newTeamId,
      auction_value: newContractValue,
      previous_team_id: playerData.team_id,
      transferred_at: serverTimestamp(),
      transferred_by: transferredBy,
      transferred_by_name: transferredByName,
      status: 'active',
      updated_at: serverTimestamp()
    });
    
    // Update old team balance (add refund)
    const newOldTeamBalance = (oldTeamData.dollar_balance || 0) + refundToTeamA;
    await updateDoc(oldTeamSeasonRef, {
      dollar_balance: newOldTeamBalance,
      updated_at: serverTimestamp()
    });
    
    // Update new team balance (deduct cost)
    const newNewTeamBalance = newTeamBalance - newContractValue;
    await updateDoc(newTeamSeasonRef, {
      dollar_balance: newNewTeamBalance,
      updated_at: serverTimestamp()
    });
    
    // Create transaction record
    await addDoc(collection(db, 'player_transactions'), {
      transaction_type: 'transfer',
      player_id: playerId,
      player_name: playerData.name,
      old_team_id: playerData.team_id,
      new_team_id: newTeamId,
      season_id: currentSeasonId,
      refund_to_old_team: refundToTeamA,
      cost_to_new_team: newContractValue,
      new_contract_value: newContractValue,
      processed_by: transferredBy,
      processed_by_name: transferredByName,
      created_at: serverTimestamp()
    });
    
    // Get team names for news
    const [oldTeamSnap2, newTeamSnap2] = await Promise.all([
      getDoc(doc(db, 'teams', playerData.team_id)),
      getDoc(doc(db, 'teams', newTeamId))
    ]);
    
    const oldTeamName = oldTeamSnap2.exists() ? oldTeamSnap2.data().name : 'Previous Team';
    const newTeamName = newTeamSnap2.exists() ? newTeamSnap2.data().name : 'New Team';
    
    // Create news entry
    await createNewsEntry(
      `Transfer: ${playerData.name} Joins ${newTeamName}`,
      `${playerData.name} has been transferred from ${oldTeamName} to ${newTeamName} for a contract value of $${newContractValue}. ${oldTeamName} received $${refundToTeamA} in compensation.`,
      currentSeasonId,
      'player_movement'
    );
    
    console.log(`✅ Transferred ${playerData.name}. Old team refund: $${refundToTeamA}, New team cost: $${newContractValue}`);
    
    return {
      success: true,
      compensation: refundToTeamA,
      new_contract_value: newContractValue,
      message: `Transfer completed. Old team refunded $${refundToTeamA}, New team paid $${newContractValue}`
    };
  } catch (error: any) {
    console.error('Error transferring player:', error);
    return {
      success: false,
      compensation: 0,
      new_contract_value: 0,
      message: 'Failed to transfer player',
      error: error.message
    };
  }
}

/**
 * Swap players between two teams with optional fee
 */
export async function swapPlayers(
  playerAId: string,
  playerAData: PlayerData,
  playerBId: string,
  playerBData: PlayerData,
  feeAmount: number, // Positive = Team A pays Team B, Negative = Team B pays Team A
  currentSeasonId: string,
  swappedBy: string,
  swappedByName: string
): Promise<SwapResult> {
  try {
    const teamAId = playerAData.team_id;
    const teamBId = playerBData.team_id;
    
    // Get both team_season documents
    const teamASeasonRef = doc(db, 'team_seasons', `${teamAId}_${currentSeasonId}`);
    const teamBSeasonRef = doc(db, 'team_seasons', `${teamBId}_${currentSeasonId}`);
    
    const [teamASnap, teamBSnap] = await Promise.all([
      getDoc(teamASeasonRef),
      getDoc(teamBSeasonRef)
    ]);
    
    if (!teamASnap.exists() || !teamBSnap.exists()) {
      return {
        success: false,
        fee_amount: 0,
        message: 'One or both teams not found',
        error: 'Team season data missing'
      };
    }
    
    const teamAData = teamASnap.data();
    const teamBData = teamBSnap.data();
    
    const teamABalance = teamAData.dollar_balance || 0;
    const teamBBalance = teamBData.dollar_balance || 0;
    
    // Check budget constraints
    if (feeAmount > 0 && teamABalance < feeAmount) {
      return {
        success: false,
        fee_amount: feeAmount,
        message: 'Team A has insufficient funds for fee',
        error: `Team A requires $${feeAmount}, has $${teamABalance}`
      };
    }
    
    if (feeAmount < 0 && teamBBalance < Math.abs(feeAmount)) {
      return {
        success: false,
        fee_amount: feeAmount,
        message: 'Team B has insufficient funds for fee',
        error: `Team B requires $${Math.abs(feeAmount)}, has $${teamBBalance}`
      };
    }
    
    // Swap players
    const playerARef = doc(db, 'realplayer', playerAId);
    const playerBRef = doc(db, 'realplayer', playerBId);
    
    await Promise.all([
      updateDoc(playerARef, {
        team_id: teamBId,
        previous_team_id: teamAId,
        swapped_at: serverTimestamp(),
        swapped_by: swappedBy,
        swapped_by_name: swappedByName,
        status: 'active',
        updated_at: serverTimestamp()
      }),
      updateDoc(playerBRef, {
        team_id: teamAId,
        previous_team_id: teamBId,
        swapped_at: serverTimestamp(),
        swapped_by: swappedBy,
        swapped_by_name: swappedByName,
        status: 'active',
        updated_at: serverTimestamp()
      })
    ]);
    
    // Update team balances with fee
    let newTeamABalance = teamABalance;
    let newTeamBBalance = teamBBalance;
    let feePaidTo = undefined;
    
    if (feeAmount > 0) {
      // Team A pays Team B
      newTeamABalance -= feeAmount;
      newTeamBBalance += feeAmount;
      feePaidTo = teamBId;
    } else if (feeAmount < 0) {
      // Team B pays Team A
      newTeamABalance += Math.abs(feeAmount);
      newTeamBBalance -= Math.abs(feeAmount);
      feePaidTo = teamAId;
    }
    
    await Promise.all([
      updateDoc(teamASeasonRef, {
        dollar_balance: newTeamABalance,
        updated_at: serverTimestamp()
      }),
      updateDoc(teamBSeasonRef, {
        dollar_balance: newTeamBBalance,
        updated_at: serverTimestamp()
      })
    ]);
    
    // Create transaction record
    await addDoc(collection(db, 'player_transactions'), {
      transaction_type: 'swap',
      player_a_id: playerAId,
      player_a_name: playerAData.name,
      player_b_id: playerBId,
      player_b_name: playerBData.name,
      team_a_id: teamAId,
      team_b_id: teamBId,
      season_id: currentSeasonId,
      fee_amount: Math.abs(feeAmount),
      fee_paid_by: feeAmount > 0 ? teamAId : (feeAmount < 0 ? teamBId : null),
      fee_paid_to: feePaidTo,
      processed_by: swappedBy,
      processed_by_name: swappedByName,
      created_at: serverTimestamp()
    });
    
    // Get team names for news
    const [teamASnap2, teamBSnap2] = await Promise.all([
      getDoc(doc(db, 'teams', teamAId)),
      getDoc(doc(db, 'teams', teamBId))
    ]);
    
    const teamAName = teamASnap2.exists() ? teamASnap2.data().name : 'Team A';
    const teamBName = teamBSnap2.exists() ? teamBSnap2.data().name : 'Team B';
    
    const feeMessage = feeAmount === 0 
      ? 'No fee involved'
      : feeAmount > 0 
        ? `Team A paid $${feeAmount} to Team B`
        : `Team B paid $${Math.abs(feeAmount)} to Team A`;
    
    // Create news entry
    const feeText = feeAmount === 0 
      ? '' 
      : feeAmount > 0 
        ? ` ${teamAName} paid $${feeAmount} to ${teamBName} as part of the deal.`
        : ` ${teamBName} paid $${Math.abs(feeAmount)} to ${teamAName} as part of the deal.`;
    
    await createNewsEntry(
      `Player Swap: ${playerAData.name} ↔ ${playerBData.name}`,
      `${teamAName} and ${teamBName} have completed a player swap. ${playerAData.name} moves to ${teamBName}, while ${playerBData.name} joins ${teamAName}.${feeText}`,
      currentSeasonId,
      'player_movement'
    );
    
    console.log(`✅ Swapped ${playerAData.name} ↔ ${playerBData.name}. ${feeMessage}`);
    
    return {
      success: true,
      fee_paid_to: feePaidTo,
      fee_amount: Math.abs(feeAmount),
      message: `Swap completed successfully. ${feeMessage}`
    };
  } catch (error: any) {
    console.error('Error swapping players:', error);
    return {
      success: false,
      fee_amount: 0,
      message: 'Failed to swap players',
      error: error.message
    };
  }
}
