# WebSocket Frontend Implementation - Complete ✅

## Overview
The WebSocket system is now fully integrated on both backend and frontend. This document explains how to use it in your components for real-time cache invalidation and live updates.

---

## Architecture

```
Backend Change → WebSocket Broadcast → Frontend Listener → Cache Invalidation → Auto Refetch
```

### Data Flow:
1. **Backend** modifies data (e.g., player acquired, budget updated)
2. **Backend** broadcasts WebSocket event to subscribed channels
3. **Frontend** receives event via `useWebSocket` hook
4. **React Query** invalidates affected caches
5. **Frontend** automatically refetches fresh data

---

## Available Hooks

### 1. `useDashboardWebSocket(teamId, enabled)`

**Purpose**: Listen for team-specific updates (squad, wallet, rounds, tiebreakers)

**Usage**:
```typescript
import { useDashboardWebSocket } from '@/hooks/useWebSocket';

const { isConnected } = useDashboardWebSocket(teamId, true);
```

**Events Handled**:
- `squad_update` - Player acquired/removed
- `wallet_update` - Budget/balance changed
- `new_round` - New auction round started
- `tiebreaker_created` - Tiebreaker created for team

**Cache Invalidations**:
```typescript
// squad_update
['dashboard'], ['team-players', teamId], ['team-squad'], ['footballplayers']

// wallet_update
['dashboard'], ['team-wallet', teamId], ['team-seasons', teamId], ['transactions', teamId]

// new_round
['dashboard'], ['rounds'], ['auction-rounds']

// tiebreaker_created
['dashboard'], ['tiebreakers']
```

---

### 2. `useAuctionWebSocket(roundId, enabled)`

**Purpose**: Listen for auction round updates (bids, player sales, status changes)

**Usage**:
```typescript
import { useAuctionWebSocket } from '@/hooks/useWebSocket';

const { isConnected } = useAuctionWebSocket(roundId, true);
```

**Events Handled**:
- `bid` - New bid placed
- `player_sold` - Player sold in auction
- `round_status` - Round started/paused/completed
- `round_update` - General round update

**Cache Invalidations**:
```typescript
// bid
['bids'], ['round', roundId]

// player_sold
['bids'], ['round', roundId], ['footballplayers']

// round_status, round_update
['round', roundId], ['roundStatus', roundId]
```

---

### 3. `useTiebreakerWebSocket(tiebreakerId, enabled)`

**Purpose**: Listen for tiebreaker updates (bids, finalization)

**Usage**:
```typescript
import { useTiebreakerWebSocket } from '@/hooks/useWebSocket';

const { isConnected } = useTiebreakerWebSocket(tiebreakerId, true);
```

**Events Handled**:
- `tiebreaker_bid` - Team submitted new bid
- `tiebreaker_finalized` - Tiebreaker resolved

**Cache Invalidations**:
```typescript
// tiebreaker_bid
['tiebreaker', tiebreakerId], ['tiebreakers']

// tiebreaker_finalized
['tiebreaker', tiebreakerId], ['tiebreakers'], ['dashboard']
```

---

### 4. `useWebSocket(options)` - Base Hook

**Purpose**: Low-level hook for custom WebSocket subscriptions

**Usage**:
```typescript
import { useWebSocket } from '@/hooks/useWebSocket';

const { isConnected } = useWebSocket({
  channel: 'team:SSPSLT0001',
  enabled: true,
  onMessage: (message) => {
    console.log('Received:', message);
  },
  onConnect: () => {
    console.log('Connected!');
  },
  onDisconnect: () => {
    console.log('Disconnected!');
  },
});
```

---

## Implementation Examples

### Example 1: Team Dashboard with Real-Time Updates

```typescript
'use client';

import { useDashboardWebSocket } from '@/hooks/useWebSocket';
import { useTeamDashboard } from '@/hooks/useTeamDashboard';

export default function TeamDashboard({ teamId }: { teamId: string }) {
  // Fetch data with React Query
  const { data, isLoading } = useTeamDashboard(teamId, true);
  
  // Enable real-time updates
  const { isConnected } = useDashboardWebSocket(teamId, !!teamId);

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      <h1>Team Dashboard</h1>
      
      {/* Connection status indicator */}
      <div className={`status ${isConnected ? 'connected' : 'disconnected'}`}>
        {isConnected ? '🟢 Live' : '🔴 Offline'}
      </div>

      {/* Dashboard content */}
      <div>Budget: £{data.team.balance}</div>
      <div>Players: {data.squad.length}</div>
    </div>
  );
}
```

---

### Example 2: Live Auction with Toast Notifications

```typescript
'use client';

import { useAuctionWebSocket } from '@/hooks/useWebSocket';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';

export default function AuctionRoom({ roundId, teamId }: { roundId: string; teamId: string }) {
  const queryClient = useQueryClient();

  // Listen for auction updates
  useAuctionWebSocket(roundId, true);

  // Listen for team-specific updates with custom handling
  useWebSocket({
    channel: `team:${teamId}`,
    enabled: true,
    onMessage: (message) => {
      switch (message.type) {
        case 'squad_update':
          toast.success(`✅ Player acquired: ${message.data.player_name}`);
          break;
        case 'wallet_update':
          toast.info(`💰 Budget updated: £${message.data.new_balance}`);
          break;
      }
    },
  });

  return <div>Auction Room UI...</div>;
}
```

---

### Example 3: Tiebreaker Page

```typescript
'use client';

import { useTiebreakerWebSocket } from '@/hooks/useWebSocket';
import { useQuery } from '@tanstack/react-query';

export default function TiebreakerPage({ tiebreakerId }: { tiebreakerId: string }) {
  // Enable real-time tiebreaker updates
  const { isConnected } = useTiebreakerWebSocket(tiebreakerId, true);

  // Fetch tiebreaker data
  const { data } = useQuery({
    queryKey: ['tiebreaker', tiebreakerId],
    queryFn: () => fetch(`/api/tiebreakers/${tiebreakerId}`).then(r => r.json()),
  });

  return (
    <div>
      <h1>Tiebreaker</h1>
      <div>Status: {isConnected ? 'Live' : 'Offline'}</div>
      <div>Highest Bid: £{data?.highest_bid}</div>
    </div>
  );
}
```

---

## Cache Invalidation Utilities

For manual cache invalidation, use these helper functions:

```typescript
import { 
  invalidateSquadCaches,
  invalidateWalletCaches,
  invalidateTiebreakerCaches,
  invalidateAuctionCaches,
} from '@/lib/cache/invalidate';
import { useQueryClient } from '@tanstack/react-query';

const queryClient = useQueryClient();

// Invalidate squad caches
invalidateSquadCaches(queryClient, teamId);

// Invalidate wallet caches
invalidateWalletCaches(queryClient, teamId);

// Invalidate tiebreaker caches
invalidateTiebreakerCaches(queryClient, tiebreakerId);

// Invalidate auction caches
invalidateAuctionCaches(queryClient, roundId);
```

---

## WebSocket Client Configuration

The WebSocket client automatically connects to:
- **Development**: `ws://localhost:3001/api/ws`
- **Production**: `wss://yourdomain.com/api/ws`

Configure via environment variable:
```bash
NEXT_PUBLIC_WS_URL=ws://localhost:3001
```

---

## Connection Lifecycle

### Auto-Reconnection
The WebSocket client automatically:
- Reconnects on disconnect (exponential backoff)
- Resubscribes to channels after reconnection
- Sends heartbeat pings every 30 seconds

### Component Lifecycle
- **Mount**: Connects and subscribes to channel
- **Unmount**: Unsubscribes and cleans up
- **Re-render**: No extra connections (singleton pattern)

---

## Testing

### Check Connection Status
```typescript
const { isConnected } = useDashboardWebSocket(teamId, true);

useEffect(() => {
  console.log('WebSocket status:', isConnected ? 'Connected' : 'Disconnected');
}, [isConnected]);
```

### Trigger Test Events
Use the backend broadcast function:
```typescript
// In a backend API route
import { broadcastTeamUpdate } from '@/lib/websocket/broadcast';

await broadcastTeamUpdate('SSPSLT0001', 'wallet', {
  new_balance: 50000,
  amount_spent: 10000,
  currency_type: 'football',
});
```

### Monitor WebSocket Traffic
Open browser DevTools → Network → WS → Click connection → Messages tab

---

## Performance Considerations

### 1. **Aggressive Caching + Smart Invalidation**
- React Query caches aggressively (5 min stale time)
- WebSocket only invalidates when data *actually* changes
- Result: Minimal API calls, always fresh data

### 2. **Singleton Connection**
- One WebSocket connection per client (not per component)
- Multiple components can subscribe to same channel
- No connection overhead

### 3. **Selective Invalidation**
- Only invalidates affected caches
- Unaffected queries keep using cached data
- Example: Squad update doesn't invalidate transactions cache

---

## Troubleshooting

### Issue: WebSocket not connecting

**Check**:
1. Is WebSocket server running? (`npm run ws` or equivalent)
2. Correct `NEXT_PUBLIC_WS_URL` in `.env.local`?
3. Check browser console for connection errors

### Issue: Events not triggering cache invalidation

**Check**:
1. Is `useDashboardWebSocket` hook active?
2. Is `teamId` correct?
3. Check browser console for `[Dashboard WS] Received:` logs
4. Verify event type matches expected format

### Issue: Stale data after broadcast

**Check**:
1. Is React Query cache being invalidated? (Check DevTools)
2. Is `refetchOnMount` disabled in QueryClient config?
3. Try manual invalidation: `queryClient.invalidateQueries({ queryKey: ['dashboard'] })`

---

## Best Practices

### ✅ DO:
- Use high-level hooks (`useDashboardWebSocket`, etc.) when possible
- Enable WebSocket on pages that need real-time updates
- Disable WebSocket when component is inactive (pass `enabled: false`)
- Show connection status indicator to users
- Handle `onConnect` and `onDisconnect` for UX feedback

### ❌ DON'T:
- Create multiple WebSocket connections per page
- Subscribe to unused channels
- Invalidate all caches on every event
- Use WebSocket for initial data loading (use React Query)
- Manually call `fetch()` after receiving WebSocket event (React Query handles it)

---

## Summary

### What's Implemented:
✅ WebSocket client with auto-reconnection  
✅ Channel-based pub/sub system  
✅ React hooks for common use cases  
✅ Automatic cache invalidation  
✅ Connection status tracking  
✅ Backend broadcasts on data changes  

### Benefits:
🚀 **Real-time updates** without polling  
💾 **Reduced API calls** via smart caching  
⚡ **Instant UI updates** when data changes  
💰 **Lower costs** (fewer Firebase reads)  
🎯 **Zero stale data** guaranteed  

---

## Next Steps

1. **Add toast notifications** for better UX (see `components/examples/WebSocketExample.tsx`)
2. **Add connection status indicator** to dashboard
3. **Monitor WebSocket usage** in production
4. **Scale WebSocket server** if needed (Redis pub/sub)

---

## Support

For questions or issues:
1. Check browser console for WebSocket logs
2. Review `hooks/useWebSocket.ts` for hook implementation
3. Check `lib/websocket/client.ts` for client logic
4. Verify backend broadcasts in `lib/websocket/broadcast.ts`
