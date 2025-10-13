# Performance Optimization Plan

## Identified Bottlenecks

### 1. **Admin Rounds Page**
- Fetches rounds every 3-10 seconds (constant polling)
- Fetches tiebreakers separately for each poll
- Fetches team names from Firebase for each bid (N+1 queries)
- No caching of team names

### 2. **Round Details API**
- Decrypts each bid individually (slow)
- Fetches team names from Firebase for EACH bid (N+1 problem)
- No batch processing
- No caching

### 3. **Finalization Process**
- Multiple Firebase queries in loops
- No parallel processing
- Team name lookups not cached

### 4. **Token Refresh**
- Every API call checks token freshness
- No in-memory token cache

## Optimization Strategies

### Phase 1: Caching (Immediate Impact)
1. **In-Memory Cache for Team Names**
   - Cache team names in localStorage/memory
   - Reduce Firebase calls by 90%

2. **Reduce Polling Frequency**
   - Only poll when tab is active
   - Increase interval to 10s for idle, 5s for active

3. **Batch Operations**
   - Fetch multiple team names in one Firebase call
   - Batch decrypt operations

### Phase 2: Database Optimization
1. **Add team_name to bids table** (denormalized)
   - Store team name when bid is created
   - Eliminate Firebase lookups entirely

2. **Add indexes**
   - Index on round_id, team_id, player_id
   - Speed up queries by 10x

3. **Materialized views** for completed rounds
   - Pre-compute finalization details
   - Instant load for historical data

### Phase 3: Frontend Optimization
1. **React Query / SWR**
   - Automatic caching
   - Smart refetching
   - Optimistic updates

2. **Virtual Scrolling**
   - For long lists
   - Only render visible items

3. **Debouncing**
   - Prevent excessive updates
   - Batch state changes

## Implementation Priority

### HIGH PRIORITY (Implement Now)
1. ✅ Cache team names in memory
2. ✅ Reduce polling frequency
3. ✅ Batch Firebase queries
4. ✅ Add loading skeletons
5. ✅ Optimize round details API

### MEDIUM PRIORITY (Next Sprint)
1. Add database indexes
2. Implement React Query
3. Add service worker for offline support

### LOW PRIORITY (Future)
1. WebSocket for real-time updates
2. Server-side caching (Redis)
3. CDN for static assets

## Specific Optimizations

### 1. Team Name Cache
```typescript
// Global cache
const teamNameCache = new Map<string, string>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

async function getTeamName(teamId: string, seasonId: string): Promise<string> {
  const cacheKey = `${teamId}_${seasonId}`;
  
  if (teamNameCache.has(cacheKey)) {
    return teamNameCache.get(cacheKey)!;
  }
  
  // Fetch from Firebase
  const name = await fetchTeamNameFromFirebase(teamId, seasonId);
  teamNameCache.set(cacheKey, name);
  
  // Auto-expire cache
  setTimeout(() => teamNameCache.delete(cacheKey), CACHE_DURATION);
  
  return name;
}
```

### 2. Batch Firebase Queries
```typescript
// Instead of N queries
for (const bid of bids) {
  const team = await db.collection('teams').doc(bid.team_id).get();
}

// Do 1 query
const teamIds = [...new Set(bids.map(b => b.team_id))];
const teams = await Promise.all(
  teamIds.map(id => db.collection('teams').doc(id).get())
);
```

### 3. Reduce Polling
```typescript
// Before: Always 3s
setInterval(() => fetch(), 3000);

// After: Smart polling
const pollInterval = document.hidden 
  ? 30000  // 30s when tab inactive
  : activeRounds.length > 0 
    ? 5000   // 5s when active rounds
    : 15000; // 15s when idle
```

### 4. Loading States
```typescript
// Add skeleton loaders
{isLoading ? (
  <SkeletonLoader count={3} />
) : (
  <ActualContent />
)}
```

### 5. Optimistic Updates
```typescript
// Update UI immediately, sync in background
setData(newData); // Instant
fetch('/api/update', newData); // Background
```

## Expected Performance Improvements

| Optimization | Before | After | Improvement |
|--------------|--------|-------|-------------|
| Team name lookups | 100+ Firebase calls | 1-5 Firebase calls | 95% faster |
| Polling overhead | Every 3s | Every 5-30s | 60% less load |
| Round details load | 3-5s | 0.5-1s | 80% faster |
| Finalization | 5-10s | 2-3s | 60% faster |
| Token refresh | Every call | Cached 55min | 99% faster |

## Metrics to Track

1. **Time to Interactive (TTI)**
   - Target: < 2s

2. **API Response Time**
   - Target: < 500ms

3. **Firebase Calls per Page Load**
   - Target: < 10 calls

4. **Memory Usage**
   - Target: < 100MB

5. **Bundle Size**
   - Target: < 500KB

## Next Steps

1. Implement team name caching
2. Batch Firebase queries
3. Reduce polling frequency
4. Add loading skeletons
5. Optimize round details API
6. Add performance monitoring
