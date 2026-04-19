# Slot Validation Audit Report

**Date**: April 19, 2026  
**Scope**: All API routes and pages using `max_squad_size` or `max_football_players`

---

## 🎯 EXECUTIVE SUMMARY

**Critical Finding**: Bulk round finalization does NOT validate squad size limits before assigning players.

---

## 📊 AUDIT RESULTS

### ✅ USING DYNAMIC SLOTS (Correct)

1. **`app/api/team/bulk-rounds/[id]/route.ts`** ✅
   - Uses `football_total_slots` from teams table
   - Falls back to `max_squad_size` from auction_settings
   - **Status**: CORRECT

2. **`app/api/team/bulk-rounds/[id]/bids/route.ts`** ✅
   - Uses `football_total_slots` from teams table
   - Falls back to `MAX_SQUAD_SIZE` from auction_settings
   - Validates before accepting bids
   - **Status**: CORRECT

3. **`app/api/team/dashboard/route.ts`** ✅
   - Uses dynamic slot fields with full fallback chain
   - **Status**: CORRECT

4. **`app/dashboard/team/budget-planner/page.tsx`** ✅
   - Uses `football_total_slots` from team_seasons
   - Falls back to `max_football_players`
   - **Status**: CORRECT

5. **`app/dashboard/team/all-teams/page.tsx`** ✅
   - Uses `football_base_slots` or `max_football_players`
   - **Status**: CORRECT

6. **`app/dashboard/committee/team-slots/page.tsx`** ✅
   - Uses `football_base_slots` or `max_football_players`
   - **Status**: CORRECT

7. **`app/api/committee/manage-team-slots/route.ts`** ✅
   - Uses `football_base_slots` or `max_football_players`
   - **Status**: CORRECT

---

### ⚠️ USING HARDCODED VALUES (Needs Review)

8. **`lib/reserve-calculator.ts`** ⚠️
   - Uses `max_squad_size` from auction_settings
   - **Issue**: Should use team-specific `football_total_slots`
   - **Impact**: Reserve calculations may be incorrect for teams with purchased slots
   - **Priority**: MEDIUM

9. **`lib/finalize-round.ts`** ⚠️
   - Uses `max_squad_size` from auction_settings
   - **Issue**: Should use team-specific `football_total_slots`
   - **Impact**: Reserve calculations during finalization may be incorrect
   - **Priority**: MEDIUM

---

### ❌ NO SLOT VALIDATION (Critical)

10. **`app/api/admin/bulk-rounds/[id]/finalize/route.ts`** ❌
    - **NO squad size validation**
    - Assigns players without checking if team has available slots
    - Could allow teams to exceed their slot limits
    - **Priority**: HIGH - CRITICAL BUG

11. **`lib/finalize-bulk-tiebreaker.ts`** ❌
    - **NO squad size validation**
    - Assigns player to winner without checking slots
    - Could allow teams to exceed their slot limits
    - **Priority**: HIGH - CRITICAL BUG

---

### ✅ FANTASY LEAGUE (Separate System)

12-18. **Fantasy League Routes** ✅
    - Uses `max_squad_size` from `fantasy_leagues` table
    - This is a separate system from football slots
    - **Status**: CORRECT (different context)

---

## 🚨 CRITICAL ISSUES

### Issue #1: Bulk Round Finalization - No Slot Validation

**File**: `app/api/admin/bulk-rounds/[id]/finalize/route.ts`

**Problem**:
```typescript
// Current code - NO validation
await sql`
  UPDATE teams 
  SET 
    football_players_count = football_players_count + 1
  WHERE id = ${bid.team_id}
`;
```

**What Should Happen**:
1. Check team's `football_total_slots`
2. Check team's current `football_players_count`
3. Only assign if `football_players_count < football_total_slots`
4. Reject or skip if team is at capacity

**Impact**:
- Teams can exceed their slot limits
- Purchased slots are ignored
- Unfair advantage for teams at capacity

---

### Issue #2: Bulk Tiebreaker Finalization - No Slot Validation

**File**: `lib/finalize-bulk-tiebreaker.ts`

**Problem**:
```typescript
// Current code - NO validation
await sql`
  UPDATE teams 
  SET 
    football_players_count = football_players_count + 1
  WHERE id = ${winnerTeamId}
`;
```

**What Should Happen**:
1. Check winner's `football_total_slots`
2. Check winner's current `football_players_count`
3. Only assign if winner has available slots
4. Reject tiebreaker if winner is at capacity

**Impact**:
- Tiebreaker winners can exceed slot limits
- Could assign player to team with no slots

---

## 📋 RECOMMENDATIONS

### Priority 1: Fix Bulk Finalization (CRITICAL)

Add slot validation to `app/api/admin/bulk-rounds/[id]/finalize/route.ts`:

```typescript
// Before assigning player, check slots
const teamSlotCheck = await sql`
  SELECT 
    football_total_slots,
    football_players_count
  FROM teams
  WHERE id = ${bid.team_id}
  AND season_id = ${round.season_id}
`;

const team = teamSlotCheck[0];
const availableSlots = team.football_total_slots - team.football_players_count;

if (availableSlots <= 0) {
  console.warn(`⚠️ Team ${bid.team_id} has no available slots (${team.football_players_count}/${team.football_total_slots})`);
  // Skip this assignment or mark as failed
  continue;
}

// Proceed with assignment...
```

### Priority 2: Fix Tiebreaker Finalization (CRITICAL)

Add slot validation to `lib/finalize-bulk-tiebreaker.ts`:

```typescript
// Before assigning to winner, check slots
const winnerSlotCheck = await sql`
  SELECT 
    football_total_slots,
    football_players_count
  FROM teams
  WHERE id = ${winnerTeamId}
  AND season_id = ${tiebreaker.season_id}
`;

const winner = winnerSlotCheck[0];
const availableSlots = winner.football_total_slots - winner.football_players_count;

if (availableSlots <= 0) {
  return {
    success: false,
    error: `Winner team has no available slots (${winner.football_players_count}/${winner.football_total_slots})`
  };
}

// Proceed with assignment...
```

### Priority 3: Update Reserve Calculator (MEDIUM)

Update `lib/reserve-calculator.ts` to use team-specific slots:

```typescript
// Instead of using max_squad_size from auction_settings
// Get team's football_total_slots from teams table
const teamSlots = await sql`
  SELECT football_total_slots
  FROM teams
  WHERE id = ${teamId} AND season_id = ${seasonId}
`;

const emptySlots = teamSlots[0].football_total_slots - teamSquadSize;
```

---

## 📊 SUMMARY TABLE

| File | Uses Dynamic Slots | Validates Slots | Priority |
|------|-------------------|-----------------|----------|
| bulk-rounds/[id]/route.ts | ✅ Yes | ✅ Yes | ✅ OK |
| bulk-rounds/[id]/bids/route.ts | ✅ Yes | ✅ Yes | ✅ OK |
| bulk-rounds/[id]/finalize/route.ts | ❌ No | ❌ No | 🚨 CRITICAL |
| finalize-bulk-tiebreaker.ts | ❌ No | ❌ No | 🚨 CRITICAL |
| reserve-calculator.ts | ⚠️ Partial | N/A | ⚠️ MEDIUM |
| finalize-round.ts | ⚠️ Partial | N/A | ⚠️ MEDIUM |
| team/dashboard/route.ts | ✅ Yes | N/A | ✅ OK |
| committee/manage-team-slots | ✅ Yes | ✅ Yes | ✅ OK |

---

## 🎯 ACTION ITEMS

1. **URGENT**: Add slot validation to bulk round finalization
2. **URGENT**: Add slot validation to tiebreaker finalization
3. **MEDIUM**: Update reserve calculator to use dynamic slots
4. **MEDIUM**: Update finalize-round.ts to use dynamic slots
5. **LOW**: Add comprehensive tests for slot validation

---

## 🔍 TESTING RECOMMENDATIONS

After fixes, test these scenarios:

1. Team at 25/25 slots tries to bid in bulk round
2. Team at 25/25 slots wins tiebreaker
3. Team with 28/28 slots (purchased +3) tries to bid
4. Team with 22/25 slots can still bid
5. Reserve calculations for teams with different slot counts

---

## ✅ CONCLUSION

The dynamic slot system is implemented in most places, but **critical validation is missing** in bulk round and tiebreaker finalization. These must be fixed to prevent teams from exceeding their slot limits.
