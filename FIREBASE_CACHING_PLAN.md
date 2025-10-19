# Firebase Caching Implementation Plan

## Goal
Reduce Firebase reads by 90-95% using ISR (Incremental Static Regeneration) + Cloud Function Triggers

## Current Status

### ✅ Already Implemented
1. **Revalidation API**: `/api/revalidate`
2. **Cloud Functions**: Triggers for `team_seasons` and `footballplayers` (but footballplayers is in Neon, not Firebase)
3. **Cached API Routes** (but not used by client pages):
   - `/api/cached/teams` (15min TTL)
   - `/api/cached/players` (15min TTL - NEON, not Firebase)
   - `/api/cached/stats` (15min TTL)

## Firebase Collections to Cache

Based on your sports league (100 players, 20 teams, 50 matchups):

### High-Priority (Frequently Read)
1. **`team_seasons`** - Active season teams (20 docs)
2. **`seasons`** - Season info (1-2 docs)
3. **`fixtures`** - Matches/matchups (50 docs per season)
4. **`match_days`** - Round info (~10-20 docs)
5. **`round_deadlines`** - Deadline management (~10-20 docs)
6. **`match_matchups`** - Fixture results (50 docs)

### Medium-Priority (Moderately Read)
7. **`realplayers`** - Real player master data (100 docs)
8. **`real_players`** - Season-specific assignments (100 docs)
9. **`teamstats`** - Team statistics (20 docs)
10. **`categories`** - Player ratings (~10 docs)

### Low-Priority (Admin/Rarely Changed)
11. **`users`** - User accounts
12. **`invites`** - Admin invites
13. **`tournament_settings`** - Season config

## Proposed Cache Strategy

### Cache TTL by Data Type

| Collection | TTL | Why |
|-----------|-----|-----|
| **Historical seasons** | `false` (forever) | Never changes |
| **team_seasons** | 60s | Updates during matches |
| **fixtures** | 30s | Live match results |
| **match_matchups** | 30s | Live lineup/result entry |
| **match_days** | 120s | Only changes when admin activates |
| **round_deadlines** | 120s | Rarely updated |
| **realplayers** | 300s (5min) | Rarely changes |
| **teamstats** | 60s | Updates after matches |
| **categories** | 600s (10min) | Admin-managed, stable |
| **seasons** | 120s | Rarely changes |
| **users** | 300s (5min) | Profile updates |

## Implementation Steps

### Step 1: Create Cached API Endpoints

Create these new API routes:

```
/api/cached/firebase/teams → team_seasons
/api/cached/firebase/fixtures → fixtures
/api/cached/firebase/matchups → match_matchups
/api/cached/firebase/match-days → match_days
/api/cached/firebase/seasons → seasons
/api/cached/firebase/realplayers → realplayers
```

### Step 2: Update Cloud Functions

Add triggers for:
- `fixtures/{fixtureId}` → Clear fixtures + matchups cache
- `match_matchups/{matchupId}` → Clear matchups cache
- `match_days/{matchDayId}` → Clear match-days cache
- `teamstats/{statsId}` → Clear stats cache

### Step 3: Refactor Client Pages

Update these high-traffic pages to use cached APIs:

**Team Dashboard Pages** (Most Used):
- `/app/dashboard/team/page.tsx` - Uses team_seasons, seasons
- `/app/dashboard/team/matches/page.tsx` - Uses fixtures, match_days, round_deadlines
- `/app/dashboard/team/fixtures/[id]/page.tsx` - Uses fixtures, matchups
- `/app/dashboard/team/all-teams/page.tsx` - Uses team_seasons

**Committee Pages**:
- `/app/dashboard/committee/page.tsx` - Uses team_seasons, seasons
- `/app/dashboard/committee/teams/[id]/page.tsx` - Uses team_seasons

### Step 4: Deploy Cloud Functions

```bash
cd firebase-functions
npm install
firebase deploy --only functions
```

## Expected Results

### Before Optimization
- 1,000 daily users × 5 page views = 5,000+ Firebase reads/day
- Risk of hitting 50k free tier limit

### After Optimization
- Cached data: ~500-800 reads/day (85-90% reduction)
- Historical data: 0 reads (cached forever)
- Safe under 50k limit even with 10x growth

## Monitoring

Check Firebase Console → Firestore → Usage tab to track read count reduction.
