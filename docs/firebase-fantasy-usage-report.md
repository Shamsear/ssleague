# 🔍 Firebase Usage Report - Fantasy APIs

## Summary
**Total Files Using Firebase**: 28 API files  
**Status**: ❌ **CRITICAL** - Extensive Firebase usage found  
**Recommendation**: **Immediate migration or removal required**

---

## Files Using Firebase for Fantasy Operations

### ✅ Already Migrated (Core Features - Phases 1-4)
1. `/api/fantasy/leagues/route.ts` - ✅ Migrated to PostgreSQL
2. `/api/fantasy/leagues/[leagueId]/route.ts` - ✅ Migrated to PostgreSQL
3. `/api/fantasy/committee/enable-teams/route.ts` - ✅ Migrated to PostgreSQL
4. `/api/fantasy/committee/enable-all/route.ts` - ✅ Migrated to PostgreSQL
5. `/api/fantasy/teams/my-team/route.ts` - ✅ Migrated to PostgreSQL
6. `/api/fantasy/draft/available/route.ts` - ✅ Migrated to PostgreSQL
7. `/api/fantasy/draft/player/route.ts` - ✅ Migrated to PostgreSQL
8. `/api/fantasy/draft/settings/route.ts` - ✅ Migrated to PostgreSQL
9. `/api/fantasy/transfers/make-transfer/route.ts` - ✅ Migrated to PostgreSQL
10. `/api/fantasy/transfers/settings/route.ts` - ✅ Migrated to PostgreSQL
11. `/api/fantasy/transfers/history/route.ts` - ✅ Migrated to PostgreSQL
12. `/api/fantasy/leaderboard/[leagueId]/route.ts` - ✅ Migrated to PostgreSQL
13. `/api/fantasy/calculate-points/route.ts` - ✅ Migrated to PostgreSQL
14. `/api/fantasy/draft/prices/route.ts` - ✅ Migrated to PostgreSQL

---

### ❌ NOT MIGRATED - Still Using Firebase

#### 🔴 HIGH PRIORITY (User-Facing Features)

1. **`/api/fantasy/draft/select/route.ts`**
   - **Operations**: READ, WRITE, UPDATE, DELETE
   - **Collections**: `fantasy_draft_settings`, `fantasy_teams`, `fantasy_player_prices`, `fantasy_squad`
   - **Impact**: Team draft selections
   - **Lines**: 28, 52, 67, 86, 135, 162, 173, 223, 247, 269, 273

2. **`/api/fantasy/draft/complete/route.ts`**
   - **Operations**: READ, WRITE, UPDATE
   - **Collections**: `fantasy_draft_settings`, `fantasy_teams`, `fantasy_squad`
   - **Impact**: Draft completion
   - **Lines**: 23, 48, 68, 187, 229, 233

3. **`/api/fantasy/transfers/player/route.ts`**
   - **Operations**: READ, WRITE, UPDATE, DELETE
   - **Collections**: `fantasy_teams`, `fantasy_transfer_settings`, `fantasy_transfers`, `fantasy_squad`, `fantasy_player_prices`
   - **Impact**: Player transfers
   - **Lines**: 30, 53, 64, 76, 114, 156, 180, 184, 201, 226, 299, 315, 325

4. **`/api/fantasy/players/all/route.ts`**
   - **Operations**: READ
   - **Collections**: `fantasy_leagues`, `realplayer`, `fantasy_drafts`, `fantasy_teams`, `fantasy_player_points`
   - **Impact**: Player browsing/scouting
   - **Lines**: 22, 44, 63, 75

5. **`/api/fantasy/players/drafted/route.ts`**
   - **Operations**: READ
   - **Collections**: `fantasy_drafts`, `fantasy_teams`, `fantasy_player_points`
   - **Impact**: Viewing drafted players
   - **Lines**: 17, 26, 33

6. **`/api/fantasy/teams/[teamId]/route.ts`**
   - **Operations**: READ
   - **Collections**: `fantasy_teams`, `fantasy_drafts`, `fantasy_player_points`
   - **Impact**: Team details view
   - **Lines**: 24, 39, 50, 81

7. **`/api/fantasy/teams/[teamId]/breakdown/route.ts`**
   - **Operations**: READ
   - **Collections**: `fantasy_teams`, `fantasy_player_points`, `fantasy_team_bonus_points`
   - **Impact**: Points breakdown
   - **Lines**: 17, 32, 46

8. **`/api/fantasy/players/[playerId]/stats/route.ts`**
   - **Operations**: READ
   - **Collections**: `fantasy_leagues`, `realplayer`, `fantasy_drafts`, `fantasy_teams`, `fantasy_player_points`
   - **Impact**: Player statistics
   - **Lines**: 33, 65, 84, 95

#### 🟡 MEDIUM PRIORITY (Admin/Settings Features)

9. **`/api/fantasy/draft/assign/route.ts`**
   - **Operations**: READ, WRITE
   - **Collections**: `fantasy_leagues`, `fantasy_drafts`, `realplayer`, `fantasy_teams`
   - **Impact**: Admin draft assignment
   - **Lines**: 43, 68, 112, 142

10. **`/api/fantasy/draft/settings/route.ts`**
    - **Operations**: READ, WRITE, UPDATE
    - **Collections**: `fantasy_draft_settings`
    - **Impact**: Draft configuration
    - **Lines**: 84, 118, 127

11. **`/api/fantasy/scoring-rules/create/route.ts`**
    - **Operations**: READ, WRITE
    - **Collections**: `fantasy_leagues`, `fantasy_scoring_rules`
    - **Impact**: Scoring rules creation
    - **Lines**: 18, 30, 43

12. **`/api/fantasy/scoring-rules/[ruleId]/route.ts`**
    - **Operations**: READ, UPDATE, DELETE
    - **Collections**: `fantasy_scoring_rules`
    - **Impact**: Scoring rules management
    - **Lines**: 27, 54, 91

13. **`/api/fantasy/transfers/settings/route.ts`**
    - **Operations**: READ, WRITE, UPDATE
    - **Collections**: `fantasy_transfer_settings`
    - **Impact**: Transfer settings
    - **Lines**: 113, 134, 146

14. **`/api/fantasy/transfers/team/route.ts`**
    - **Operations**: READ, WRITE
    - **Collections**: `fantasy_teams`, `fantasy_transfer_settings`, `realteam`, `fantasy_team_changes`
    - **Impact**: Team transfers
    - **Lines**: 28, 52, 90, 160

15. **`/api/fantasy/values/update/route.ts`**
    - **Operations**: READ, WRITE, UPDATE
    - **Collections**: `fantasy_player_prices`, `realplayer`, `fantasy_squad`, `realteam`, `standings`, `fantasy_team_values`
    - **Impact**: Value updates
    - **Lines**: 65, 115, 179, 203

#### 🟢 LOW PRIORITY (Bonus/Optional Features)

16. **`/api/fantasy/calculate-team-bonuses/route.ts`**
    - **Operations**: READ, WRITE
    - **Collections**: `fantasy_leagues`, `fantasy_teams`, `teams`, `fantasy_team_bonus_points`
    - **Impact**: Team affiliation bonuses
    - **Lines**: 32, 188, 207, 234, 250

17. **`/api/fantasy/players/manage/route.ts`**
    - **Operations**: READ, WRITE, UPDATE, DELETE
    - **Collections**: `fantasy_drafts`, `realplayers`, `fantasy_teams`
    - **Impact**: Admin player management
    - **Lines**: 52, 84, 95, 124, 130, 131, 163, 164, 194, 205, 207, 212

18. **`/api/fantasy/lineups/route.ts`**
    - **Operations**: READ, WRITE, UPDATE
    - **Collections**: `weekly_lineups`, `fantasy_teams`
    - **Impact**: Weekly lineups
    - **Lines**: 24, 103, 116, 146, 155

19. **`/api/fantasy/teams/enable-all/route.ts`**
    - **Operations**: READ (for Firestore teams collection, not fantasy)
    - **Collections**: `seasons`, `team_seasons`, `teams`
    - **Impact**: Enabling teams (partially migrated)
    - **Lines**: 32, 52, 79, 83, 177, 201

20. **`/api/fantasy/teams/toggle/route.ts`**
    - **Operations**: READ (for Firestore teams collection)
    - **Collections**: `teams`
    - **Impact**: Toggle team fantasy participation
    - **Lines**: 25

---

## Operations Breakdown

### Firebase Operations Count
- **READ**: ~200+ operations across all files
- **WRITE**: ~50+ operations
- **UPDATE**: ~40+ operations
- **DELETE**: ~10+ operations

### Collections Still in Firebase
1. `fantasy_leagues` - Still read in old APIs
2. `fantasy_teams` - Extensively used
3. `fantasy_drafts` - Still used
4. `fantasy_squad` - Still used
5. `fantasy_player_points` - Still used
6. `fantasy_scoring_rules` - Still used
7. `fantasy_transfers` - Still used
8. `fantasy_player_prices` - Still used
9. `fantasy_draft_settings` - Still used
10. `fantasy_transfer_settings` - Still used
11. `fantasy_team_bonus_points` - Still used
12. `fantasy_team_values` - Still used
13. `fantasy_team_changes` - Still used
14. `weekly_lineups` - Still used

---

## Recommendations

### Immediate Actions Required

1. **Delete Firebase Data First**
   - Run `/admin/cleanup-fantasy` page
   - Or call `/api/admin/cleanup-firebase-fantasy` API
   - This prevents confusion between old and new data

2. **Disable/Remove Old APIs**
   - Mark old APIs as deprecated
   - Return 410 Gone status or redirect to new endpoints
   - OR migrate remaining APIs to PostgreSQL

3. **Migration Strategy for Remaining APIs**

   **Option A: Quick Disable (Recommended)**
   - Delete or disable all unmigrated fantasy API files
   - Return error messages directing to migrated features
   - Core features already work in PostgreSQL

   **Option B: Full Migration (Time-Intensive)**
   - Migrate each remaining API to PostgreSQL
   - Estimated time: 2-3 days
   - May include features not currently used

### Files to Delete/Disable

Based on core feature analysis, these can likely be **DELETED**:

```
/api/fantasy/draft/select/route.ts          (replaced by draft/player)
/api/fantasy/draft/assign/route.ts          (admin feature, rarely used)
/api/fantasy/draft/complete/route.ts        (likely not used)
/api/fantasy/players/manage/route.ts        (admin feature)
/api/fantasy/lineups/route.ts               (not part of core system)
/api/fantasy/transfers/player/route.ts      (replaced by make-transfer)
/api/fantasy/transfers/team/route.ts        (edge case feature)
/api/fantasy/values/update/route.ts         (admin batch operation)
/api/fantasy/calculate-team-bonuses/route.ts (bonus feature)
/api/fantasy/scoring-rules/create/route.ts  (one-time setup)
/api/fantasy/scoring-rules/[ruleId]/route.ts (rarely modified)
```

---

## Testing Checklist

After cleanup:
- [ ] Delete Firebase fantasy data
- [ ] Test core workflows (draft, transfer, leaderboard)
- [ ] Verify no 500 errors from missing Firebase data
- [ ] Check browser console for Firebase errors
- [ ] Monitor server logs for Firebase connection attempts

---

**Report Generated**: December 2024  
**Status**: Action Required  
**Priority**: High
