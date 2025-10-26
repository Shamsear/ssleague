# Cache Strategy & Invalidation Guide

## Problem: Stale Data
When database updates happen (via API routes), React Query caches don't automatically know to refresh. This causes users to see old data until the cache expires.

## Solution: Cache Invalidation + WebSocket

### 1. Short Cache Times for Critical Data
- **Seasons (active check)**: 10 seconds
- **Team History**: 30 seconds  
- **Player Stats**: 2 minutes
- **Leaderboard**: 3 minutes
- **Fixtures**: 5 minutes

### 2. Cache Busting
All queries add `?_t=${timestamp}` to force fresh API calls and disable browser cache with `cache: 'no-store'`.

### 3. Manual Invalidation
Use `invalidateQueries()` after mutations:

```typescript
import { useQueryClient } from '@tanstack/react-query';

const queryClient = useQueryClient();

// After updating data
await updateData();
queryClient.invalidateQueries({ queryKey: ['team-history'] });
```

### 4. WebSocket Real-Time Updates (Best Solution)
For live data (auctions, bids, matches), WebSocket broadcasts trigger automatic cache invalidation:

```typescript
// Server broadcasts change
global.wsBroadcast('round:123', { type: 'bid', data: {...} });

// Client hook auto-invalidates cache
useAuctionWebSocket(roundId); // Listens and invalidates
```

## Cache Times by Data Type

| Data Type | Stale Time | Why |
|-----------|------------|-----|
| Active Seasons | 10s | Critical for registration status |
| Team History | 30s | Updates when matches complete |
| Player Stats | 2min | Updates after match submission |
| Team Stats | 2min | Updates after match submission |
| Leaderboard | 3min | Expensive query, updates less often |
| Fixtures | 5min | Rarely changes |
| Auction Bids | Real-time | WebSocket only |
| Tiebreakers | Real-time | WebSocket only |

## API Route Caching

### Disabled for Testing (Current)
```typescript
export const revalidate = 0;
export const dynamic = 'force-dynamic';
```

### Production Settings (After Testing)
```typescript
export const revalidate = 60; // 1 minute
export const dynamic = 'force-static';
```

## Best Practices

1. **Use WebSocket for Real-Time**: Auction, tiebreakers, live matches
2. **Use Short Cache for Semi-Live**: Team stats, player stats, leaderboard
3. **Use Long Cache for Static**: Historical data, completed seasons
4. **Always Invalidate After Mutations**: Update → Invalidate → Refetch

## Testing Cache Issues

1. Open browser DevTools → Network tab
2. Check if API calls have `_t=` timestamp
3. Verify `Cache-Control: no-store` in response headers
4. Check React Query DevTools for cache status

## WebSocket Integration (Next Step)

WebSocket will handle real-time invalidation automatically:
- Bid placed → Invalidate auction caches
- Match completed → Invalidate stats caches  
- Season status changed → Invalidate season caches

See `WEBSOCKET_MANUAL_SETUP.md` for implementation.
