import { adminRealtimeDb } from '@/lib/firebase/admin';

/**
 * Broadcast a squad update (player acquired/refunded)
 */
export async function broadcastSquadUpdate(
  seasonId: string,
  teamId: string,
  data: {
    player_id: string;
    player_name: string;
    action: 'acquired' | 'refunded';
    price: number;
  }
) {
  try {
    const updateRef = adminRealtimeDb.ref(`updates/${seasonId}/squads`);
    await updateRef.push({
      team_id: teamId,
      ...data,
      timestamp: Date.now(),
    });
    console.log('✅ Squad update broadcasted via Realtime DB');
  } catch (error) {
    console.error('❌ Failed to broadcast squad update:', error);
  }
}

/**
 * Broadcast a wallet update (balance changed)
 */
export async function broadcastWalletUpdate(
  seasonId: string,
  teamId: string,
  data: {
    new_balance: number;
    amount_spent?: number;
    amount_refunded?: number;
    currency_type: 'single' | 'football' | 'basketball';
  }
) {
  try {
    const updateRef = adminRealtimeDb.ref(`updates/${seasonId}/wallets`);
    await updateRef.push({
      team_id: teamId,
      ...data,
      timestamp: Date.now(),
    });
    console.log('✅ Wallet update broadcasted via Realtime DB');
  } catch (error) {
    console.error('❌ Failed to broadcast wallet update:', error);
  }
}

/**
 * Broadcast a tiebreaker bid submission
 */
export async function broadcastTiebreakerBid(
  seasonId: string,
  tiebreakerRound: string,
  data: {
    team_id: string;
    team_name: string;
    bid_amount: number;
  }
) {
  try {
    const updateRef = adminRealtimeDb.ref(`updates/${seasonId}/tiebreakers/${tiebreakerRound}`);
    await updateRef.push({
      ...data,
      timestamp: Date.now(),
    });
    console.log('✅ Tiebreaker bid broadcasted via Realtime DB');
  } catch (error) {
    console.error('❌ Failed to broadcast tiebreaker bid:', error);
  }
}

/**
 * Broadcast round status change
 */
export async function broadcastRoundStatusUpdate(
  seasonId: string,
  roundId: string,
  status: string
) {
  try {
    const updateRef = adminRealtimeDb.ref(`updates/${seasonId}/rounds/${roundId}`);
    await updateRef.set({
      status,
      timestamp: Date.now(),
    });
    console.log('✅ Round status update broadcasted via Realtime DB');
  } catch (error) {
    console.error('❌ Failed to broadcast round status:', error);
  }
}
