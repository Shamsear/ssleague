/**
 * WebSocket Integration Example
 * 
 * This component demonstrates how to use WebSockets for real-time updates
 * with automatic cache invalidation and optional toast notifications.
 */

'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useWebSocket } from '@/hooks/useWebSocket';
import { toast } from 'react-hot-toast'; // or your preferred toast library

interface Props {
  teamId: string;
  enabled?: boolean;
}

export default function WebSocketExample({ teamId, enabled = true }: Props) {
  const queryClient = useQueryClient();

  // Subscribe to team-specific updates
  const { isConnected } = useWebSocket({
    channel: `team:${teamId}`,
    enabled,
    onMessage: (message) => {
      console.log('[WebSocket] Received:', message);

      switch (message.type) {
        case 'squad_update':
          handleSquadUpdate(message.data);
          break;

        case 'wallet_update':
          handleWalletUpdate(message.data);
          break;

        case 'new_round':
          handleNewRound(message.data);
          break;

        case 'tiebreaker_created':
          handleTiebreakerCreated(message.data);
          break;
      }
    },
    onConnect: () => {
      console.log('[WebSocket] Connected to team channel');
      toast.success('Connected to live updates');
    },
    onDisconnect: () => {
      console.log('[WebSocket] Disconnected from team channel');
      toast.error('Disconnected from live updates');
    },
  });

  const handleSquadUpdate = (data: any) => {
    const { player_name, action, price } = data;

    if (action === 'acquired') {
      toast.success(`✅ ${player_name} acquired for £${price?.toLocaleString()}`);
    } else if (action === 'removed') {
      toast.info(`🔄 ${player_name} removed from squad`);
    }

    // Invalidate squad-related caches
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['team-squad'] });
    queryClient.invalidateQueries({ queryKey: ['team-players', teamId] });
    queryClient.invalidateQueries({ queryKey: ['footballplayers'] });
  };

  const handleWalletUpdate = (data: any) => {
    const { new_balance, amount_spent, amount_refunded, currency_type } = data;

    if (amount_spent) {
      toast.success(`💰 Spent £${amount_spent.toLocaleString()}`);
    } else if (amount_refunded) {
      toast.info(`💵 Refunded £${amount_refunded.toLocaleString()}`);
    }

    // Invalidate wallet-related caches
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['team-wallet', teamId] });
    queryClient.invalidateQueries({ queryKey: ['team-seasons', teamId] });
    queryClient.invalidateQueries({ queryKey: ['transactions', teamId] });
  };

  const handleNewRound = (data: any) => {
    const { round_number, position } = data;
    toast.success(`🎯 New round started: Round ${round_number} (${position})`);

    // Invalidate round-related caches
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['rounds'] });
    queryClient.invalidateQueries({ queryKey: ['auction-rounds'] });
  };

  const handleTiebreakerCreated = (data: any) => {
    const { player_name } = data;
    toast.info(`⚖️ Tiebreaker created for ${player_name || 'player'}`);

    // Invalidate tiebreaker-related caches
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['tiebreakers'] });
  };

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
 * Usage in a Page/Component:
 * 
 * ```tsx
 * import WebSocketExample from '@/components/examples/WebSocketExample';
 * 
 * export default function TeamDashboard({ user }) {
 *   return (
 *     <div>
 *       <WebSocketExample teamId={user.teamId} />
 *       {/* Rest of your dashboard UI *\/}
 *     </div>
 *   );
 * }
 * ```
 */
