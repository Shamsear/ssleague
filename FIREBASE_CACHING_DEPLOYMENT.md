# Firebase Caching Implementation - Deployment Guide

## What Has Been Implemented

### ✅ Step 1: Cached API Endpoints Created
- `/api/cached/firebase/team-seasons` - 60s cache
- `/api/cached/firebase/seasons` - 120s cache
- `/api/cached/firebase/fixtures` - 30s cache
- `/api/cached/firebase/match-data` - 120s cache (includes match_days + round_deadlines)

### ✅ Step 2: Cloud Functions Updated
Added triggers for:
- `fixtures/{fixtureId}` → Clears fixtures cache, stats if result changes
- `match_days/{matchDayId}` → Clears match-data cache
- `round_deadlines/{roundId}` → Clears match-data cache
- `seasons/{seasonId}` → Clears seasons cache

### ✅ Step 3: Helper Hook Created
- `hooks/useCachedFirebase.ts` - React hook for easy cached data fetching
- Specialized hooks: `useCachedTeamSeasons`, `useCachedSeasons`, `useCachedFixtures`, `useCachedMatchData`

### ✅ Step 4: Revalidation API Updated
- Added support for new Firebase endpoints
- New revalidation types: `fixtures`, `matchups`, `seasons`, `match-data`

## Next Steps: Page Refactoring

### High-Priority Pages to Refactor

The following pages make direct Firebase calls and need to be refactored to use cached APIs:

1. **dashboard/team/page.tsx** - Team dashboard (uses team_seasons, seasons)
2. **dashboard/team/matches/page.tsx** - Matches list (uses fixtures, match_days, round_deadlines)
3. **dashboard/team/all-teams/page.tsx** - All teams view (uses team_seasons)
4. **dashboard/committee/page.tsx** - Committee dashboard (uses team_seasons, seasons)

### Example Refactoring

**Before (Direct Firebase calls):**
```tsx
const snapshot = await getDocs(
  query(
    collection(db, 'team_seasons'),
    where('season_id', '==', seasonId)
  )
);
const teams = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
```

**After (Using cached API):**
```tsx
import { useCachedTeamSeasons } from '@/hooks/useCachedFirebase';

function MyComponent() {
  const { data: teams, loading, error } = useCachedTeamSeasons({ seasonId });
  
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  
  return <div>{/* Use teams data */}</div>;
}
```

## Deployment Steps

### 1. Deploy Cloud Functions

```bash
cd firebase-functions
npm install
firebase deploy --only functions
```

Expected output:
```
✔ functions[onTeamChange]: Successful create operation.
✔ functions[onPlayerChange]: Successful create operation.
✔ functions[onFixtureChange]: Successful create operation.
✔ functions[onMatchDayChange]: Successful create operation.
✔ functions[onRoundDeadlineChange]: Successful create operation.
✔ functions[onSeasonChange]: Successful create operation.
```

### 2. Deploy Next.js Application

```bash
# If using Vercel
vercel --prod

# Or build and start
npm run build
npm run start
```

### 3. Test Caching

#### Test Cached Endpoints:
```bash
# Test team seasons
curl http://localhost:3000/api/cached/firebase/team-seasons?seasonId=YOUR_SEASON_ID

# Test fixtures
curl http://localhost:3000/api/cached/firebase/fixtures?seasonId=YOUR_SEASON_ID

# Test seasons
curl http://localhost:3000/api/cached/firebase/seasons?isActive=true
```

#### Test Cache Invalidation:
1. Update a fixture in Firebase Console
2. Wait 1-2 seconds for trigger to fire
3. Check Firebase Functions logs: `firebase functions:log`
4. Verify revalidation endpoint was called
5. Fetch cached endpoint again - should show updated data

### 4. Monitor Firebase Reads

1. Go to Firebase Console → Firestore → Usage
2. Check "Read" count before and after deployment
3. Expected reduction: **85-90%**

## Performance Expectations

### Before Optimization
```
Daily Reads Breakdown:
- Team Dashboard: 1000 users × 2 queries = 2,000 reads
- Matches Page: 1000 users × 3 queries = 3,000 reads  
- All Teams Page: 500 users × 1 query = 500 reads
Total: ~5,500 reads/day
```

### After Optimization (with 60s cache on team_seasons)
```
Daily Reads Breakdown:
- Team Seasons: 1440 reads/day (1 per minute)
- Fixtures: 2880 reads/day (1 per 30s)
- Seasons: 720 reads/day (1 per 2 min)
- Match Data: 720 reads/day (1 per 2 min)
Total: ~5,760 reads/day → But serves unlimited users!
```

**Key Benefit**: Read count is now independent of user count!

## Troubleshooting

### Cache Not Invalidating?

Check Cloud Functions logs:
```bash
firebase functions:log --only onFixtureChange
```

Verify environment variables are set:
```bash
firebase functions:config:get
```

Should show:
```json
{
  "revalidate": {
    "url": "https://your-domain.com/api/revalidate",
    "secret": "your-secret"
  }
}
```

### Still Seeing High Read Counts?

1. Check which pages are still using direct Firebase calls
2. Use browser Network tab to see if cached endpoints are being called
3. Verify ISR is working: check response headers for `x-vercel-cache: HIT`

## Optional: Deploy to Vercel Environment Variables

```bash
vercel env add REVALIDATE_URL production
# Enter: https://your-domain.vercel.app/api/revalidate

vercel env add REVALIDATE_SECRET production
# Use the same secret from .env.local
```

## Success Metrics

After 24 hours, check Firebase Console:
- ✅ Firestore reads should be <6,000/day (down from 50,000+ potential)
- ✅ 90%+ cache hit rate on API endpoints
- ✅ Page load times <500ms (cached data)
- ✅ No user-facing errors

## Next Phase (Optional)

To achieve 99% read reduction:
- Add Redis/Upstash for even lower TTLs
- Cache historical season data forever
- Implement edge caching with Vercel Edge Config
