# Firebase Quota Usage Analysis

## Current Quota Limits
- **Daily Reads**: 50,000
- **Daily Writes**: 20,000

## 🔴 HIGH-IMPACT OPERATIONS (Priority Fixes)

### 1. **Historical Season Detail Page** - `/api/seasons/historical/[id]/route.ts`
**Reads per page load**: 100-500+ (depending on team/player count)

**Issues**:
- Line 70-72: Loads ALL player stats for season (`realplayerstats` collection)
- Line 86-108: Batches of 10 player IDs to fetch permanent data (`realplayers`)
  - For 100 players = 10 queries * ~10 reads each = 100+ reads
- Line 44-47: Fetches all teams for season
- Line 52-54: Fetches all team stats for season
- Line 177-180: Fetches awards
- Line 190-193: Fetches matches

**Impact**: If 50 people view a historical season with 100 players = **25,000 reads/day** (50% of quota!)

**Recommendations**:
```typescript
// Add pagination for players
const PLAYERS_PER_PAGE = 25;
const page = parseInt(searchParams.get('page') || '1');
const playerStatsQuery = adminDb.collection('realplayerstats')
  .where('season_id', '==', seasonId)
  .limit(PLAYERS_PER_PAGE)
  .offset((page - 1) * PLAYERS_PER_PAGE);

// Cache the data with Next.js revalidation
export const revalidate = 3600; // Cache for 1 hour
```

### 2. **Historical Season Import** - `/api/seasons/historical/import/route.ts`
**Writes per import**: 500-2000+ (depending on data size)

**Issues**:
- Line 593: Individual `get()` call for each linked team (could be batched)
- Line 694-709: Creates Firebase Auth users one by one (no batching)
- Line 1311: Extra read to check if season exists
- Line 1420: Progress checks on every poll

**Impact**: Large import with 50 teams + 150 players = **1000+ writes**

**Recommendations**:
```typescript
// 1. Batch the team lookups
const linkedTeamIds = teams.filter(t => t.linked_team_id).map(t => t.linked_team_id);
if (linkedTeamIds.length > 0) {
  const chunks = chunkArray(linkedTeamIds, 10);
  for (const chunk of chunks) {
    const linkedTeams = await adminDb.collection('teams')
      .where(admin.firestore.FieldPath.documentId(), 'in', chunk)
      .get();
    // Process batch...
  }
}

// 2. Cache progress reads client-side
// Use longer polling intervals (5-10 seconds instead of 1-2 seconds)

// 3. Remove redundant season check (line 1311)
// Season was just created, no need to check again
```

### 3. **Historical Season Export** - `/api/seasons/historical/[id]/export/route.ts`
**Reads per export**: 100-500+

**Issues**:
- Line 46-49: Fetches all teams, teamstats, realplayers, realplayerstats
- Same pattern as the GET endpoint

**Impact**: Each export consumes similar reads to viewing the page

**Recommendations**:
- Use the same pagination/caching strategy
- Consider generating exports in background and caching the Excel file

## ⚠️ MEDIUM-IMPACT OPERATIONS

### 4. **Team Dashboard** - `/api/team/dashboard/route.ts`
Multiple collection queries per dashboard load

**Recommendations**:
- Cache team dashboard data for 5-10 minutes
- Combine multiple queries where possible

### 5. **Progress Polling**
Import progress checks happen frequently

**Recommendation**:
```typescript
// Client-side: Increase polling interval
const pollingInterval = status === 'completed' ? null : 5000; // 5 seconds instead of 1-2

// Server-side: Add cache headers
return NextResponse.json(progress, {
  headers: {
    'Cache-Control': 'private, max-age=5'
  }
});
```

## 💡 GENERAL OPTIMIZATIONS

### A. **Implement Caching Layer**
```typescript
// Add to Next.js API routes
export const revalidate = 3600; // 1 hour for historical data
export const dynamic = 'force-static'; // For truly static data
```

### B. **Add Pagination Everywhere**
```typescript
interface PaginationParams {
  page?: number;
  pageSize?: number;
}

// Apply to all list endpoints:
// - /api/seasons/historical/[id] (players list)
// - /api/team/players
// - Any other large data fetches
```

### C. **Use Firestore Indexes**
Ensure composite indexes exist for:
- `realplayerstats`: `season_id` + `team` + `category`
- `teamstats`: `season_id` + `team_id`
- `teams`: `seasons` (array) + `is_historical`

### D. **Client-Side Caching**
```typescript
// Use React Query or SWR for client-side caching
import { useQuery } from '@tanstack/react-query';

const { data } = useQuery({
  queryKey: ['season', seasonId],
  queryFn: () => fetchSeason(seasonId),
  staleTime: 1000 * 60 * 60, // 1 hour
  cacheTime: 1000 * 60 * 60 * 24 // 24 hours
});
```

### E. **Lazy Loading**
```typescript
// Don't load all data at once
// Load overview first, then load tabs on demand

// Overview tab: Just season info + counts
// Teams tab: Load when clicked
// Players tab: Load when clicked + paginated
// Stats tab: Load when clicked + paginated
```

## 📊 ESTIMATED IMPACT

### Current Usage (Estimated for busy day):
- 100 historical season page views = 30,000 reads
- 10 imports = 10,000 writes  
- 50 exports = 15,000 reads
- Other operations = 20,000 reads

**Total**: 65,000 reads (exceeds quota!)

### After Optimizations:
- 100 historical season page views with pagination = 5,000 reads (6x reduction)
- 10 imports with batching = 7,000 writes (30% reduction)
- 50 exports with caching = 3,000 reads (5x reduction)
- Other operations = 20,000 reads

**Total**: 28,000 reads + 7,000 writes (within quota!)

## 🚀 QUICK WINS (Implement First)

1. **Add pagination to historical season detail page** (lines 70-160 in route.ts)
2. **Increase progress polling interval from 1-2s to 5s**
3. **Add Next.js revalidation to historical season GET route**
4. **Cache player permanent data lookups**
5. **Remove redundant season existence check in import**

## 📝 Implementation Priority

**Phase 1 (Urgent - Do Now)**:
- Pagination for player lists
- Caching for historical season data
- Optimize progress polling

**Phase 2 (Important - This Week)**:
- Batch team lookups in import
- Client-side caching with React Query
- Lazy loading for tabs

**Phase 3 (Nice to Have - This Month)**:
- Background export generation
- Full query optimization audit
- Implement Firestore composite indexes
