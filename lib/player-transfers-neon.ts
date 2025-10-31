/**
 * Player Transfer System - Neon PostgreSQL Version
 * 
 * Supports both:
 * - Real Players (player_seasons table in Tournament DB)
 * - Football Players (footballplayers table in Auction DB)
 * 
 * Handles:
 * 1. Release - Player to free agent with refund
 * 2. Transfer - Player from Team A to Team B with compensation
 * 3. Swap - Player A (Team A) ↔ Player B (Team B) with optional fee
 */

import { getTournamentDb } from '@/lib/neon/tournament-config';
import { getAuctionDb } from '@/lib/neon/auction-config';
import { db } from '@/lib/firebase/config';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { 
  logReleaseRefund, 
  logTransferPayment, 
  logTransferCompensation,
  logSwapFeePaid,
  logSwapFeeReceived 
} from '@/lib/transaction-logger';

export type PlayerType = 'real' | 'football';

export interface NeonPlayerData {
  id: string;
  player_id: string;
  player_name: string;
  team_id: string;
  team?: string; // team_name
  auction_value: number;
  star_rating?: number;
  salary_per_match?: number;
  contract_start_season: string;
  contract_end_season: string;
  season_id: string;
  status?: string;
  type: PlayerType;
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
  fee_paid_to?: string;
  fee_amount: number;
  message: string;
  error?: string;
}

/**
 * Get the appropriate database SQL client based on player type
 */
function getPlayerDb(playerType: PlayerType) {
  return playerType === 'real' ? getTournamentDb() : getAuctionDb();
}

/**
 * Get the appropriate table name based on player type
 */
function getTableName(playerType: PlayerType): string {
  return playerType === 'real' ? 'player_seasons' : 'footballplayers';
}

/**
 * Calculate refund amount for released player
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
  
  const totalSeasons = endNum - startNum + 1;
  const remainingSeasons = Math.max(0, endNum - currentNum + 1);
  const remainingPercentage = remainingSeasons / totalSeasons;
  const refund = Math.floor(auctionValue * remainingPercentage * 0.7);
  
  return Math.max(0, refund);
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
 * Release player to free agent (Neon version)
 */
export async function releasePlayerNeon(
  playerData: NeonPlayerData,
  currentSeasonId: string,
  releasedBy: string,
  releasedByName: string
): Promise<ReleaseResult> {
  try {
    const sql = getPlayerDb(playerData.type);
    const tableName = getTableName(playerData.type);
    
    // Calculate refund
    const refundAmount = calculateReleaseRefund(
      playerData.auction_value,
      playerData.contract_start_season,
      playerData.contract_end_season,
      currentSeasonId
    );
    
    // Get team_season document to update balance
    const teamSeasonDocId = `${playerData.team_id}_${currentSeasonId}`;
    const { getFirestore } = await import('firebase-admin/firestore');
    const adminDb = getFirestore();
    const teamSeasonRef = adminDb.collection('team_seasons').doc(teamSeasonDocId);
    const teamSeasonSnap = await teamSeasonRef.get();
    
    if (!teamSeasonSnap.exists) {
      return {
        success: false,
        refund_amount: 0,
        message: 'Team season not found',
        error: 'Team not registered for this season'
      };
    }
    
    const teamSeasonData = teamSeasonSnap.data();
    const currentBalance = teamSeasonData?.dollar_balance || 0;
    const newBalance = currentBalance + refundAmount;
    
    // Update player status to free agent in Neon
    if (playerData.type === 'real') {
      // For player_seasons, update the current season record
      const compositeId = `${playerData.player_id}_${currentSeasonId}`;
      await sql`
        UPDATE player_seasons
        SET team_id = NULL,
            team = NULL,
            status = 'free_agent',
            contract_id = NULL,
            updated_at = NOW()
        WHERE id = ${compositeId}
      `;
    } else {
      // For footballplayers
      await sql`
        UPDATE footballplayers
        SET team_id = NULL,
            status = 'free_agent',
            contract_id = NULL,
            updated_at = NOW()
        WHERE player_id = ${playerData.player_id} AND season_id = ${currentSeasonId}
      `;
    }
    
    // Update team balance
    await teamSeasonRef.update({
      dollar_balance: newBalance,
      updated_at: new Date()
    });
    
    // Log transaction
    await logReleaseRefund(
      playerData.team_id,
      currentSeasonId,
      playerData.player_name,
      playerData.player_id,
      playerData.type,
      refundAmount,
      currentBalance
    );
    
    // Create transaction record in Firebase
    await adminDb.collection('player_transactions').add({
      transaction_type: 'release',
      player_id: playerData.player_id,
      player_name: playerData.player_name,
      player_type: playerData.type,
      team_id: playerData.team_id,
      season_id: currentSeasonId,
      refund_amount: refundAmount,
      auction_value: playerData.auction_value,
      processed_by: releasedBy,
      processed_by_name: releasedByName,
      created_at: new Date()
    });
    
    // Create news entry
    await createNewsEntry(
      `Player Released: ${playerData.player_name}`,
      `${playerData.team || 'A team'} has released ${playerData.player_name} to free agency. The team received a refund of $${refundAmount}. ${playerData.player_name} is now available for re-signing.`,
      currentSeasonId,
      'player_movement'
    );
    
    console.log(`✅ Released ${playerData.player_name}. Refund: $${refundAmount}`);
    
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
 * Transfer player from Team A to Team B (Neon version)
 */
export async function transferPlayerNeon(
  playerData: NeonPlayerData,
  newTeamId: string,
  newTeamName: string,
  newContractValue: number,
  newContractDuration: number,
  currentSeasonId: string,
  transferredBy: string,
  transferredByName: string
): Promise<TransferResult> {
  try {
    const sql = getPlayerDb(playerData.type);
    
    // Calculate compensation (70% refund to old team)
    const refundToTeamA = calculateReleaseRefund(
      playerData.auction_value,
      playerData.contract_start_season,
      playerData.contract_end_season,
      currentSeasonId
    );
    
    // Get both team_season documents
    const { getFirestore } = await import('firebase-admin/firestore');
    const adminDb = getFirestore();
    
    const oldTeamSeasonDocId = `${playerData.team_id}_${currentSeasonId}`;
    const newTeamSeasonDocId = `${newTeamId}_${currentSeasonId}`;
    
    const [oldTeamSnap, newTeamSnap] = await Promise.all([
      adminDb.collection('team_seasons').doc(oldTeamSeasonDocId).get(),
      adminDb.collection('team_seasons').doc(newTeamSeasonDocId).get()
    ]);
    
    if (!oldTeamSnap.exists || !newTeamSnap.exists) {
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
    const newTeamBalance = newTeamData?.dollar_balance || 0;
    if (newTeamBalance < newContractValue) {
      return {
        success: false,
        compensation: 0,
        new_contract_value: newContractValue,
        message: 'New team has insufficient funds',
        error: `Requires $${newContractValue}, has $${newTeamBalance}`
      };
    }
    
    // Calculate new contract end season
    const currentSeasonNum = parseInt(currentSeasonId.replace(/\D/g, ''));
    const seasonPrefix = currentSeasonId.replace(/\d+$/, '');
    const seasonsToAdd = Math.floor(newContractDuration);
    const newContractEndSeason = `${seasonPrefix}${currentSeasonNum + seasonsToAdd - 1}`;
    const newContractId = `contract_${playerData.player_id}_${currentSeasonId}_${Date.now()}`;
    
    // Update player in Neon
    if (playerData.type === 'real') {
      const compositeId = `${playerData.player_id}_${currentSeasonId}`;
      await sql`
        UPDATE player_seasons
        SET team_id = ${newTeamId},
            team = ${newTeamName},
            auction_value = ${newContractValue},
            contract_id = ${newContractId},
            contract_start_season = ${currentSeasonId},
            contract_end_season = ${newContractEndSeason},
            contract_length = ${newContractDuration},
            status = 'active',
            updated_at = NOW()
        WHERE id = ${compositeId}
      `;
    } else {
      // For footballplayers, use acquisition_value instead of auction_value
      await sql`
        UPDATE footballplayers
        SET team_id = ${newTeamId},
            team_name = ${newTeamName},
            acquisition_value = ${newContractValue},
            contract_id = ${newContractId},
            contract_start_season = ${currentSeasonId},
            contract_end_season = ${newContractEndSeason},
            contract_length = ${newContractDuration},
            status = 'active',
            updated_at = NOW()
        WHERE player_id = ${playerData.player_id} AND season_id = ${currentSeasonId}
      `;
    }
    
    // Update team balances
    const oldTeamBalance = oldTeamData?.dollar_balance || 0;
    await Promise.all([
      adminDb.collection('team_seasons').doc(oldTeamSeasonDocId).update({
        dollar_balance: oldTeamBalance + refundToTeamA,
        updated_at: new Date()
      }),
      adminDb.collection('team_seasons').doc(newTeamSeasonDocId).update({
        dollar_balance: newTeamBalance - newContractValue,
        updated_at: new Date()
      })
    ]);
    
    // Log transactions
    await Promise.all([
      logTransferCompensation(
        playerData.team_id,
        currentSeasonId,
        playerData.player_name,
        playerData.player_id,
        playerData.type,
        refundToTeamA,
        oldTeamBalance,
        newTeamId
      ),
      logTransferPayment(
        newTeamId,
        currentSeasonId,
        playerData.player_name,
        playerData.player_id,
        playerData.type,
        newContractValue,
        newTeamBalance,
        playerData.team_id
      )
    ]);
    
    // Create transaction record
    await adminDb.collection('player_transactions').add({
      transaction_type: 'transfer',
      player_id: playerData.player_id,
      player_name: playerData.player_name,
      player_type: playerData.type,
      old_team_id: playerData.team_id,
      new_team_id: newTeamId,
      season_id: currentSeasonId,
      refund_to_old_team: refundToTeamA,
      cost_to_new_team: newContractValue,
      new_contract_value: newContractValue,
      new_contract_duration: newContractDuration,
      processed_by: transferredBy,
      processed_by_name: transferredByName,
      created_at: new Date()
    });
    
    // Create news entry
    await createNewsEntry(
      `Transfer: ${playerData.player_name} Joins ${newTeamName}`,
      `${playerData.player_name} has been transferred from ${playerData.team || 'their previous team'} to ${newTeamName} for $${newContractValue}. The previous team received $${refundToTeamA} in compensation.`,
      currentSeasonId,
      'player_movement'
    );
    
    return {
      success: true,
      compensation: refundToTeamA,
      new_contract_value: newContractValue,
      message: `Transfer complete. Old team refunded $${refundToTeamA}, new team paid $${newContractValue}`
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
 * Swap players between two teams (Neon version)
 */
export async function swapPlayersNeon(
  playerAData: NeonPlayerData,
  playerBData: NeonPlayerData,
  feeAmount: number,
  currentSeasonId: string,
  swappedBy: string,
  swappedByName: string
): Promise<SwapResult> {
  try {
    // Both players must be same type
    if (playerAData.type !== playerBData.type) {
      return {
        success: false,
        fee_amount: 0,
        message: 'Cannot swap players of different types',
        error: 'Player types must match'
      };
    }
    
    const sql = getPlayerDb(playerAData.type);
    const teamAId = playerAData.team_id;
    const teamBId = playerBData.team_id;
    
    // Get both team_season documents
    const { getFirestore } = await import('firebase-admin/firestore');
    const adminDb = getFirestore();
    
    const [teamASnap, teamBSnap] = await Promise.all([
      adminDb.collection('team_seasons').doc(`${teamAId}_${currentSeasonId}`).get(),
      adminDb.collection('team_seasons').doc(`${teamBId}_${currentSeasonId}`).get()
    ]);
    
    if (!teamASnap.exists || !teamBSnap.exists) {
      return {
        success: false,
        fee_amount: 0,
        message: 'One or both teams not found'
      };
    }
    
    const teamABalance = teamASnap.data()?.dollar_balance || 0;
    const teamBBalance = teamBSnap.data()?.dollar_balance || 0;
    
    // Check budget constraints
    if (feeAmount > 0 && teamABalance < feeAmount) {
      return {
        success: false,
        fee_amount: feeAmount,
        message: 'Team A has insufficient funds for fee'
      };
    }
    
    if (feeAmount < 0 && teamBBalance < Math.abs(feeAmount)) {
      return {
        success: false,
        fee_amount: feeAmount,
        message: 'Team B has insufficient funds for fee'
      };
    }
    
    // Swap players in Neon
    if (playerAData.type === 'real') {
      const compositeIdA = `${playerAData.player_id}_${currentSeasonId}`;
      const compositeIdB = `${playerBData.player_id}_${currentSeasonId}`;
      
      await Promise.all([
        sql`
          UPDATE player_seasons
          SET team_id = ${teamBId},
              team = ${playerBData.team},
              updated_at = NOW()
          WHERE id = ${compositeIdA}
        `,
        sql`
          UPDATE player_seasons
          SET team_id = ${teamAId},
              team = ${playerAData.team},
              updated_at = NOW()
          WHERE id = ${compositeIdB}
        `
      ]);
    } else {
      await Promise.all([
        sql`
          UPDATE footballplayers
          SET team_id = ${teamBId},
              updated_at = NOW()
          WHERE player_id = ${playerAData.player_id} AND season_id = ${currentSeasonId}
        `,
        sql`
          UPDATE footballplayers
          SET team_id = ${teamAId},
              updated_at = NOW()
          WHERE player_id = ${playerBData.player_id} AND season_id = ${currentSeasonId}
        `
      ]);
    }
    
    // Update team balances with fee
    let newTeamABalance = teamABalance;
    let newTeamBBalance = teamBBalance;
    let feePaidTo = undefined;
    
    if (feeAmount > 0) {
      newTeamABalance -= feeAmount;
      newTeamBBalance += feeAmount;
      feePaidTo = teamBId;
    } else if (feeAmount < 0) {
      newTeamABalance += Math.abs(feeAmount);
      newTeamBBalance -= Math.abs(feeAmount);
      feePaidTo = teamAId;
    }
    
    await Promise.all([
      adminDb.collection('team_seasons').doc(`${teamAId}_${currentSeasonId}`).update({
        dollar_balance: newTeamABalance,
        updated_at: new Date()
      }),
      adminDb.collection('team_seasons').doc(`${teamBId}_${currentSeasonId}`).update({
        dollar_balance: newTeamBBalance,
        updated_at: new Date()
      })
    ]);
    
    // Log swap fee transactions if applicable
    if (feeAmount > 0) {
      await Promise.all([
        logSwapFeePaid(
          teamAId,
          currentSeasonId,
          playerAData.player_name,
          playerAData.player_id,
          playerBData.player_name,
          playerBData.player_id,
          playerAData.type,
          feeAmount,
          teamABalance,
          teamBId
        ),
        logSwapFeeReceived(
          teamBId,
          currentSeasonId,
          playerBData.player_name,
          playerBData.player_id,
          playerAData.player_name,
          playerAData.player_id,
          playerAData.type,
          feeAmount,
          teamBBalance,
          teamAId
        )
      ]);
    } else if (feeAmount < 0) {
      await Promise.all([
        logSwapFeePaid(
          teamBId,
          currentSeasonId,
          playerBData.player_name,
          playerBData.player_id,
          playerAData.player_name,
          playerAData.player_id,
          playerAData.type,
          Math.abs(feeAmount),
          teamBBalance,
          teamAId
        ),
        logSwapFeeReceived(
          teamAId,
          currentSeasonId,
          playerAData.player_name,
          playerAData.player_id,
          playerBData.player_name,
          playerBData.player_id,
          playerAData.type,
          Math.abs(feeAmount),
          teamABalance,
          teamBId
        )
      ]);
    }
    
    // Create transaction record
    await adminDb.collection('player_transactions').add({
      transaction_type: 'swap',
      player_a_id: playerAData.player_id,
      player_a_name: playerAData.player_name,
      player_b_id: playerBData.player_id,
      player_b_name: playerBData.player_name,
      player_type: playerAData.type,
      team_a_id: teamAId,
      team_b_id: teamBId,
      season_id: currentSeasonId,
      fee_amount: Math.abs(feeAmount),
      fee_paid_by: feeAmount > 0 ? teamAId : (feeAmount < 0 ? teamBId : null),
      fee_paid_to: feePaidTo,
      processed_by: swappedBy,
      processed_by_name: swappedByName,
      created_at: new Date()
    });
    
    const feeText = feeAmount === 0 
      ? '' 
      : feeAmount > 0 
        ? ` ${playerAData.team} paid $${feeAmount} to ${playerBData.team} as part of the deal.`
        : ` ${playerBData.team} paid $${Math.abs(feeAmount)} to ${playerAData.team} as part of the deal.`;
    
    // Create news entry
    await createNewsEntry(
      `Player Swap: ${playerAData.player_name} ↔ ${playerBData.player_name}`,
      `${playerAData.team} and ${playerBData.team} have completed a player swap. ${playerAData.player_name} moves to ${playerBData.team}, while ${playerBData.player_name} joins ${playerAData.team}.${feeText}`,
      currentSeasonId,
      'player_movement'
    );
    
    const feeMessage = feeAmount === 0 
      ? 'No fee involved'
      : feeAmount > 0 
        ? `Team A paid $${feeAmount} to Team B`
        : `Team B paid $${Math.abs(feeAmount)} to Team A`;
    
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
