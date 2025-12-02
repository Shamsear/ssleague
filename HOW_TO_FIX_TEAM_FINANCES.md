# How to Fix Team Finances - Complete Guide

## Problem Summary

ALL 14 teams in Season 16 have incorrect financial data because bulk tiebreaker resolutions don't update team statistics.

**Issues:**
- ❌ £2,796 underreported spending (11 teams)
- ❌ Wrong player counts (2 teams in Neon, all teams in Firebase)
- ❌ Wrong position counts (all teams)
- ❌ Wrong budgets (11 teams)

## Step-by-Step Fix Process

### Step 1: Review Current Issues

```bash
node audit-team-finances-simple.js
```

This shows you exactly what's wrong with each team. Check the output and review `team-finance-issues.json`.

### Step 2: Preview Fixes (Dry Run)

```bash
node fix-team-finances-complete.js
```

This will show you exactly what changes will be made WITHOUT actually making them. Review the output carefully.

**What it shows:**
- Current values in Neon and Firebase
- Calculated correct values
- Exact changes that will be made
- Summary of how many teams need fixing

### Step 3: Apply Fixes

Once you're confident the changes are correct:

```bash
node fix-team-finances-complete.js --apply
```

This will actually update both databases.

**What it updates:**

**Neon `teams` table:**
- `football_players_count` → Correct count from footballplayers table
- `football_spent` → Actual total spending
- `football_budget` → 10000 - actual_spent

**Firebase `team_seasons` collection:**
- `players_count` → football_players + real_players
- `football_spent` or `total_spent` → Actual spending
- `football_budget` or `budget` → Correct budget
- `position_counts` → Actual position distribution

### Step 4: Verify Fixes

Run the audit again to confirm everything is fixed:

```bash
node audit-team-finances-simple.js
```

Expected output:
```
Teams with Issues: 0
Teams Correct: 14
```

## What Gets Fixed - Examples

### Example 1: Los Galacticos
**Before:**
- Neon: 25 players, £8,666 spent, £1,344 budget
- Firebase: 30 players, £8,686 spent
- Actual: 25 football players, £8,771 spent

**After:**
- Neon: 25 players, £8,771 spent, £1,229 budget ✅
- Firebase: 30 players (25 football + 5 real), £8,771 spent ✅

**Fix:** Added missing £105 from tiebreaker win

### Example 2: Psychoz
**Before:**
- Neon: 24 players, £8,431 spent
- Firebase: 29 players, £8,441 spent
- Actual: 25 football players, £8,762 spent

**After:**
- Neon: 25 players, £8,762 spent, £1,238 budget ✅
- Firebase: 30 players (25 football + 5 real), £8,762 spent ✅

**Fix:** Added missing player and £331 from tiebreaker win

## Safety Features

1. **Dry Run by Default**: Won't make changes unless you use `--apply`
2. **Detailed Logging**: Shows exactly what's being changed
3. **JSON Output**: Saves all changes to file for review
4. **Idempotent**: Safe to run multiple times
5. **Validation**: Calculates from source of truth (footballplayers table)

## After Fixing Data

### Prevent Future Issues

You need to update `lib/tiebreaker.ts` to include team stat updates. The `resolveTiebreaker()` function should do everything that bulk round finalization does:

```typescript
// After marking winner in tiebreaker resolution:

// 1. Update footballplayers table
await sql`
  UPDATE footballplayers
  SET 
    is_sold = true,
    team_id = ${winningBid.team_id},
    acquisition_value = ${winningBid.new_bid_amount},
    status = 'active',
    contract_id = ${contractId},
    contract_start_season = ${tiebreaker.season_id},
    contract_end_season = ${contractEndSeason},
    contract_length = ${contractDuration},
    season_id = ${tiebreaker.season_id},
    round_id = ${tiebreaker.round_id},
    updated_at = NOW()
  WHERE id = ${tiebreaker.player_id}
`;

// 2. Update Neon teams table
await sql`
  UPDATE teams 
  SET 
    football_spent = football_spent + ${winningBid.new_bid_amount},
    football_budget = football_budget - ${winningBid.new_bid_amount},
    football_players_count = football_players_count + 1,
    updated_at = NOW()
  WHERE id = ${winningBid.team_id}
  AND season_id = ${tiebreaker.season_id}
`;

// 3. Update Firebase team_seasons
const teamSeasonRef = adminDb.collection('team_seasons').doc(`${winningBid.team_id}_${tiebreaker.season_id}`);
const teamSeasonSnap = await teamSeasonRef.get();

if (teamSeasonSnap.exists) {
  const teamSeasonData = teamSeasonSnap.data();
  const isDualCurrency = teamSeasonData?.currency_system === 'dual';
  const currentBudget = isDualCurrency
    ? (teamSeasonData?.football_budget || 0)
    : (teamSeasonData?.budget || 0);

  // Get player position for position counts
  const playerPosition = playerInfo?.position;
  const positionCounts = teamSeasonData?.position_counts || {};
  if (playerPosition && playerPosition in positionCounts) {
    positionCounts[playerPosition] = (positionCounts[playerPosition] || 0) + 1;
  }

  const updateData = {
    total_spent: (teamSeasonData?.total_spent || 0) + winningBid.new_bid_amount,
    players_count: (teamSeasonData?.players_count || 0) + 1,
    position_counts: positionCounts,
    updated_at: new Date()
  };

  if (isDualCurrency) {
    updateData.football_budget = currentBudget - winningBid.new_bid_amount;
    updateData.football_spent = (teamSeasonData?.football_spent || 0) + winningBid.new_bid_amount;
  } else {
    updateData.budget = currentBudget - winningBid.new_bid_amount;
  }

  await teamSeasonRef.update(updateData);
}

// 4. Log transaction
await logAuctionWin(
  firebaseUid,
  tiebreaker.season_id,
  playerInfo?.player_name || 'Unknown Player',
  tiebreaker.player_id,
  'football',
  winningBid.new_bid_amount,
  currentBudget,
  tiebreaker.round_id
);

// 5. Broadcast updates
await broadcastSquadUpdate(tiebreaker.season_id, winningBid.team_id, {
  player_id: tiebreaker.player_id,
  player_name: playerInfo?.player_name || 'Unknown Player',
  action: 'acquired',
  price: winningBid.new_bid_amount,
});

await broadcastWalletUpdate(tiebreaker.season_id, winningBid.team_id, {
  new_balance: isDualCurrency ? updateData.football_budget : updateData.budget,
  amount_spent: winningBid.new_bid_amount,
  currency_type: isDualCurrency ? 'football' : 'single',
});
```

## Troubleshooting

### Error: "Cannot find module"
Make sure you're in the project root and have run `npm install`.

### Error: "Firebase initialization failed"
Check your `.env.local` file has correct Firebase credentials.

### Error: "Database connection failed"
Check your `.env.local` file has `DATABASE_URL` or `NEON_DATABASE_URL`.

### Numbers don't look right
The script calculates from the `footballplayers` table as the source of truth. If those numbers seem wrong, check that table first.

## Files Reference

- **`audit-team-finances-simple.js`** - Identifies all issues
- **`fix-team-finances-complete.js`** - Fixes all issues
- **`team-finance-issues.json`** - Detailed issue breakdown
- **`team-finance-fixes-applied.json`** - Record of what was fixed
- **`TEAM_FINANCE_FIX_REPORT.md`** - Executive summary
- **`FINAL_ISSUE_SUMMARY.md`** - Technical details

## Questions?

If you're unsure about anything:
1. Run the audit to see current state
2. Run the fix in dry-run mode to preview changes
3. Review the JSON files for detailed data
4. Check this guide for explanations

The fix is safe and reversible if needed (you can always recalculate from the footballplayers table).
