# Component Migration Strategy

## Overview

Migrate components from direct Firebase/Neon queries to custom React Query hooks.

---

## Components Found Using Direct Queries

### High Priority (Most Accessed)
1. **`app/seasons/page.tsx`** - Seasons list
2. **`app/teams/[id]/page.tsx`** - Team details with player stats
3. **Dashboard pages** - Stats and leaderboards

### Medium Priority
4. **`app/register/players/page.tsx`** - Player registration
5. **`app/register/team/page.tsx`** - Team registration

### Low Priority (Admin/Less Frequent)
6. Various admin pages
7. Old/deprecated pages (`page_old.tsx`)

---

## Migration Approach

### Step-by-Step Process:

**For each component:**
1. Identify current Firebase/Neon queries
2. Determine which hook(s) to use
3. Replace query code with hook
4. Update UI to use hook's loading/error states
5. Remove old imports
6. Test functionality

---

## Example Migrations

### Before: Direct Firebase Query
```typescript
// teams/[id]/page.tsx
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

function TeamPage() {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchPlayers = async () => {
      const playersRef = collection(db, 'realplayerstats');
      const playersQuery = query(
        playersRef,
        where('season_id', '==', seasonId),
        where('team', '==', teamId)
      );
      const playersSnapshot = await getDocs(playersQuery);
      setPlayers(playersSnapshot.docs.map(doc => doc.data()));
      setLoading(false);
    };
    fetchPlayers();
  }, [seasonId, teamId]);
}
```

### After: React Query Hook
```typescript
// teams/[id]/page.tsx
import { usePlayerStats } from '@/hooks';

function TeamPage() {
  const { data: players, isLoading } = usePlayerStats({
    seasonId: seasonId,
    teamId: teamId
  });
  
  // That's it! Automatic caching, loading states, error handling
}
```

---

## Priority 1: Seasons Page

**File:** `app/seasons/page.tsx`
**Current:** Direct Firebase query to fetch seasons
**Migration:** Keep Firebase (seasons is master data, low read count)
**Action:** No migration needed - seasons list is fine with Firebase

---

## Priority 2: Team Details Page

**File:** `app/teams/[id]/page.tsx`

### Current Queries:
- Fetches team player stats from `realplayerstats`
- Fetches player details from `realplayers`

### Migration Plan:
```typescript
// Replace Firebase queries with:
import { usePlayerStats } from '@/hooks';

const { data: playerStats } = usePlayerStats({
  seasonId: seasonId,
  teamId: teamId
});

// playerStats now includes all team players with their stats
// Cached for 2 minutes, auto-refreshes after matches
```

**Benefits:**
- Unlimited reads (Neon instead of Firebase)
- Automatic caching (2 min)
- No manual loading state management
- Auto-refresh after match updates

---

## Component-by-Component Plan

### ✅ Do Migrate (High Impact)

| Component | Current | Replace With | Cache | Impact |
|-----------|---------|--------------|-------|--------|
| Team Details | Firebase realplayerstats | `usePlayerStats` | 2 min | HIGH |
| Player Leaderboard | Firebase realplayerstats | `useLeaderboard` | 3 min | HIGH |
| Team Standings | Firebase teamstats | `useTeamStats` | 2 min | HIGH |
| Fixtures List | Firebase fixtures | `useFixtures` | 10 min | MEDIUM |
| Match Results | Firebase matches | `useMatches` | 5 min | MEDIUM |

### ❌ Don't Migrate (Keep Firebase)

| Component | Reason |
|-----------|--------|
| Seasons List | Master data, low reads |
| Team List | Master data, uses Firebase for reference |
| User Auth Pages | Firebase Auth integration |
| Registration Pages | Complex forms, master data updates |

---

## Implementation Priority

### Week 1: Stats & Leaderboards
- [ ] Migrate team details player stats
- [ ] Migrate leaderboard pages
- [ ] Migrate team standings

### Week 2: Tournament Features
- [ ] Migrate fixtures display
- [ ] Migrate match results
- [ ] Test match update flow

### Week 3: Polish & Testing
- [ ] Test all migrated components
- [ ] Monitor cache performance
- [ ] Fine-tune cache times
- [ ] Remove unused Firebase imports

---

## Testing Checklist

For each migrated component:

- [ ] Data displays correctly
- [ ] Loading states work
- [ ] Error handling works
- [ ] Cache is working (check React Query DevTools)
- [ ] Manual refresh works
- [ ] Updates trigger cache invalidation
- [ ] No console errors
- [ ] Performance improved (check Network tab)

---

## Rollback Plan

If issues occur:
1. Keep old code commented out during testing
2. Easy rollback: uncomment old code, remove hook
3. Test thoroughly before deleting old code

---

## Success Metrics

### Before Migration:
- Firebase reads: ~1,000/day per component
- Loading time: 500-1000ms
- Cache: None

### After Migration:
- Firebase reads: 0 (moved to Neon)
- Loading time: 50-200ms (cached)
- Cache: 2-10 minutes depending on data type
- **Target: 95%+ reduction in Firebase reads**

---

## Next Action

**START HERE:**
1. Migrate `app/teams/[id]/page.tsx` (highest impact)
2. Test thoroughly
3. Move to next component

Ready to start? Let's begin with the team details page!
