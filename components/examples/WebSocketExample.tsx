/**
 * Firebase Realtime Database Integration Example
 * 
 * This component demonstrates how to use Firebase Realtime Database
 * for real-time updates with automatic cache invalidation.
 * 
 * NOTE: Use the specialized hooks (useDashboardWebSocket, useAuctionWebSocket)
 * instead of the generic useWebSocket hook for better type safety.
 */

'use client';

import { useDashboardWebSocket } from '@/hooks/useWebSocket';

interface Props {
  seasonId: string | null;
  teamId: string | null;
}

/**
 * Example 1: Dashboard real-time updates
 * Automatically listens to squad and wallet updates
 */
export default function FirebaseRealtimeExample({ seasonId, teamId }: Props) {
  // This hook automatically:
  // 1. Listens to squad updates (player acquired/refunded)
  // 2. Listens to wallet updates (balance changes)
  // 3. Invalidates React Query caches when updates occur
  const { isConnected } = useDashboardWebSocket(seasonId, teamId);

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className={`px-4 py-2 rounded-full text-sm font-medium ${
        isConnected 
          ? 'bg-green-100 text-green-800 border border-green-200' 
          : 'bg-red-100 text-red-800 border border-red-200'
      }`}>
        <span className="inline-block w-2 h-2 rounded-full mr-2 animate-pulse" 
              style={{ backgroundColor: isConnected ? '#22c55e' : '#ef4444' }} />
        {isConnected ? 'Live Updates Active' : 'Disconnected'}
      </div>
    </div>
  );
}

/**
 * Example 2: Custom Firebase listener for specific events
 * Use this pattern when you need custom handling of updates
 * 
 * Usage:
 * ```tsx
 * import { useEffect } from 'react';
 * import { listenToRoundUpdates } from '@/lib/realtime/listeners';
 * 
 * export function MyComponent({ seasonId, roundId }: Props) {
 *   useEffect(() => {
 *     if (!seasonId || !roundId) return;
 *     
 *     const unsubscribe = listenToRoundUpdates(seasonId, roundId, (data) => {
 *       console.log('Round update:', data);
 *       // Handle the update (e.g., update state, invalidate caches)
 *     });
 *     
 *     return () => unsubscribe();
 *   }, [seasonId, roundId]);
 *   
 *   return <div>Your component</div>;
 * }
 * ```
 */
