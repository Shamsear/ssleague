# Quick Guide: Fix Team Finances

## Problem Summary

All 14 teams have incorrect financial data due to bulk tiebreaker resolutions not updating team stats.

## Solution: 3-Step Process

### Step 1: Review Current State ✅ DONE

```bash
node audit-team-finances.js
```

**Result**: All 14 teams have discrepancies
- Firebase player counts: ALL wrong (showing 27-31 instead of 25)
- Spending: 10 teams underreported by £2,776 total
- Position counts: ALL teams have mismatches

### Step 2: Preview Fixes (Dry Run)

```bash
node fix-team-finances.js
```

This will show you exactly what changes will be made WITHOUT actually making them.

**What it does:**
- Calculates correct spending from `footballplayers` table
- Calculates correct player counts
- Calculates correct position counts
- Shows before/after for each team
- Saves proposed changes to `team-finance-fixes.json`

### Step 3: Apply Fixes

```bash
node fix-team-finances.js --apply
```

This will actually update the databases.

**What it updates:**
- ✅ Neon `teams` table:
  - `football_players_count`
  - `football_spent`
  - `football_budget`
- ✅ Firebase `team_seasons` collection:
  - `players_count`
  - `total_spent` or `football_spent` (depending on currency system)
  - `budget` or `football_budget` (depending on currency system)
  - `position_counts`

### Step 4: Verify Fixes

Run the audit again to confirm everything is fixed:

```bash
node audit-team-finances.js
```

Expected result: "Teams with Discrepancies: 0"

## What Gets Fixed

### Example: Los Galacticos

**Before:**
- Actual: 25 players, £8,771 spent
- Neon: 25 players, £8,666 spent ❌
- Firebase: 30 players, £8,686 spent ❌

**After:**
- Actual: 25 players, £8,771 spent
- Neon: 25 players, £8,771 spent ✅
- Firebase: 25 players, £8,771 spent ✅

## Safety Features

1. **Dry Run by Default**: Won't make changes unless you use `--apply`
2. **Backup Recommended**: Consider backing up Firebase before applying
3. **Idempotent**: Safe to run multiple times
4. **Detailed Logging**: Shows exactly what's being changed
5. **JSON Output**: Saves all changes to file for review

## Expected Output

```
🔧 Starting Team Finance Fix...
Mode: DRY RUN (no changes)

✅ Firebase Admin initialized with service account

📊 Found 14 teams to process

================================================================================
🏆 Processing: Los Galacticos (SSPSLT0021) - SSPSLS16
================================================================================

📋 Calculated from footballplayers:
   Players: 25
   Total Spent: £8771.00
   Position Counts: { GK: 1, CB: 3, AMF: 3, ... }

💰 Budget Calculation:
   Initial Budget: £10000.00
   Spent: £8771.00
   Remaining Budget: £1229.00

🔧 UPDATES NEEDED:
   ✓ Neon teams table
      - football_spent: £8666.00 → £8771.00
      - football_budget: £1344.00 → £1229.00
   ✓ Firebase team_seasons

...

📊 FIX SUMMARY
================================================================================
Total Teams Processed: 14
Teams Fixed: 14
Teams Already Correct: 0

⚠️  This was a DRY RUN - no changes were made
   Run with --apply to apply fixes

💾 Fix details saved to: team-finance-fixes.json

✅ Process complete!
```

## Troubleshooting

### Error: "Cannot find module"
Make sure you're in the project root directory and have run `npm install`.

### Error: "Firebase initialization failed"
Check your `.env.local` file has the correct Firebase credentials:
- `FIREBASE_ADMIN_PROJECT_ID`
- `FIREBASE_ADMIN_CLIENT_EMAIL`
- `FIREBASE_ADMIN_PRIVATE_KEY`

### Error: "Database connection failed"
Check your `.env.local` file has:
- `DATABASE_URL` or `NEON_DATABASE_URL`

## After Fixing

Once you've applied the fixes, you need to prevent this from happening again:

### Update `lib/tiebreaker.ts`

The `resolveTiebreaker()` function needs to be updated to include all the budget/player updates that are currently only in the bulk round finalization.

See `TEAM_FINANCE_AUDIT_REPORT.md` for detailed technical analysis.

## Questions?

- Check `AUDIT_RESULTS_SUMMARY.md` for overview
- Check `TEAM_FINANCE_AUDIT_REPORT.md` for technical details
- Check `team-finance-discrepancies.json` for raw data
