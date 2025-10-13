# APIs Requiring Performance Optimization

## ✅ Already Optimized
1. ✅ `/api/rounds/[id]` - Round details (batched queries)
2. ✅ `/api/admin/rounds/[id]/finalize` - Finalization (parallel execution)
3. ✅ `/api/admin/rounds/[id]/finalize-preview` - Preview (batched)
4. ✅ `lib/finalize-round.ts` - Core finalization logic (parallel)

## 🔴 HIGH PRIORITY - Optimize Now

### 1. `/api/admin/rounds` - GET
**Issue:** Likely fetches round data with team counts
**Fix:** Batch team name lookups
**Impact:** Committee admin rounds page
```typescript
// Use batchFetchTeamNames() utility
import { batchFetchTeamNames } from '@/lib/firebase-batch';
```

### 2. `/api/admin/tiebreakers` - GET
**Issue:** Fetches team names for each tiebreaker team
**Fix:** Batch all team fetches
**Impact:** Tiebreakers list page
```typescript
const teamIds = tiebreakers.flatMap(tb => tb.teams.map(t => t.team_id));
const teamNames = await batchFetchTeamNames(teamIds, seasonId);
```

### 3. `/api/team/dashboard` - GET
**Issue:** Fetches team season data, possibly loops
**Fix:** Batch queries
**Impact:** Team dashboard load time

### 4. `/api/team/bids` - GET  
**Issue:** Fetches bids with player/team data
**Fix:** Batch decrypt + team lookups
**Impact:** Team bids page

### 5. `/api/players` - GET
**Issue:** Returns large player lists
**Fix:** Add pagination, limit default results
**Impact:** All player lists

### 6. `/api/team/players` - GET
**Issue:** Fetches team's players
**Fix:** Single query with JOIN
**Impact:** Team roster page

## 🟡 MEDIUM PRIORITY

### 7. `/api/team/round/[id]` - GET
**Issue:** Fetches round with players for team
**Fix:** Optimize player query

### 8. `/api/rounds` - GET
**Issue:** Lists all rounds
**Fix:** Add indexes, limit results

### 9. `/api/tiebreakers/[id]` - GET
**Issue:** Fetches single tiebreaker with teams
**Fix:** Batch team lookups

## 🟢 LOW PRIORITY (Already Fast)

10. `/api/auth/*` - Token operations
11. `/api/players/[id]` - Single player
12. `/api/seasons/[seasonId]` - Single season

## Optimization Pattern

Use this pattern for ALL APIs:

```typescript
// ❌ BAD - Sequential queries (slow)
for (const item of items) {
  const team = await fetchTeam(item.team_id);
  const player = await fetchPlayer(item.player_id);
}

// ✅ GOOD - Parallel queries (fast)
const teamIds = [...new Set(items.map(i => i.team_id))];
const playerIds = [...new Set(items.map(i => i.player_id))];

const [teams, players] = await Promise.all([
  batchFetchTeams(teamIds),
  batchFetchPlayers(playerIds)
]);
```

## Quick Wins

### 1. Use the Batch Utility
```typescript
import { batchFetchTeamNames } from '@/lib/firebase-batch';

// Instead of loop
const teamNames = await batchFetchTeamNames(teamIds, seasonId);
```

### 2. SQL Batch Queries
```typescript
// Instead of N queries
const results = await sql`
  SELECT * FROM table 
  WHERE id = ANY(${ids})
`;
```

### 3. Parallel Operations
```typescript
// Run independent queries together
const [rounds, teams, players] = await Promise.all([
  fetchRounds(),
  fetchTeams(),
  fetchPlayers()
]);
```

## Implementation Checklist

For each API route:
- [ ] Identify all Firebase calls in loops
- [ ] Extract unique IDs
- [ ] Replace loop with `Promise.all()`
- [ ] Use `batchFetchTeamNames()` utility
- [ ] Test performance improvement
- [ ] Measure query count (before/after)

## Expected Results

| API | Before | After | Improvement |
|-----|--------|-------|-------------|
| /api/admin/rounds | 2-3s | 0.3s | 90% |
| /api/admin/tiebreakers | 2-4s | 0.4s | 85% |
| /api/team/dashboard | 1-2s | 0.2s | 90% |
| /api/team/bids | 2-3s | 0.4s | 85% |
| /api/players | 1-2s | 0.3s | 80% |

## Monitoring

Add timing logs:
```typescript
const start = Date.now();
// ... operation ...
console.log(`✅ Operation took ${Date.now() - start}ms`);
```

Target times:
- Simple queries: < 100ms
- Complex queries: < 500ms
- Full page load: < 1s

## Next Steps

1. Optimize top 5 high-priority APIs
2. Add performance monitoring
3. Test with real data
4. Measure improvements
5. Optimize remaining APIs

## Utility Functions Available

```typescript
// From lib/firebase-batch.ts
batchFetchTeamNames(teamIds, seasonId)
batchFetchUsers(userIds)
batchFetchTeamSeasons(teamIds, seasonId)
```

Use these everywhere you need Firebase data!
