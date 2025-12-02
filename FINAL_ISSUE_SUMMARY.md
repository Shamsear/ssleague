# Final Issue Summary - Team Finance Problems

## Root Cause

**Bulk tiebreaker resolution (`lib/tiebreaker.ts`) does NOT update team stats.**

When a tiebreaker is resolved, it only marks the winner but doesn't:
- ❌ Update team budgets
- ❌ Update player counts
- ❌ Update position counts
- ❌ Update the footballplayers table

## Issues Found

### 1. Spending Discrepancies (10 teams)
Teams have underreported spending because tiebreaker wins weren't counted:

| Team | Missing Spending |
|------|-----------------|
| La Masia | £520 |
| FC Barcelona | £452 |
| Portland Timbers | £400 |
| Psychoz | £331 |
| Varsity Soccers | £291 |
| Kopites | £289 |
| Los Blancos | £258 |
| Los Galacticos | £105 |
| Skill 555 | £105 |
| Qatar Gladiators | £25 |

**Total: £2,776 underreported**

### 2. Player Count Issues

**Neon (2 teams):**
- Psychoz: Shows 24, should be 25
- Skill 555: Shows 24, should be 25

**Firebase (ALL teams):**
- Firebase `players_count` is being incremented by 1 for each football player
- But it's not being incremented correctly during tiebreaker resolution
- Should be: `football_players + real_players`
- Currently showing: 27-31 (which might be correct if real players are counted elsewhere)
- **Needs verification and fixing**

### 3. Position Counts (ALL teams)
Firebase position counts don't match actual football player positions because tiebreaker wins don't update them.

### 4. Budget Calculations (10 teams)
Budgets are wrong because spending is underreported.

## What Needs to be Fixed

### In Neon Database (`teams` table):
1. ✅ `football_players_count` - Fix 2 teams (Psychoz, Skill 555)
2. ✅ `football_spent` - Fix 10 teams with underreported spending
3. ✅ `football_budget` - Recalculate based on correct spending

### In Firebase (`team_seasons` collection):
1. ✅ `football_spent` or `total_spent` - Fix 10 teams
2. ✅ `football_budget` or `budget` - Recalculate based on correct spending
3. ✅ `position_counts` - Fix ALL teams
4. ⚠️ `players_count` - Needs investigation and likely fixing

## Fix Strategy

### Step 1: Run Simplified Audit
```bash
node audit-team-finances-simple.js
```

This will show:
- Exact spending discrepancies
- Player count issues
- Position count mismatches
- Budget calculation errors

### Step 2: Create Fix Script
The fix script should:

1. **For each team:**
   - Query actual football players from `footballplayers` table
   - Calculate actual spending
   - Calculate actual player count
   - Calculate actual position counts
   - Calculate correct budget (10000 - actual_spent)

2. **Update Neon:**
   - Set `football_players_count` = actual count
   - Set `football_spent` = actual spending
   - Set `football_budget` = correct budget

3. **Update Firebase:**
   - Set `football_spent` (or `total_spent`) = actual spending
   - Set `football_budget` (or `budget`) = correct budget
   - Set `position_counts` = actual position counts
   - **Recalculate `players_count`** = football_players + real_players

### Step 3: Fix Tiebreaker Resolution Code
Update `lib/tiebreaker.ts` → `resolveTiebreaker()` to include all the updates that bulk round finalization does:

```typescript
// After marking winner:

// 1. Update footballplayers table
await sql`UPDATE footballplayers SET team_id = ..., is_sold = true, ...`;

// 2. Update Neon teams table
await sql`UPDATE teams SET 
  football_spent = football_spent + amount,
  football_budget = football_budget - amount,
  football_players_count = football_players_count + 1
`;

// 3. Update Firebase team_seasons
await teamSeasonRef.update({
  football_spent: ...,
  football_budget: ...,
  players_count: players_count + 1,
  position_counts: ...
});

// 4. Log transaction
await logAuctionWin(...);

// 5. Broadcast updates
await broadcastSquadUpdate(...);
await broadcastWalletUpdate(...);
```

## Priority

1. **HIGH**: Fix existing data (run fix script)
2. **HIGH**: Fix tiebreaker resolution code
3. **MEDIUM**: Add tests for tiebreaker resolution
4. **LOW**: Add nightly reconciliation job

## Files to Modify

1. `lib/tiebreaker.ts` - Add team stat updates to `resolveTiebreaker()`
2. Create comprehensive fix script
3. Add tests for tiebreaker resolution

## Verification

After fixes:
- All teams should have correct spending
- All teams should have correct player counts
- All teams should have correct budgets
- All teams should have correct position counts
- Neon and Firebase should be in sync
