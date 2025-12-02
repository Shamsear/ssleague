# Team Finance Audit Report

## Issue Summary

Team financial data (spending, budget, player counts, position counts) is inconsistent between:
1. **Neon Database** (`teams` table)
2. **Firebase** (`team_seasons` collection)
3. **Actual Player Data** (`footballplayers` table)

## Root Cause Analysis

### 1. Bulk Round Finalization ✅
**File:** `app/api/admin/bulk-rounds/[id]/finalize/route.ts`

**Status:** CORRECTLY UPDATES team stats

The bulk round finalization properly updates:
- ✅ `football_spent` (incremented by base_price)
- ✅ `football_budget` (decremented by base_price)
- ✅ `football_players_count` (incremented by 1)
- ✅ `position_counts` (incremented for player's position)
- ✅ Both Neon and Firebase are updated

### 2. Tiebreaker Resolution ❌
**File:** `lib/tiebreaker.ts` → `resolveTiebreaker()`

**Status:** DOES NOT UPDATE team stats

The tiebreaker resolution function:
- ❌ Only marks the winner in the `tiebreakers` table
- ❌ Does NOT update team budgets
- ❌ Does NOT update player counts
- ❌ Does NOT update position counts
- ❌ Does NOT update `footballplayers` table

**Code Evidence:**
```typescript
// Line ~450 in lib/tiebreaker.ts
await sql`
  UPDATE tiebreakers
  SET 
    status = 'resolved',
    winning_team_id = ${winningBid.team_id},
    winning_bid = ${winningBid.new_bid_amount},
    resolved_at = NOW()
  WHERE id = ${tiebreakerId}
`;

// NOTE: Budget updates and transaction logging happen during finalization
// The tiebreaker only marks the winner and winning amount
```

**The comment says "Budget updates happen during finalization" but there's NO finalization step after tiebreaker resolution!**

## Impact

When a tiebreaker is resolved:
1. The player is marked as won by a team
2. BUT the team's `football_spent` is NOT increased
3. BUT the team's `football_budget` is NOT decreased
4. BUT the team's `football_players_count` is NOT increased
5. BUT the team's `position_counts` are NOT updated
6. BUT Firebase `team_seasons` is NOT updated

This causes:
- ❌ Teams appear to have more budget than they actually have
- ❌ Player counts are incorrect
- ❌ Position counts are wrong
- ❌ Total spending doesn't match actual player acquisitions
- ❌ Discrepancies between Neon and Firebase

## Solution

### Step 1: Audit Current State

Run the audit script to identify all discrepancies:

```bash
node audit-team-finances.js
```

This will:
- Check all teams across all seasons
- Compare actual player data vs recorded data
- Generate a detailed report
- Save discrepancies to `team-finance-discrepancies.json`

### Step 2: Fix Existing Data

Run the fix script to correct all discrepancies:

```bash
# Dry run first (no changes)
node fix-team-finances.js

# Apply fixes
node fix-team-finances.js --apply
```

This will:
- Recalculate spending from `footballplayers` table
- Update `teams` table in Neon
- Update `team_seasons` in Firebase
- Recalculate position counts
- Fix budget calculations

### Step 3: Fix Tiebreaker Resolution Logic

The `resolveTiebreaker()` function needs to be updated to:
1. Update the `footballplayers` table with team assignment
2. Update the `teams` table (Neon) with spending and counts
3. Update the `team_seasons` (Firebase) with spending and counts
4. Log the transaction
5. Broadcast updates via WebSocket

## Files to Modify

### 1. `lib/tiebreaker.ts`
Update the `resolveTiebreaker()` function to include all the budget/player updates that are currently in the bulk round finalization.

### 2. Consider Creating a Shared Function
Extract the player allocation logic into a shared function that both:
- Bulk round finalization
- Tiebreaker resolution

Can use to ensure consistency.

## Verification Steps

After applying fixes:

1. **Check a specific team:**
```sql
-- Neon
SELECT 
  t.id,
  t.name,
  t.football_spent,
  t.football_budget,
  t.football_players_count,
  COUNT(fp.id) as actual_players,
  SUM(fp.acquisition_value) as actual_spent
FROM teams t
LEFT JOIN footballplayers fp ON fp.team_id = t.id AND fp.season_id = t.season_id AND fp.is_sold = true
WHERE t.id = 'TEAM_ID_HERE'
GROUP BY t.id, t.name, t.football_spent, t.football_budget, t.football_players_count;
```

2. **Check Firebase:**
```javascript
const teamSeasonDoc = await db.collection('team_seasons').doc('TEAM_ID_SEASON_ID').get();
console.log(teamSeasonDoc.data());
```

3. **Verify position counts:**
```sql
SELECT 
  position,
  COUNT(*) as count
FROM footballplayers
WHERE team_id = 'TEAM_ID_HERE'
AND season_id = 'SEASON_ID_HERE'
AND is_sold = true
GROUP BY position;
```

## Prevention

To prevent this issue in the future:

1. ✅ Always update team stats when a player is allocated
2. ✅ Use transactions to ensure atomicity
3. ✅ Add database constraints to validate data consistency
4. ✅ Add automated tests for player allocation
5. ✅ Consider adding a nightly reconciliation job

## Scripts Created

1. **`audit-team-finances.js`** - Comprehensive audit of all teams
2. **`fix-team-finances.js`** - Automated fix for discrepancies

## Next Steps

1. Run audit script to assess the damage
2. Review the discrepancies report
3. Run fix script in dry-run mode
4. Apply fixes with `--apply` flag
5. Update `lib/tiebreaker.ts` to prevent future issues
6. Add tests for tiebreaker resolution
7. Consider adding a reconciliation API endpoint for admins
