/**
 * Transaction Logger
 * 
 * Centralized system to log ALL financial transactions for teams
 * including auctions, salaries, fines, player registrations, etc.
 */

import { getFirestore } from 'firebase-admin/firestore';

export type TransactionType = 
  | 'auction_win'           // Won player in auction
  | 'salary_payment'        // Match salary deduction
  | 'fine'                  // Disciplinary fine
  | 'real_player_fee'       // SS Member registration fee
  | 'release_refund'        // Player release refund
  | 'transfer_payment'      // Paid for transfer
  | 'transfer_compensation' // Received compensation
  | 'swap_fee_paid'         // Paid fee in swap
  | 'swap_fee_received'     // Received fee in swap
  | 'bonus'                 // Performance bonus
  | 'adjustment'            // Manual adjustment
  | 'initial_balance';      // Season start balance

export type CurrencyType = 'football' | 'real_player';

export interface TransactionData {
  team_id: string;
  season_id: string;
  transaction_type: TransactionType;
  currency_type: CurrencyType;
  amount: number; // Negative for deductions, positive for income
  balance_before: number;
  balance_after: number;
  description: string;
  metadata?: {
    player_id?: string;
    player_name?: string;
    player_type?: 'real' | 'football';
    round_id?: string;
    match_id?: string;
    fixture_id?: string;
    processed_by?: string;
    [key: string]: any;
  };
}

/**
 * Log a financial transaction to Firestore
 */
export async function logTransaction(data: TransactionData): Promise<void> {
  try {
    const db = getFirestore();
    
    // Filter out undefined values from metadata
    const cleanMetadata = data.metadata ? 
      Object.fromEntries(
        Object.entries(data.metadata).filter(([_, v]) => v !== undefined)
      ) : {};
    
    await db.collection('transactions').add({
      ...data,
      metadata: Object.keys(cleanMetadata).length > 0 ? cleanMetadata : undefined,
      created_at: new Date(),
      updated_at: new Date()
    });
    
    console.log(`✅ Transaction logged: ${data.transaction_type} - ${data.amount} for ${data.team_id}`);
  } catch (error) {
    console.error('❌ Failed to log transaction:', error);
    // Don't throw - transaction logging should not block main operation
  }
}

/**
 * Log auction win transaction
 */
export async function logAuctionWin(
  teamId: string,
  seasonId: string,
  playerName: string,
  playerId: string,
  playerType: 'real' | 'football',
  amount: number,
  balanceBefore: number,
  roundId?: string
): Promise<void> {
  const currencyType: CurrencyType = playerType === 'real' ? 'real_player' : 'football';
  
  await logTransaction({
    team_id: teamId,
    season_id: seasonId,
    transaction_type: 'auction_win',
    currency_type: currencyType,
    amount: -amount,
    balance_before: balanceBefore,
    balance_after: balanceBefore - amount,
    description: `Won auction for ${playerName}`,
    metadata: {
      player_id: playerId,
      player_name: playerName,
      player_type: playerType,
      round_id: roundId,
      auction_value: amount
    }
  });
}

/**
 * Log salary payment transaction
 */
export async function logSalaryPayment(
  teamId: string,
  seasonId: string,
  amount: number,
  balanceBefore: number,
  currencyType: CurrencyType,
  fixtureId?: string,
  matchNumber?: number,
  playerCount?: number,
  playerName?: string,
  playerId?: string
): Promise<void> {
  // Create appropriate description based on whether it's individual or bulk payment
  let description: string;
  if (playerName) {
    description = `Salary: ${playerName}`;
  } else if (playerCount && playerCount > 1) {
    description = `Match salary payment (${playerCount} players)`;
  } else {
    description = `Match salary payment`;
  }

  await logTransaction({
    team_id: teamId,
    season_id: seasonId,
    transaction_type: 'salary_payment',
    currency_type: currencyType,
    amount: -amount,
    balance_before: balanceBefore,
    balance_after: balanceBefore - amount,
    description,
    metadata: {
      fixture_id: fixtureId,
      match_number: matchNumber,
      player_count: playerCount,
      salary_amount: amount,
      player_id: playerId,
      player_name: playerName
    }
  });
}

/**
 * Log fine transaction
 */
export async function logFine(
  teamId: string,
  seasonId: string,
  amount: number,
  balanceBefore: number,
  currencyType: CurrencyType,
  reason: string,
  processedBy?: string
): Promise<void> {
  await logTransaction({
    team_id: teamId,
    season_id: seasonId,
    transaction_type: 'fine',
    currency_type: currencyType,
    amount: -amount,
    balance_before: balanceBefore,
    balance_after: balanceBefore - amount,
    description: `Fine: ${reason}`,
    metadata: {
      fine_reason: reason,
      processed_by: processedBy
    }
  });
}

/**
 * Log real player registration fee
 */
export async function logRealPlayerFee(
  teamId: string,
  seasonId: string,
  playerName: string,
  playerId: string,
  amount: number,
  balanceBefore: number
): Promise<void> {
  await logTransaction({
    team_id: teamId,
    season_id: seasonId,
    transaction_type: 'real_player_fee',
    currency_type: 'real_player',
    amount: -amount,
    balance_before: balanceBefore,
    balance_after: balanceBefore - amount,
    description: `Registered SS Member: ${playerName}`,
    metadata: {
      player_id: playerId,
      player_name: playerName,
      player_type: 'real',
      registration_fee: amount
    }
  });
}

/**
 * Log player release refund
 */
export async function logReleaseRefund(
  teamId: string,
  seasonId: string,
  playerName: string,
  playerId: string,
  playerType: 'real' | 'football',
  refundAmount: number,
  balanceBefore: number
): Promise<void> {
  const currencyType: CurrencyType = playerType === 'real' ? 'real_player' : 'football';
  
  await logTransaction({
    team_id: teamId,
    season_id: seasonId,
    transaction_type: 'release_refund',
    currency_type: currencyType,
    amount: refundAmount,
    balance_before: balanceBefore,
    balance_after: balanceBefore + refundAmount,
    description: `Released ${playerName} - Refund received`,
    metadata: {
      player_id: playerId,
      player_name: playerName,
      player_type: playerType,
      refund_amount: refundAmount
    }
  });
}

/**
 * Log bonus/reward transaction
 */
export async function logBonus(
  teamId: string,
  seasonId: string,
  amount: number,
  balanceBefore: number,
  currencyType: CurrencyType,
  reason: string
): Promise<void> {
  await logTransaction({
    team_id: teamId,
    season_id: seasonId,
    transaction_type: 'bonus',
    currency_type: currencyType,
    amount: amount,
    balance_before: balanceBefore,
    balance_after: balanceBefore + amount,
    description: `Bonus: ${reason}`,
    metadata: {
      bonus_reason: reason
    }
  });
}

/**
 * Log manual adjustment transaction
 */
export async function logAdjustment(
  teamId: string,
  seasonId: string,
  amount: number,
  balanceBefore: number,
  currencyType: CurrencyType,
  reason: string,
  adjustedBy?: string
): Promise<void> {
  await logTransaction({
    team_id: teamId,
    season_id: seasonId,
    transaction_type: 'adjustment',
    currency_type: currencyType,
    amount: amount,
    balance_before: balanceBefore,
    balance_after: balanceBefore + amount,
    description: `Adjustment: ${reason}`,
    metadata: {
      adjustment_reason: reason,
      adjusted_by: adjustedBy
    }
  });
}

/**
 * Log initial balance (season start)
 */
export async function logInitialBalance(
  teamId: string,
  seasonId: string,
  amount: number,
  currencyType: CurrencyType
): Promise<void> {
  const budgetType = currencyType === 'real_player' ? 'Real Player' : 'Football';
  
  await logTransaction({
    team_id: teamId,
    season_id: seasonId,
    transaction_type: 'initial_balance',
    currency_type: currencyType,
    amount: amount,
    balance_before: 0,
    balance_after: amount,
    description: `Season starting balance - ${budgetType} budget`,
    metadata: {
      season_start: true
    }
  });
}

/**
 * Log transfer payment (team acquiring player)
 */
export async function logTransferPayment(
  teamId: string,
  seasonId: string,
  playerName: string,
  playerId: string,
  playerType: 'real' | 'football',
  amount: number,
  balanceBefore: number,
  fromTeamId: string
): Promise<void> {
  const currencyType: CurrencyType = playerType === 'real' ? 'real_player' : 'football';
  
  await logTransaction({
    team_id: teamId,
    season_id: seasonId,
    transaction_type: 'transfer_payment',
    currency_type: currencyType,
    amount: -amount,
    balance_before: balanceBefore,
    balance_after: balanceBefore - amount,
    description: `Acquired ${playerName} via transfer`,
    metadata: {
      player_id: playerId,
      player_name: playerName,
      player_type: playerType,
      from_team_id: fromTeamId,
      transfer_cost: amount
    }
  });
}

/**
 * Log transfer compensation (team losing player)
 */
export async function logTransferCompensation(
  teamId: string,
  seasonId: string,
  playerName: string,
  playerId: string,
  playerType: 'real' | 'football',
  compensation: number,
  balanceBefore: number,
  toTeamId: string
): Promise<void> {
  const currencyType: CurrencyType = playerType === 'real' ? 'real_player' : 'football';
  
  await logTransaction({
    team_id: teamId,
    season_id: seasonId,
    transaction_type: 'transfer_compensation',
    currency_type: currencyType,
    amount: compensation,
    balance_before: balanceBefore,
    balance_after: balanceBefore + compensation,
    description: `Transferred ${playerName} - Compensation received`,
    metadata: {
      player_id: playerId,
      player_name: playerName,
      player_type: playerType,
      to_team_id: toTeamId,
      compensation_amount: compensation
    }
  });
}

/**
 * Log swap fee paid
 */
export async function logSwapFeePaid(
  teamId: string,
  seasonId: string,
  playerOutName: string,
  playerOutId: string,
  playerInName: string,
  playerInId: string,
  playerType: 'real' | 'football',
  feeAmount: number,
  balanceBefore: number,
  otherTeamId: string
): Promise<void> {
  const currencyType: CurrencyType = playerType === 'real' ? 'real_player' : 'football';
  
  await logTransaction({
    team_id: teamId,
    season_id: seasonId,
    transaction_type: 'swap_fee_paid',
    currency_type: currencyType,
    amount: -feeAmount,
    balance_before: balanceBefore,
    balance_after: balanceBefore - feeAmount,
    description: `Player swap: ${playerOutName} ↔ ${playerInName} - Fee paid`,
    metadata: {
      player_out_id: playerOutId,
      player_out_name: playerOutName,
      player_in_id: playerInId,
      player_in_name: playerInName,
      player_type: playerType,
      other_team_id: otherTeamId,
      swap_fee: feeAmount
    }
  });
}

/**
 * Log swap fee received
 */
export async function logSwapFeeReceived(
  teamId: string,
  seasonId: string,
  playerOutName: string,
  playerOutId: string,
  playerInName: string,
  playerInId: string,
  playerType: 'real' | 'football',
  feeAmount: number,
  balanceBefore: number,
  otherTeamId: string
): Promise<void> {
  const currencyType: CurrencyType = playerType === 'real' ? 'real_player' : 'football';
  
  await logTransaction({
    team_id: teamId,
    season_id: seasonId,
    transaction_type: 'swap_fee_received',
    currency_type: currencyType,
    amount: feeAmount,
    balance_before: balanceBefore,
    balance_after: balanceBefore + feeAmount,
    description: `Player swap: ${playerOutName} ↔ ${playerInName} - Fee received`,
    metadata: {
      player_out_id: playerOutId,
      player_out_name: playerOutName,
      player_in_id: playerInId,
      player_in_name: playerInName,
      player_type: playerType,
      other_team_id: otherTeamId,
      swap_fee: feeAmount
    }
  });
}
