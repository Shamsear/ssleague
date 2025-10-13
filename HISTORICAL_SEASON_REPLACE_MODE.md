# Historical Season Replace Mode

## Overview
When you **re-import/update** a historical season, the system now uses **"Replace Mode"** - it completely replaces all data for that season with the new import data.

---

## What Happens During Re-Import

### ✅ CLEANUP PHASE (Before Import)

#### 1. Delete Season Stats Records
- **Finds all** `realplayerstats` documents for this season
- **Deletes all** player stats records associated with this season
- Example: If season had 50 players, all 50 stat records are deleted

#### 2. Smart Player Cleanup
- **Checks each player** that was in the deleted stats
- **Deletes from `realplayers`** if the player ONLY existed in this season
- **Keeps in `realplayers`** if the player has stats in other seasons

**Example:**
```
Player A: Only in Season 1 → DELETED from realplayers ❌
Player B: In Season 1 and Season 2 → KEPT in realplayers ✅
```

#### 3. Teams Are Preserved
- Team records are **NOT deleted**
- Teams can exist across multiple seasons
- Only team performance stats for this season are updated

---

### ✅ IMPORT PHASE (Fresh Data)

After cleanup, the system imports fresh data:

1. **Updates permanent player info** in `realplayers` (or creates new)
2. **Creates new season stats** in `realplayerstats` for each player
3. **Updates team info** if needed
4. **Links everything** to the season

---

## Benefits

### ✅ Clean & Accurate
- What's in your Excel file = What's in the database
- No orphaned or outdated records
- No confusion about active/inactive players

### ✅ Database Hygiene
- Automatically removes players who were removed from the season
- Prevents data bloat from multiple imports
- Keeps only relevant historical data

### ✅ Safe for Multi-Season Players
- Players in multiple seasons are preserved
- Only season-specific stats are replaced
- Permanent player info is maintained

### ✅ Predictable Behavior
- Each import gives you a clean slate
- Easy to understand: "Import = Replace"
- No manual cleanup needed

---

## Examples

### Example 1: Correcting Season Data

**Initial Import:**
- Season 1 has 30 players
- All 30 players created in `realplayers`
- All 30 stats created in `realplayerstats`

**Re-import with Corrections:**
- Excel now has 28 players (2 removed, 1 stats corrected)
- **Cleanup:** Deletes all 30 stat records
- **Cleanup:** Deletes 2 players who only existed in Season 1
- **Import:** Creates 28 new stat records
- **Result:** Database has exactly 28 players for Season 1

---

### Example 2: Player in Multiple Seasons

**Season 1 Import:**
- Player "John" created in both collections

**Season 2 Import:**
- Player "John" also in Season 2
- John now has 2 stat records (Season 1 + Season 2)

**Re-import Season 1:**
- **Cleanup:** Deletes Season 1 stats for John
- **Cleanup:** Checks if John exists in other seasons → YES (Season 2)
- **Cleanup:** John KEPT in `realplayers` ✅
- **Import:** Creates new Season 1 stats for John

**Result:** John has updated Season 1 stats + unchanged Season 2 stats

---

### Example 3: Removing a Player from Season

**Initial State:**
- Season 1: Players A, B, C (all only in Season 1)

**Re-import without Player C:**
- Excel has only Players A and B
- **Cleanup:** Deletes all 3 stat records
- **Cleanup:** Checks Player C → only in Season 1 → DELETED ❌
- **Import:** Creates stats for A and B only

**Result:** Player C completely removed from database

---

## Technical Details

### Collections Affected

#### `realplayerstats` Collection
- **Action:** DELETE all documents where `season_id == this_season`
- **Reason:** Replace with fresh data
- **Impact:** All season-specific stats are reset

#### `realplayers` Collection
- **Action:** DELETE documents if player only exists in this season
- **Check:** Query `realplayerstats` for other seasons
- **Impact:** Only orphaned players are removed

#### `teams` Collection
- **Action:** UPDATE (not delete)
- **Reason:** Teams exist across seasons
- **Impact:** Team info and performance stats updated

---

## Import Route Behavior

### Individual Season Import
**File:** `app/api/seasons/historical/[id]/import/route.ts`

**Flow:**
1. Verify season exists
2. **CLEANUP PHASE**
   - Get all stats for this season
   - Delete all stats documents
   - Check each player for other seasons
   - Delete players only in this season
3. **IMPORT PHASE**
   - Process teams (update existing)
   - Process players (create fresh stats)
   - Update season timestamp

### Batch Season Import
**File:** `app/api/seasons/historical/import/route.ts`

**Flow:**
1. Create NEW season
2. Import teams (with user accounts)
3. Import players (fresh data)
4. No cleanup needed (new season)

---

## Logging

During import, you'll see detailed logs:

```
🗑️  Starting cleanup phase...
  Found 45 player stats records to delete
  Found 45 unique players in this season
  ✅ Deleted 45 player stats records
  Found 5 players to delete (only in this season)
  ✅ Deleted 5 players from realplayers collection
✅ Cleanup phase completed

📥 Starting fresh import...
  📊 Processing 40 players...
  🆕 Creating stats for Player A in season ss01
  📝 Updating stats for Player B in season ss01
  ...
```

---

## Safety Features

### ✅ Transaction Safety
- Uses Firestore batch operations
- Either all deletes succeed or none
- Prevents partial cleanup

### ✅ Season Isolation
- Only affects the specific season being imported
- Other seasons remain untouched
- No cross-season data corruption

### ✅ Verification
- Checks season exists before cleanup
- Validates player existence across seasons
- Proper error handling and logging

---

## UI Impact

### Before Re-Import
- May show outdated/incorrect player stats
- May show removed players still in season
- Data doesn't match Excel source

### After Re-Import
- Shows exact data from Excel file
- Removed players no longer appear
- Stats match the imported data perfectly

---

## Best Practices

### ✅ Do:
- Keep your Excel file as the source of truth
- Re-import to correct any mistakes
- Import complete season data each time
- Verify the import in UI after completion

### ❌ Don't:
- Manually edit individual player stats after import
- Partially update with incomplete data
- Import without verifying the Excel data first
- Assume old data will be merged with new data

---

## Comparison with Previous Behavior

### OLD Behavior (Update/Merge)
- ❌ Kept orphaned records
- ❌ Players never removed
- ❌ Data accumulated over time
- ❌ Manual cleanup needed
- ✅ Existing records updated

### NEW Behavior (Replace Mode)
- ✅ Removes orphaned records automatically
- ✅ Players removed when not in import
- ✅ Clean data with each import
- ✅ No manual cleanup needed
- ✅ Complete data replacement

---

## Recovery

If you accidentally import wrong data:

1. **Fix your Excel file** with correct data
2. **Re-import immediately** - it will replace the wrong data
3. **Verify in UI** that data is correct

The replace mode makes it easy to recover from mistakes by simply re-importing correct data.

---

## Summary

🎯 **Replace Mode** ensures your database always reflects exactly what's in your import file
🗑️ **Smart Cleanup** removes only what should be removed
🔒 **Safe Operations** protect data in other seasons
📊 **Clean Data** prevents accumulation of outdated records

This approach is ideal for historical season management where each season is a complete, immutable snapshot of that period.
