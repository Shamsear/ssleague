# Remaining Pages Reading from Firebase

## Found: 5 More Pages Still Reading Stats from Firebase

These pages are currently querying Firebase directly for `realplayerstats` and `teamstats`. They should be migrated to use React Query hooks.

---

## Pages to Migrate

### 1. `/app/players/[id]/page.tsx` - Player Profile (Public)
**Current:** Reading from Firebase `realplayerstats`
```typescript
const statsRef = collection(db, 'realplayerstats');
const statsQuery = query(statsRef, where('player_id', '==', playerId));
const statsSnapshot = await getDocs(statsQuery);
```

**Should use:** `usePlayerStats({ playerId })`

**Priority:** Medium (public page, moderate traffic)

---

### 2. `/app/dashboard/players/[id]/page.tsx` - Dashboard Player Details
**Current:** Reading from Firebase `realplayerstats` and `teamstats`
```typescript
// Player stats
const statsRef = collection(db, 'realplayerstats');
const statsQuery = query(statsRef, where('player_id', '==', playerId));

// Team stats
const teamStatsRef = collection(db, 'teamstats');
const teamStatsQuery = query(teamStatsRef, where('season_id', '==', seasonId));
```

**Should use:**
- `usePlayerStats({ playerId })`
- `useTeamStats({ seasonId })`

**Priority:** Medium (dashboard page, user-specific)

---

### 3. `/app/dashboard/superadmin/seasons/[id]/page.tsx` - Superadmin Season View
**Current:** Reading from Firebase `realplayerstats` and `teamstats`
```typescript
// Player stats
const playerStatsQuery = query(
  collection(db, 'realplayerstats'),
  where('season_id', '==', seasonId)
);

// Team stats
const teamStatsQuery = query(
  collection(db, 'teamstats'),
  where('season_id', '==', seasonId)
);
```

**Should use:**
- `usePlayerStats({ seasonId })`
- `useTeamStats({ seasonId })`

**Priority:** Low (superadmin only, infrequent access)

---

### 4. `/app/dashboard/committee/team-management/player-awards/page.tsx` - Player Awards
**Current:** Reading from Firebase `realplayerstats`
```typescript
const playerStatsQuery = query(
  collection(db, 'realplayerstats'),
  where('season_id', '==', userSeasonId)
);
```

**Should use:** `usePlayerStats({ seasonId: userSeasonId })`

**Priority:** Low (admin only, infrequent use)

---

### 5. `/app/dashboard/committee/team-management/stats-leaderboard/page.tsx` - Stats Leaderboard
**Current:** Reading from Firebase `realplayerstats` and `teamstats`
```typescript
// Player stats
const playerStatsQuery = query(
  collection(db, 'realplayerstats'),
  where('season_id', '==', userSeasonId)
);

// Team stats
const teamStatsQuery = query(
  collection(db, 'teamstats'),
  where('season_id', '==', userSeasonId)
);
```

**Should use:**
- `usePlayerStats({ seasonId: userSeasonId })`
- `useTeamStats({ seasonId: userSeasonId })`

**Priority:** **HIGH** - This is a leaderboard page, likely high traffic!

---

## Summary

| Page | Firebase Reads | Hook to Use | Priority |
|------|----------------|-------------|----------|
| `/players/[id]` | realplayerstats | usePlayerStats | Medium |
| `/dashboard/players/[id]` | realplayerstats, teamstats | usePlayerStats, useTeamStats | Medium |
| `/dashboard/superadmin/seasons/[id]` | realplayerstats, teamstats | usePlayerStats, useTeamStats | Low |
| `/dashboard/committee/.../player-awards` | realplayerstats | usePlayerStats | Low |
| `/dashboard/committee/.../stats-leaderboard` | realplayerstats, teamstats | usePlayerStats, useTeamStats | **HIGH** |

---

## Estimated Impact

**If we migrate all 5:**
- Additional ~3,000-5,000 Firebase reads/day eliminated
- **Total reduction: 90%+** (from current 86%)
- Even better quota safety margin

**If we migrate just the HIGH priority (#5):**
- Additional ~2,000 Firebase reads/day eliminated
- **Total reduction: ~88-89%**
- Still significant improvement

---

## Recommendation

### Option 1: Migrate HIGH Priority Only
Migrate `/stats-leaderboard` page (#5) - biggest bang for buck

### Option 2: Migrate All 5
Complete the migration for maximum Firebase reduction

### Option 3: Leave As-Is
Current 86% reduction is already excellent. These pages are lower traffic.

---

## Migration Pattern (Same as Before)

```typescript
// 1. Import hook
import { usePlayerStats, useTeamStats } from '@/hooks';

// 2. Remove Firebase imports
// Remove: collection, query, where, getDocs from 'firebase/firestore'

// 3. Use hooks
const { data: playerStats, isLoading: statsLoading } = usePlayerStats({
  seasonId: userSeasonId
});

const { data: teamStats, isLoading: teamStatsLoading } = useTeamStats({
  seasonId: userSeasonId
});

// 4. Update loading condition
if (loading || statsLoading || teamStatsLoading) {
  return <LoadingSpinner />;
}

// 5. Use the data
playerStats?.map(...)
```

---

## Your Call!

**Do you want to:**
1. ✅ Migrate all 5 pages (90%+ reduction)
2. ✅ Migrate just #5 stats-leaderboard (88% reduction)
3. ✅ Leave as-is (86% reduction is good enough)

Let me know and I'll make the changes!
