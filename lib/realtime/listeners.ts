import { realtimeDb } from '@/lib/firebase/config';
import { ref, onValue, off, Unsubscribe } from 'firebase/database';

export interface SquadUpdateEvent {
  team_id: string;
  player_id: string;
  player_name: string;
  action: 'acquired' | 'refunded';
  price: number;
  timestamp: number;
}

export interface WalletUpdateEvent {
  team_id: string;
  new_balance: number;
  amount_spent?: number;
  amount_refunded?: number;
  currency_type: 'single' | 'football' | 'basketball';
  timestamp: number;
}

export interface TiebreakerBidEvent {
  team_id: string;
  team_name: string;
  bid_amount: number;
  timestamp: number;
}

/**
 * Listen to squad updates for a season
 */
export function listenToSquadUpdates(
  seasonId: string,
  callback: (event: SquadUpdateEvent) => void
): Unsubscribe {
  const updateRef = ref(realtimeDb, `updates/${seasonId}/squads`);
  
  const unsubscribe = onValue(updateRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      // Get the latest update (most recent child)
      const updates = Object.values(data) as SquadUpdateEvent[];
      const latest = updates[updates.length - 1];
      if (latest) {
        callback(latest);
      }
    }
  });
  
  return unsubscribe;
}

/**
 * Listen to wallet updates for a season
 */
export function listenToWalletUpdates(
  seasonId: string,
  callback: (event: WalletUpdateEvent) => void
): Unsubscribe {
  const updateRef = ref(realtimeDb, `updates/${seasonId}/wallets`);
  
  const unsubscribe = onValue(updateRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      const updates = Object.values(data) as WalletUpdateEvent[];
      const latest = updates[updates.length - 1];
      if (latest) {
        callback(latest);
      }
    }
  });
  
  return unsubscribe;
}

/**
 * Listen to tiebreaker bids for a specific tiebreaker round
 */
export function listenToTiebreakerBids(
  seasonId: string,
  tiebreakerRound: string,
  callback: (event: TiebreakerBidEvent) => void
): Unsubscribe {
  const updateRef = ref(realtimeDb, `updates/${seasonId}/tiebreakers/${tiebreakerRound}`);
  
  const unsubscribe = onValue(updateRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      const updates = Object.values(data) as TiebreakerBidEvent[];
      const latest = updates[updates.length - 1];
      if (latest) {
        callback(latest);
      }
    }
  });
  
  return unsubscribe;
}

/**
 * Listen to round status updates for a specific round
 */
export function listenToRoundStatusUpdates(
  seasonId: string,
  roundId: string,
  callback: (status: string) => void
): Unsubscribe {
  const updateRef = ref(realtimeDb, `updates/${seasonId}/rounds/${roundId}`);
  
  const unsubscribe = onValue(updateRef, (snapshot) => {
    const data = snapshot.val();
    if (data && data.status) {
      callback(data.status);
    }
  });
  
  return unsubscribe;
}

/**
 * Listen to all round updates (status, time, etc.)
 */
export function listenToRoundUpdates(
  seasonId: string,
  roundId: string,
  callback: (data: Record<string, any>) => void
): Unsubscribe {
  const updateRef = ref(realtimeDb, `updates/${seasonId}/rounds/${roundId}`);
  
  const unsubscribe = onValue(updateRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      callback(data);
    }
  });
  
  return unsubscribe;
}

/**
 * Listen to auction bids for a specific round
 */
export function listenToAuctionBids(
  seasonId: string,
  roundId: string,
  callback: (data: Record<string, any>) => void
): Unsubscribe {
  const updateRef = ref(realtimeDb, `updates/${seasonId}/rounds/${roundId}/bids`);
  
  const unsubscribe = onValue(updateRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      const updates = Object.values(data);
      const latest = updates[updates.length - 1] as Record<string, any>;
      if (latest) {
        callback(latest);
      }
    }
  });
  
  return unsubscribe;
}

/**
 * Listen to bulk tiebreaker updates
 */
export function listenToBulkTiebreakerUpdates(
  seasonId: string,
  tiebreakerId: string,
  callback: (data: Record<string, any>) => void
): Unsubscribe {
  const updateRef = ref(realtimeDb, `updates/${seasonId}/bulk_tiebreakers/${tiebreakerId}`);
  
  const unsubscribe = onValue(updateRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      callback(data);
    }
  });
  
  return unsubscribe;
}

/**
 * Listen to fantasy league updates
 */
export function listenToFantasyLeagueUpdates(
  leagueId: string,
  callback: (data: Record<string, any>) => void
): Unsubscribe {
  const updateRef = ref(realtimeDb, `fantasy/leagues/${leagueId}`);
  
  const unsubscribe = onValue(updateRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      callback(data);
    }
  });
  
  return unsubscribe;
}

/**
 * Listen to all round updates for a season (any round)
 * This listens to the rounds parent path to catch all child updates
 */
export function listenToSeasonRoundUpdates(
  seasonId: string,
  callback: (data: Record<string, any>) => void
): Unsubscribe {
  const updateRef = ref(realtimeDb, `updates/${seasonId}/rounds`);
  
  const unsubscribe = onValue(updateRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
      // Get the most recent update from any round
      const roundIds = Object.keys(data);
      if (roundIds.length > 0) {
        // Get latest update from the most recently updated round
        let latestUpdate = null;
        let latestTimestamp = 0;
        
        roundIds.forEach(roundId => {
          const roundData = data[roundId];
          if (roundData.timestamp > latestTimestamp) {
            latestTimestamp = roundData.timestamp;
            latestUpdate = { ...roundData, round_id: roundId };
          }
        });
        
        if (latestUpdate) {
          callback(latestUpdate);
        }
      }
    }
  });
  
  return unsubscribe;
}
