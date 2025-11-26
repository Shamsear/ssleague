/**
 * Committee Fee Tracking and Reporting
 * 
 * This module provides functions to aggregate and report committee fees
 * collected from player transfers and swaps.
 * 
 * Requirements: 6.1, 6.2, 6.4, 6.5, 9.4
 */

import { adminDb } from './firebase/admin';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

/**
 * Committee fees aggregated by season
 */
export interface CommitteeFeesBySeason {
  seasonId: string;
  totalTransferFees: number;
  totalSwapFees: number;
  totalFees: number;
  transferCount: number;
  swapCount: number;
}

/**
 * Committee fees paid by a specific team
 */
export interface CommitteeFeesByTeam {
  teamId: string;
  teamName?: string;
  seasonId: string;
  transferFeesPaid: number;
  swapFeesPaid: number;
  totalFeesPaid: number;
  transferCount: number;
  swapCount: number;
}

/**
 * Detailed breakdown of committee fees
 */
export interface CommitteeFeeBreakdown {
  seasonId: string;
  totalFees: number;
  transfers: {
    count: number;
    totalFees: number;
    transactions: Array<{
      transactionId: string;
      date: Date;
      playerName: string;
      oldTeam: string;
      newTeam: string;
      committeeFee: number;
      processedBy: string;
    }>;
  };
  swaps: {
    count: number;
    totalFees: number;
    transactions: Array<{
      transactionId: string;
      date: Date;
      playerAName: string;
      playerBName: string;
      teamA: string;
      teamB: string;
      teamAFee: number;
      teamBFee: number;
      totalFees: number;
      processedBy: string;
    }>;
  };
}

// ============================================================================
// AGGREGATION FUNCTIONS
// ============================================================================

/**
 * Get committee fees aggregated by season
 * 
 * Sums all transfer and swap fees for a specific season.
 * 
 * @param seasonId - The season ID to aggregate fees for
 * @returns Committee fees summary for the season
 * 
 * @example
 * const fees = await getCommitteeFeesBySeason('SSPSLS16');
 * console.log(`Total fees collected: ${fees.totalFees}`);
 */
export async function getCommitteeFeesBySeason(
  seasonId: string
): Promise<CommitteeFeesBySeason> {
  try {
    const transactionsRef = adminDb.collection('player_transactions');
    
    // Query all transactions for this season
    const snapshot = await transactionsRef
      .where('season_id', '==', seasonId)
      .get();
    
    let totalTransferFees = 0;
    let totalSwapFees = 0;
    let transferCount = 0;
    let swapCount = 0;
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      
      if (data.transaction_type === 'transfer') {
        totalTransferFees += data.committee_fee || 0;
        transferCount++;
      } else if (data.transaction_type === 'swap') {
        totalSwapFees += data.total_committee_fees || 0;
        swapCount++;
      }
    });
    
    return {
      seasonId,
      totalTransferFees: Math.round(totalTransferFees * 100) / 100,
      totalSwapFees: Math.round(totalSwapFees * 100) / 100,
      totalFees: Math.round((totalTransferFees + totalSwapFees) * 100) / 100,
      transferCount,
      swapCount
    };
    
  } catch (error) {
    console.error('Error getting committee fees by season:', error);
    throw new Error(`Failed to get committee fees by season: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get committee fees paid by each team in a season
 * 
 * Shows how much each team has paid in committee fees for transfers and swaps.
 * 
 * @param seasonId - The season ID to aggregate fees for
 * @returns Array of committee fees by team
 * 
 * @example
 * const teamFees = await getCommitteeFeesByTeam('SSPSLS16');
 * teamFees.forEach(team => {
 *   console.log(`${team.teamName}: ${team.totalFeesPaid}`);
 * });
 */
export async function getCommitteeFeesByTeam(
  seasonId: string
): Promise<CommitteeFeesByTeam[]> {
  try {
    const transactionsRef = adminDb.collection('player_transactions');
    
    // Query all transactions for this season
    const snapshot = await transactionsRef
      .where('season_id', '==', seasonId)
      .get();
    
    // Map to track fees by team
    const teamFeesMap = new Map<string, {
      transferFees: number;
      swapFees: number;
      transferCount: number;
      swapCount: number;
    }>();
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      
      if (data.transaction_type === 'transfer') {
        // For transfers, both buying and selling teams are involved
        // But only the buying team pays the fee (included in buying_team_paid)
        const buyingTeamId = data.new_team_id;
        
        if (!teamFeesMap.has(buyingTeamId)) {
          teamFeesMap.set(buyingTeamId, {
            transferFees: 0,
            swapFees: 0,
            transferCount: 0,
            swapCount: 0
          });
        }
        
        const teamData = teamFeesMap.get(buyingTeamId)!;
        teamData.transferFees += data.committee_fee || 0;
        teamData.transferCount++;
        
      } else if (data.transaction_type === 'swap') {
        // For swaps, both teams pay fees
        const teamAId = data.team_a_id;
        const teamBId = data.team_b_id;
        
        // Team A fees
        if (!teamFeesMap.has(teamAId)) {
          teamFeesMap.set(teamAId, {
            transferFees: 0,
            swapFees: 0,
            transferCount: 0,
            swapCount: 0
          });
        }
        const teamAData = teamFeesMap.get(teamAId)!;
        teamAData.swapFees += data.team_a_fee || 0;
        teamAData.swapCount++;
        
        // Team B fees
        if (!teamFeesMap.has(teamBId)) {
          teamFeesMap.set(teamBId, {
            transferFees: 0,
            swapFees: 0,
            transferCount: 0,
            swapCount: 0
          });
        }
        const teamBData = teamFeesMap.get(teamBId)!;
        teamBData.swapFees += data.team_b_fee || 0;
        teamBData.swapCount++;
      }
    });
    
    // Convert map to array
    const result: CommitteeFeesByTeam[] = [];
    
    for (const [teamId, fees] of teamFeesMap.entries()) {
      result.push({
        teamId,
        seasonId,
        transferFeesPaid: Math.round(fees.transferFees * 100) / 100,
        swapFeesPaid: Math.round(fees.swapFees * 100) / 100,
        totalFeesPaid: Math.round((fees.transferFees + fees.swapFees) * 100) / 100,
        transferCount: fees.transferCount,
        swapCount: fees.swapCount
      });
    }
    
    // Sort by total fees paid (descending)
    result.sort((a, b) => b.totalFeesPaid - a.totalFeesPaid);
    
    return result;
    
  } catch (error) {
    console.error('Error getting committee fees by team:', error);
    throw new Error(`Failed to get committee fees by team: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get detailed breakdown of all committee fees
 * 
 * Provides a comprehensive report with individual transaction details.
 * 
 * @param seasonId - The season ID to get breakdown for
 * @returns Detailed breakdown of all committee fees
 * 
 * @example
 * const breakdown = await getCommitteeFeeBreakdown('SSPSLS16');
 * console.log(`Total transfers: ${breakdown.transfers.count}`);
 * console.log(`Total swaps: ${breakdown.swaps.count}`);
 */
export async function getCommitteeFeeBreakdown(
  seasonId: string
): Promise<CommitteeFeeBreakdown> {
  try {
    const transactionsRef = adminDb.collection('player_transactions');
    
    // Query all transactions for this season, ordered by date
    const snapshot = await transactionsRef
      .where('season_id', '==', seasonId)
      .orderBy('created_at', 'desc')
      .get();
    
    const transfers: CommitteeFeeBreakdown['transfers']['transactions'] = [];
    const swaps: CommitteeFeeBreakdown['swaps']['transactions'] = [];
    
    let totalTransferFees = 0;
    let totalSwapFees = 0;
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      const transactionId = doc.id;
      
      if (data.transaction_type === 'transfer') {
        const committeeFee = data.committee_fee || 0;
        totalTransferFees += committeeFee;
        
        transfers.push({
          transactionId,
          date: data.created_at?.toDate() || new Date(),
          playerName: data.player_name || 'Unknown Player',
          oldTeam: data.old_team_id || 'Unknown',
          newTeam: data.new_team_id || 'Unknown',
          committeeFee: Math.round(committeeFee * 100) / 100,
          processedBy: data.processed_by_name || data.processed_by || 'Unknown'
        });
        
      } else if (data.transaction_type === 'swap') {
        const totalFees = data.total_committee_fees || 0;
        totalSwapFees += totalFees;
        
        swaps.push({
          transactionId,
          date: data.created_at?.toDate() || new Date(),
          playerAName: data.player_a_name || 'Unknown Player A',
          playerBName: data.player_b_name || 'Unknown Player B',
          teamA: data.team_a_id || 'Unknown',
          teamB: data.team_b_id || 'Unknown',
          teamAFee: Math.round((data.team_a_fee || 0) * 100) / 100,
          teamBFee: Math.round((data.team_b_fee || 0) * 100) / 100,
          totalFees: Math.round(totalFees * 100) / 100,
          processedBy: data.processed_by_name || data.processed_by || 'Unknown'
        });
      }
    });
    
    return {
      seasonId,
      totalFees: Math.round((totalTransferFees + totalSwapFees) * 100) / 100,
      transfers: {
        count: transfers.length,
        totalFees: Math.round(totalTransferFees * 100) / 100,
        transactions: transfers
      },
      swaps: {
        count: swaps.length,
        totalFees: Math.round(totalSwapFees * 100) / 100,
        transactions: swaps
      }
    };
    
  } catch (error) {
    console.error('Error getting committee fee breakdown:', error);
    throw new Error(`Failed to get committee fee breakdown: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
