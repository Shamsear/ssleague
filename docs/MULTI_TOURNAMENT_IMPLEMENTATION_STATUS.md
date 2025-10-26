# Multi-Tournament Architecture - Implementation Status

**Started:** October 24, 2025, 11:27 PM  
**Status:** ⚙️ IN PROGRESS (Phase 1 & 2 Complete)

---

## 🎯 Goal

Transform the system from **single-tournament-per-season** to **multi-tournament-per-season** architecture, enabling:

- ✅ League (Round-robin)
- ✅ Cup (Knockout)
- ✅ Champions League (Group + Knockout)
- ✅ Europa League (Group + Knockout)
- ✅ Super Cup
- ✅ League Cup

All running simultaneously in the same season!

---

## ✅ Phase 1: Database Migration - COMPLETE

### Tables Created
- ✅ `tournaments` - Master tournament table
- ✅ Added `tournament_id` to `fixtures`
- ✅ Added `tournament_id` to `realplayerstats`
- ✅ Added `tournament_id` to `teamstats`
- ✅ Added `tournament_id` to `matchups`
- ✅ Added `tournament_id` to `fixture_audit_log`
- ✅ Added `tournament_id` to `tournament_settings`

### Data Migration
- ✅ Created default "LEAGUE" tournaments for all existing seasons
- ✅ Migrated 96 player stat records
- ✅ Migrated 22 team stat records  
- ✅ Set tournament_id for all existing data

### Constraints & Indexes
- ✅ PRIMARY KEY updated on `tournament_settings` (now `tournament_id`)
- ✅ PRIMARY KEY updated on `realplayerstats` (now `player_id, tournament_id`)
- ✅ PRIMARY KEY updated on `teamstats` (now `team_id, tournament_id`)
- ✅ Foreign keys added to all tables → `tournaments(id)`
- ✅ Performance indexes created on `tournament_id` columns

### Scripts Created
1. ✅ `01-create-multi-tournament-architecture.ts` - Schema changes
2. ✅ `02-migrate-existing-data.ts` - Data population
3. ✅ `02b-cleanup-orphaned-data.ts` - Orphaned data cleanup
4. ✅ `03-add-constraints.ts` - Constraints and indexes

---

## ✅ Phase 2: Tournament Management APIs - COMPLETE

### New API Routes Created

#### `/api/tournaments` (List & Create)
```typescript
GET  /api/tournaments
     ?season_id=SSPSLS16           // Filter by season
     &status=active                // Filter by status

POST /api/tournaments
     Body: {
       season_id: "SSPSLS16",
       tournament_type: "league",  // league|cup|ucl|uel|super_cup|league_cup
       tournament_name: "Premier League",
       tournament_code: "PL",
       status: "upcoming",          // upcoming|active|completed|cancelled
       is_primary: true,
       display_order: 1
     }
```

#### `/api/tournaments/[id]` (Single Tournament Operations)
```typescript
GET    /api/tournaments/SSPSLS16-LEAGUE    // Get tournament
PATCH  /api/tournaments/SSPSLS16-LEAGUE    // Update tournament  
DELETE /api/tournaments/SSPSLS16-LEAGUE    // Delete tournament (cascade)
```

---

## ⏳ Phase 3: Update Existing APIs - IN PROGRESS

### APIs That Need Tournament Support

The following APIs need to be updated to accept `tournament_id` parameter:

#### High Priority (Core Functionality)
1. ⏳ `/api/fixtures/season/route.ts`
   - Add `tournament_id` param
   - Filter fixtures by tournament
   
2. ⏳ `/api/stats/players/route.ts`
   - Add `tournament_id` param
   - Query by `tournament_id` instead of just `season_id`
   
3. ⏳ `/api/stats/teams/route.ts`
   - Add `tournament_id` param
   - Query by `tournament_id` instead of just `season_id`

4. ⏳ `/api/tournament-settings/route.ts`
   - Already has `tournament_id` in database
   - Update API to use it instead of `season_id`

5. ⏳ `/api/fixtures/bulk/route.ts`
   - Require `tournament_id` when creating fixtures

#### Medium Priority (Match Operations)
6. ⏳ `/api/realplayers/update-stats/route.ts`
7. ⏳ `/api/realplayers/update-points/route.ts`
8. ⏳ `/api/fixtures/team/route.ts`
9. ⏳ All `/api/fixtures/[fixtureId]/*` routes (lineup, matchups, etc.)

#### Low Priority (Historical)
10. ⏳ `/api/seasons/historical/[id]/route.ts`
11. ⏳ `/api/seasons/historical/[id]/export/route.ts`

---

## ⏳ Phase 4: React Hooks - PENDING

### New Hooks to Create

```typescript
// hooks/useTournaments.ts
export function useTournaments(seasonId?: string, status?: string)
export function useTournament(tournamentId: string)
```

### Hooks to Update

```typescript
// hooks/usePlayerStats.ts
- usePlayerStats({ seasonId, teamId })
+ usePlayerStats({ tournamentId, seasonId, teamId })

// hooks/useTeamStats.ts  
- useTeamStats({ seasonId, teamId })
+ useTeamStats({ tournamentId, seasonId, teamId })

// hooks/useFixtures.ts
- useFixtures({ seasonId, teamId })
+ useFixtures({ tournamentId, seasonId, teamId })
```

---

## ⏳ Phase 5: Frontend Components - PENDING

### New Components Needed

1. **Tournament Selector** (`components/TournamentSelector.tsx`)
   - Dropdown to switch between tournaments
   - Shows tournament type icons (🏆 League, 🏅 Cup, ⭐ UCL)
   
2. **Tournament Dashboard** (`app/dashboard/tournaments/page.tsx`)
   - Overview of all tournaments in active season
   - Status indicators
   - Quick stats per tournament

3. **Tournament Context** (`contexts/TournamentContext.tsx`)
   - Manages active tournament selection
   - Persists in localStorage

### Components to Update

#### Critical Updates (10+ components)
- All leaderboard pages
- All stats pages  
- Fixture pages
- Team dashboard
- Player profiles
- Committee management pages

---

## 📊 Example Use Case

### Season: SSPSLS16

```typescript
// Multiple tournaments in one season
const tournaments = [
  {
    id: 'SSPSLS16-LEAGUE',
    type: 'league',
    name: 'Premier League',
    status: 'active',
    teams: 20
  },
  {
    id: 'SSPSLS16-CUP',
    type: 'cup',
    name: 'FA Cup',
    status: 'active',
    teams: 20
  },
  {
    id: 'SSPSLS16-UCL',
    type: 'ucl',
    name: 'Champions League',
    status: 'upcoming',
    teams: 4  // Top 4 from last season
  }
];

// Player stats are tracked separately per tournament
{
  player_id: 'player-123',
  tournaments: {
    'SSPSLS16-LEAGUE': { goals: 15, points: 200 },
    'SSPSLS16-CUP': { goals: 3, points: 45 },
    'SSPSLS16-UCL': { goals: 7, points: 120 }
  },
  total: { goals: 25, points: 365 } // Aggregated
}
```

---

## 🚀 Next Steps (Immediate)

### Step 1: Update Core Stats APIs (2-3 hours)
Update these 3 critical APIs to support `tournament_id`:
- `/api/stats/players/route.ts`
- `/api/stats/teams/route.ts`
- `/api/fixtures/season/route.ts`

### Step 2: Create Tournament Hooks (1-2 hours)
- `useTournaments.ts` - Fetch tournaments
- `useTournament.ts` - Single tournament
- Update `usePlayerStats.ts` to support tournament_id

### Step 3: Create Tournament Selector Component (1 hour)
- Dropdown showing all tournaments in season
- Icon for each tournament type
- Stores selection in context

### Step 4: Update Key Pages (2-3 hours)
- Team dashboard - Add tournament selector
- Stats leaderboard - Filter by tournament
- Fixtures page - Group by tournament

---

## 📈 Benefits After Full Implementation

✅ **Multiple Competitions:** Run League + Cup + UCL simultaneously  
✅ **Separate Standings:** Each tournament has its own leaderboard  
✅ **Separate Stats:** Track player/team performance per tournament  
✅ **Aggregated View:** See combined stats across all tournaments  
✅ **Flexible Scheduling:** Tournaments can overlap or be sequential  
✅ **Better UX:** Users can switch between tournaments easily  

---

## ⚠️ Breaking Changes

**APIs:**
- Most stats and fixtures APIs will require `tournament_id` parameter
- Old endpoints using only `season_id` will return PRIMARY tournament data
- Backward compatibility maintained via fallback to primary tournament

**Database:**
- Primary keys changed on `realplayerstats` and `teamstats`
- Foreign key constraints added
- Cannot delete tournament without deleting all related data (cascade)

---

## 📋 Testing Checklist

- [ ] Create multiple tournaments for same season
- [ ] Create fixtures in different tournaments
- [ ] Submit match results for different tournaments
- [ ] View player stats filtered by tournament
- [ ] View team standings per tournament
- [ ] View aggregated stats across all tournaments
- [ ] Switch between tournaments in UI
- [ ] Delete tournament (verify cascade)

---

## 🎉 Current Status Summary

### Completed ✅
- Database schema (100%)
- Data migration (100%)
- Tournament management APIs (100%)
- Migration scripts (100%)
- Documentation (100%)

### In Progress ⏳
- Updating existing APIs (0%)

### Pending ⏳
- React hooks (0%)
- Frontend components (0%)
- Testing (0%)

### Overall Progress: **40%**

---

**Estimated Remaining Time:** 8-12 hours  
**Target Completion:** Ready for testing in 1-2 days  
**Production Ready:** 3-4 days with full testing  

---

**Last Updated:** October 24, 2025, 11:30 PM
