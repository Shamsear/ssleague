# Firebase Read Optimization Plan
## Goal: Reduce from potential overuse to <500 reads per user per day

## Current Read Estimate
- 100 users/day × 50K limit = 500 reads per user maximum
- Target: 200-300 reads per user per day

---

## Strategy 1: Implement React Query Caching (PRIORITY 1)
**Impact: 60-80% reduction**

### What to do:
1. **Install React Query** (already installed: @tanstack/react-query)
2. **Set aggressive cache times**:
   ```typescript
   const queryClient = new QueryClient({
     defaultOptions: {
       queries: {
         staleTime: 5 * 60 * 1000, // 5 minutes
         cacheTime: 10 * 60 * 1000, // 10 minutes
         refetchOnWindowFocus: false,
         refetchOnMount: false,
       },
     },
   });
   ```

3. **Wrap app in QueryClientProvider** (already done in layout.tsx)

4. **Convert all data fetching to useQuery**:
   - Teams list: Cache for 5 minutes
   - Players list: Cache for 5 minutes
   - Season data: Cache for 10 minutes
   - User profile: Cache for 15 minutes

---

## Strategy 2: Move Static Data to Neon (PRIORITY 1)
**Impact: 30-50% reduction**

### Move these to Neon PostgreSQL:
✅ **footballplayers** (already has table structure)
- ✅ bids (already in Neon)
- ✅ rounds (already in Neon)
- ✅ auction_settings (already in Neon)

### Keep in Firebase (real-time needed):
- users (authentication)
- usernames
- invites
- import_progress

### Hybrid approach for:
- **teams**: Keep in Firebase, cache heavily
- **realplayers**: Keep in Firebase (linked to auth)
- **realplayerstats**: Keep in Firebase (updates frequently)
- **seasons**: Keep in Firebase (small dataset)

---

## Strategy 3: Implement Server-Side Caching (PRIORITY 2)
**Impact: 20-30% reduction**

### Create API routes with caching:
```typescript
// /app/api/teams/route.ts
import { unstable_cache } from 'next/cache';

export const GET = unstable_cache(
  async () => {
    const teams = await getAllTeams();
    return Response.json(teams);
  },
  ['teams-list'],
  { revalidate: 300 } // 5 minutes
);
```

### Cache these endpoints:
- `/api/teams` - 5 min cache
- `/api/seasons` - 10 min cache
- `/api/realplayers` - 5 min cache
- `/api/categories` - 10 min cache

---

## Strategy 4: Optimize Queries (PRIORITY 1)
**Impact: 10-20% reduction**

### Current Issues:
1. **Multiple reads for same data** in loops
2. **No field selection** (reading entire documents)
3. **Duplicate queries** on same page

### Solutions:

#### A. Batch reads instead of loops:
```typescript
// BEFORE (N reads):
for (const teamId of teamIds) {
  const team = await getDoc(doc(db, 'teams', teamId));
}

// AFTER (1 read):
const teams = await getDocs(
  query(collection(db, 'teams'), 
  where(documentId(), 'in', teamIds))
);
```

#### B. Select only needed fields:
```typescript
// Use projections in API routes
const teams = await adminDb.collection('teams')
  .select('team_name', 'team_code', 'owner_name')
  .get();
```

#### C. Denormalize frequently accessed data:
- Store `team_name` in player docs (already done ✅)
- Store `season_name` in stats docs (already done ✅)

---

## Strategy 5: Lazy Loading & Pagination (PRIORITY 2)
**Impact: 30-40% reduction**

### Implement on these pages:
- **Players list**: Load 20 at a time, infinite scroll
- **Stats leaderboard**: Load 25 at a time
- **Team list**: Load 10 at a time
- **Match history**: Load 15 at a time

```typescript
const [lastDoc, setLastDoc] = useState(null);

const loadMore = async () => {
  const q = query(
    collection(db, 'players'),
    orderBy('name'),
    startAfter(lastDoc),
    limit(20)
  );
  const snapshot = await getDocs(q);
  setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
};
```

---

## Strategy 6: Remove Real-time Listeners (PRIORITY 3)
**Impact: 40-60% reduction**

### Find and replace all `onSnapshot` with `getDocs`:
```typescript
// BEFORE (continuous reads):
onSnapshot(query(collection(db, 'teams')), (snapshot) => {
  // Updates on every change
});

// AFTER (one-time read):
const snapshot = await getDocs(query(collection(db, 'teams')));
```

### Use polling only when necessary:
- Auction rounds (every 30 seconds during active auction)
- Live match updates (every 60 seconds during match)

---

## Strategy 7: LocalStorage Caching (PRIORITY 2)
**Impact: 15-25% reduction**

### Cache in browser localStorage:
```typescript
const getCachedData = (key: string, fetchFn: () => Promise<any>, ttl = 300000) => {
  const cached = localStorage.getItem(key);
  if (cached) {
    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp < ttl) return data;
  }
  
  const data = await fetchFn();
  localStorage.setItem(key, JSON.stringify({
    data,
    timestamp: Date.now()
  }));
  return data;
};
```

### Cache these:
- User profile (15 min)
- Team details (5 min)
- Season info (10 min)
- Categories (10 min)

---

## Strategy 8: Optimize Football Players (PRIORITY 1)
**Impact: 30-50% reduction**

### Move football players to Neon completely:
1. Already have table structure ✅
2. Use Neon for all player queries
3. Keep only auction-related data in Firebase

### Benefits:
- Unlimited reads from Neon
- Better query performance
- No Firebase quota impact

---

## Implementation Priority

### Week 1 (Immediate):
1. ✅ Move footballplayers queries to Neon
2. ✅ Implement React Query caching
3. ✅ Remove unnecessary onSnapshot listeners
4. ✅ Add pagination to player lists

### Week 2:
5. ✅ Implement server-side caching
6. ✅ Optimize query patterns (batch reads)
7. ✅ Add localStorage caching

### Week 3:
8. ✅ Implement lazy loading on all lists
9. ✅ Add field selection to all queries
10. ✅ Test and monitor read counts

---

## Monitoring Reads

### Add to Firebase Console:
1. Go to Firebase Console > Usage
2. Check "Cloud Firestore" reads per day
3. Set alert at 40K reads/day (80% of limit)

### Add read counter to app:
```typescript
// Create a simple counter
let readCount = 0;

const trackedGetDocs = async (query) => {
  const result = await getDocs(query);
  readCount += result.size;
  console.log(`Total reads today: ${readCount}`);
  return result;
};
```

---

## Expected Results

### Before Optimization:
- ~1000 reads per user = 100,000 reads/day (OVER LIMIT)

### After Optimization:
- ~200-300 reads per user = 20,000-30,000 reads/day (40-60% of limit)

### Breakdown:
- Dashboard load: 50 reads → 10 reads (cache)
- Player browsing: 200 reads → 0 reads (Neon)
- Team pages: 100 reads → 20 reads (cache + batch)
- Stats pages: 150 reads → 30 reads (cache + pagination)
- Auction pages: 500 reads → 150 reads (polling + cache)

---

## Files to Modify

### High Priority:
- `lib/firebase/footballPlayers.ts` - Move to Neon
- `app/layout.tsx` - Configure React Query
- `app/dashboard/**/page.tsx` - Add useQuery hooks
- `lib/firebase/realPlayers.ts` - Add batching
- `lib/firebase/teams.ts` - Add batching

### Medium Priority:
- `app/api/teams/route.ts` - Add caching
- `app/api/players/route.ts` - Add caching
- Component files - Remove onSnapshot

---

## Quick Wins (Implement Today)

1. **Set React Query cache to 5 minutes**
2. **Move football players to Neon** (use existing table)
3. **Add pagination to lists** (20 items per page)
4. **Remove any onSnapshot** in dashboard pages

These 4 changes alone will reduce reads by 60-70%!
