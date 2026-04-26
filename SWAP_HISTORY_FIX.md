# Player Swap History & Transaction Fix

## Issues Fixed

### 1. ❌ Player History Not Created
**Problem:** When players were swapped, no records were created in the `player_history` table.

**Solution:** Added player history tracking to both swap endpoints:
- Close old history records with status 'swapped'
- Create new history records for both players with their new teams
- Link to transaction ID for traceability

### 2. ❌ Transactions Not Created in Firebase
**Problem:** Swap operations were not creating records in the `player_transactions` collection.

**Solution:** Added transaction record creation in both endpoints:
- Creates a document in `player_transactions` collection
- Includes both players, teams, season, and swap details
- Links player history records to transaction ID

## Changes Made

### Files Modified

#### 1. `app/api/players/simple-swap/route.ts`
- Added imports for player history functions
- After database COMMIT, now:
  1. Creates `player_transactions` record in Firebase
  2. Closes old `player_history` records for both players
  3. Creates new `player_history` records for both players
  4. Logs transaction ID for traceability

#### 2. `app/api/players/bulk-swap/route.ts`
- Added imports for player history functions
- For each swap pair:
  1. Creates `player_transactions` record in Firebase
  2. Closes old `player_history` records
  3. Creates new `player_history` records
  4. Links all records with transaction ID

### New Files Created

#### 3. `scripts/backfill-swap-history.ts`
- Backfill script for existing swaps
- Reads all past swap transactions from Firebase
- Creates missing player history records
- Safe to run multiple times (checks for existing records)

## Player History Structure

### Closed Record (Old Team)
```typescript
{
  player_id: "38439",
  player_name: "Player A",
  position: "Forward",
  team_id: "SSPSLT0001",
  team_name: "Team Alpha",
  season_id: "SSPSLS17",
  acquisition_type: "auction", // or previous type
  acquisition_value: 500,
  contract_start_season: "SSPSLS17",
  contract_end_season: "SSPSLS17",
  status: "swapped",  // Changed from "active"
  end_date: "2025-01-15T10:30:00Z",
  end_reason: "swap",
  transaction_id: "abc123",
  updated_at: "2025-01-15T10:30:00Z"
}
```

### New Record (New Team)
```typescript
{
  player_id: "38439",
  player_name: "Player A",
  position: "Forward",
  team_id: "SSPSLT0002",  // New team
  team_name: "Team Beta",
  season_id: "SSPSLS17",
  acquisition_type: "swap",  // New acquisition type
  acquisition_value: 1000,  // Swapped value
  contract_start_season: "SSPSLS17",
  contract_end_season: "SSPSLS17",
  status: "active",
  acquisition_date: "2025-01-15T10:30:00Z",
  transaction_id: "abc123",
  created_at: "2025-01-15T10:30:00Z"
}
```

## Transaction Record Structure

### player_transactions Collection
```typescript
{
  transaction_type: "swap",
  player_a_id: "38439",
  player_a_name: "Player A",
  player_b_id: "129369",
  player_b_name: "Player B",
  player_type: "football",
  team_a_id: "SSPSLT0001",
  team_b_id: "SSPSLT0002",
  season_id: "SSPSLS17",
  fee_team_a: 0,  // Simple swap
  fee_team_b: 0,
  swap_number: 1,  // Bulk swap only
  processed_by: "user_uid",
  processed_by_name: "Admin Name",
  created_at: Timestamp
}
```

## Backfill Script Usage

### Run the Backfill
```bash
# Install dependencies if needed
npm install

# Run the backfill script
npx tsx scripts/backfill-swap-history.ts
```

### What It Does
1. Fetches all swap transactions from `player_transactions` collection
2. For each swap:
   - Gets current player data from `footballplayers` table
   - Gets team names from Firebase
   - Checks if history already exists (skips if yes)
   - Closes old history records (if active)
   - Creates new history records with correct data
3. Reports progress and errors

### Output Example
```
🔄 Starting player history backfill for swaps...

Found 15 swap transactions

Processing swap: Cristiano Ronaldo ↔ Lionel Messi
  ✅ Created history records
Processing swap: Neymar Jr ↔ Kylian Mbappé
  ✓ History already exists, skipping
Processing swap: Player C ↔ Player D
  ⚠️  Skipping - player(s) not found in database

✅ Backfill complete!
   Processed: 12
   Errors: 1
   Total: 15

🎉 Done!
```

## Verification

### Check Player History
```sql
-- Check history for a specific player
SELECT * FROM player_history 
WHERE player_id = '38439' 
ORDER BY acquisition_date DESC;

-- Check swap history
SELECT * FROM player_history 
WHERE acquisition_type = 'swap' 
ORDER BY acquisition_date DESC;

-- Check closed records
SELECT * FROM player_history 
WHERE status = 'swapped' 
ORDER BY end_date DESC;
```

### Check Transactions
```javascript
// In Firebase Console or script
const swaps = await adminDb
  .collection('player_transactions')
  .where('transaction_type', '==', 'swap')
  .orderBy('created_at', 'desc')
  .limit(10)
  .get();

swaps.forEach(doc => {
  console.log(doc.id, doc.data());
});
```

## Benefits

### 1. Complete Audit Trail
- Every swap is now tracked in `player_transactions`
- Player history shows complete journey across teams
- Transaction IDs link everything together

### 2. Player Roadmap
- Players now have complete contract history
- Can see all teams they've played for
- Shows acquisition type and value for each move

### 3. Better Analytics
- Can analyze swap patterns
- Track player value changes over time
- Identify most active teams in swaps

### 4. Compliance
- Full transaction history for auditing
- Traceable player movements
- Proper record keeping

## Testing

### Test New Swaps
1. Perform a single swap via UI
2. Check `player_transactions` collection - should have new record
3. Check `player_history` table - should have:
   - 2 closed records (status='swapped')
   - 2 new active records (status='active')
4. Verify transaction_id matches

### Test Bulk Swaps
1. Perform bulk swap with 3 pairs
2. Check `player_transactions` - should have 3 records
3. Check `player_history` - should have:
   - 6 closed records
   - 6 new active records
4. Verify all linked correctly

### Test Backfill
1. Run backfill script
2. Check output for errors
3. Verify history records created
4. Run again - should skip existing records

## Rollback Plan

If issues occur:

### 1. Disable New Code
```typescript
// Comment out player history code in swap endpoints
// Keep transaction logging only
```

### 2. Clean Up Bad Records
```sql
-- Delete records from failed backfill
DELETE FROM player_history 
WHERE transaction_id = 'bad_transaction_id';
```

### 3. Re-run Backfill
```bash
# Fix any issues and re-run
npx tsx scripts/backfill-swap-history.ts
```

## Future Enhancements

1. **Bulk Backfill UI** - Admin interface to trigger backfill
2. **History Viewer** - UI to view player history timeline
3. **Swap Analytics** - Dashboard showing swap statistics
4. **Validation** - Check for orphaned history records
5. **Cleanup** - Archive old history records

## Support

### Common Issues

**Issue:** "Player not found in database"
- **Cause:** Player was deleted or ID changed
- **Solution:** Skip or manually fix player ID

**Issue:** "History already exists"
- **Cause:** Backfill already ran for this swap
- **Solution:** This is normal, script skips automatically

**Issue:** "Team name not found"
- **Cause:** Team was deleted or renamed
- **Solution:** Uses "Unknown Team" as fallback

### Debug Queries

```sql
-- Find players with no history
SELECT fp.player_id, fp.name 
FROM footballplayers fp
LEFT JOIN player_history ph ON fp.player_id = ph.player_id
WHERE ph.id IS NULL AND fp.team_id IS NOT NULL;

-- Find swaps without history
SELECT pt.player_a_id, pt.player_b_id, pt.created_at
FROM player_transactions pt
LEFT JOIN player_history ph ON pt.id = ph.transaction_id
WHERE pt.transaction_type = 'swap' AND ph.id IS NULL;

-- Count history by acquisition type
SELECT acquisition_type, COUNT(*) 
FROM player_history 
GROUP BY acquisition_type;
```

## Conclusion

All player swaps now properly:
- ✅ Create transaction records in Firebase
- ✅ Update player history in Neon
- ✅ Link records with transaction IDs
- ✅ Track complete player journey
- ✅ Support backfilling historical data

The system now has complete traceability for all player movements!
