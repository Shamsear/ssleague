# Player Swap History Backfill Guide

## The 3 Swaps That Need Backfilling

1. **Erling Haaland** ↔ **Moise Kean**
2. **Joao Palhinha** ↔ **Dominik Szoboszlai**
3. **Ivan Perisic** ↔ **Michael Olise**

## Step-by-Step Instructions

### Step 1: Verify Current State

First, check if the history records already exist:

```bash
npx tsx scripts/verify-swap-history.ts
```

**What it does:**
- Finds all swap transactions involving these 6 players
- Checks if player_history records exist
- Shows detailed status for each swap
- Tells you which swaps need backfilling

**Expected Output:**
```
🔍 Verifying player history for specific swaps...

Found 3 swaps involving target players:

📋 Swap: Erling Haaland ↔ Moise Kean
   Transaction ID: abc123
   Season: SSPSLS17
   
   Player A (Erling Haaland):
      ❌ NO HISTORY RECORDS FOUND
   
   Player B (Moise Kean):
      ❌ NO HISTORY RECORDS FOUND
   
   Summary:
      ❌ MISSING: Both players need history records

---

📊 Overall Summary:
   ✅ Complete: 0
   ❌ Need backfill: 3

💡 Run the backfill script to fix missing records:
   npx tsx scripts/backfill-specific-swaps.ts
```

### Step 2: Run the Backfill

If records are missing, run the backfill script:

```bash
npx tsx scripts/backfill-specific-swaps.ts
```

**What it does:**
- Finds all swap transactions involving these 6 players
- For each swap:
  - Gets current player data from database
  - Gets team names from Firebase
  - Closes old player_history records (if active)
  - Creates new player_history records for both players
  - Links everything with transaction ID

**Expected Output:**
```
🔄 Starting player history backfill for specific swaps...

Looking for swaps involving:
  - Erling Haaland
  - Moise Kean
  - Joao Palhinha
  - Dominik Szoboszlai
  - Ivan Perisic
  - Michael Olise

Found 3 swaps involving target players:

📋 Processing swap: Erling Haaland ↔ Moise Kean
   Transaction ID: abc123
   Season: SSPSLS17
   Player A: Erling Haaland (ID: 12345)
   Player B: Moise Kean (ID: 67890)
   Team A: Manchester City (SSPSLT0001)
   Team B: Juventus (SSPSLT0002)
   Closing old history records...
   ℹ️  No active history to close for Player A
   ℹ️  No active history to close for Player B
   Creating new history records...
   ✓ Created history for Erling Haaland → Juventus
   ✓ Created history for Moise Kean → Manchester City
   ✅ Successfully processed swap

📋 Processing swap: Joao Palhinha ↔ Dominik Szoboszlai
   ...
   ✅ Successfully processed swap

📋 Processing swap: Ivan Perisic ↔ Michael Olise
   ...
   ✅ Successfully processed swap

============================================================
✅ Backfill complete!
   Processed: 3
   Skipped (already exists): 0
   Errors: 0
   Total found: 3
============================================================

✨ Player history records created for:
   • Erling Haaland ↔ Moise Kean
   • Joao Palhinha ↔ Dominik Szoboszlai
   • Ivan Perisic ↔ Michael Olise

🎉 Done!
```

### Step 3: Verify Again

Run the verification script again to confirm:

```bash
npx tsx scripts/verify-swap-history.ts
```

**Expected Output (after successful backfill):**
```
📊 Overall Summary:
   ✅ Erling Haaland ↔ Moise Kean
   ✅ Joao Palhinha ↔ Dominik Szoboszlai
   ✅ Ivan Perisic ↔ Michael Olise

   Total swaps: 3
   Complete: 3
   Need backfill: 0

🎉 All swaps have complete history records!
```

## What Gets Created

For each swap, the script creates:

### 1. Player History Records (in Neon database)

**For Erling Haaland:**
```sql
-- Old record (closed)
UPDATE player_history 
SET status = 'swapped', 
    end_reason = 'swap',
    end_date = NOW()
WHERE player_id = 'haaland_id' 
  AND team_id = 'old_team_id'
  AND status = 'active';

-- New record (active)
INSERT INTO player_history (
  player_id, player_name, position,
  team_id, team_name, season_id,
  acquisition_type, acquisition_value,
  contract_start_season, contract_end_season,
  transaction_id, status
) VALUES (
  'haaland_id', 'Erling Haaland', 'Forward',
  'new_team_id', 'New Team Name', 'SSPSLS17',
  'swap', 1000,
  'SSPSLS17', 'SSPSLS17',
  'transaction_id', 'active'
);
```

**For Moise Kean:**
```sql
-- Same structure, but with Kean's data
```

### 2. Links to Existing Transaction

The script uses the existing `player_transactions` record in Firebase and links the history records to it via `transaction_id`.

## Troubleshooting

### Issue: "Player not found in database"

**Cause:** Player ID in transaction doesn't match database

**Solution:**
1. Check the player_id in the transaction
2. Search for the player in footballplayers table
3. If ID is wrong, manually update the transaction or skip

### Issue: "History already exists"

**Cause:** Records were already created (script ran before)

**Solution:** This is normal! The script will skip and show:
```
✓ History already exists for both players, skipping
```

### Issue: "Team name not found"

**Cause:** Team was deleted or ID changed

**Solution:** Script uses "Unknown Team" as fallback, but you can manually update later

### Issue: Script fails midway

**Cause:** Database connection or permission issue

**Solution:**
1. Check environment variables (NEON_DATABASE_URL, Firebase credentials)
2. Re-run the script - it will skip already processed swaps
3. Check error message for specific issue

## Manual Verification

### Check in Database

```sql
-- Check history for Haaland
SELECT * FROM player_history 
WHERE player_id = 'haaland_player_id'
ORDER BY acquisition_date DESC;

-- Check all swap history
SELECT ph.*, pt.player_a_name, pt.player_b_name
FROM player_history ph
LEFT JOIN player_transactions pt ON ph.transaction_id = pt.id
WHERE ph.acquisition_type = 'swap'
ORDER BY ph.acquisition_date DESC;
```

### Check in Firebase Console

1. Go to Firebase Console
2. Navigate to `player_transactions` collection
3. Filter by `transaction_type == 'swap'`
4. Look for transactions with your player names
5. Copy the transaction ID
6. Search for that ID in player_history table

## What If I Need to Re-run?

The scripts are **safe to run multiple times**:
- They check if records already exist
- They skip existing records
- They only create missing records
- No duplicates will be created

Just run:
```bash
npx tsx scripts/backfill-specific-swaps.ts
```

## Next Steps

After backfilling:

1. **Verify in UI:**
   - Go to player profile pages
   - Check "Contract History" section
   - Should see swap records

2. **Check Analytics:**
   - Swap history should now appear in reports
   - Player roadmap should be complete

3. **Future Swaps:**
   - All new swaps will automatically create history
   - No manual backfill needed

## Support

If you encounter issues:

1. Check the error message
2. Verify environment variables
3. Check database connectivity
4. Review the transaction data in Firebase
5. Run verification script to see current state

The scripts provide detailed output to help diagnose issues!
