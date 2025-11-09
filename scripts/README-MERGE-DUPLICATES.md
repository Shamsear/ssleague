# Duplicate Player Merger Script

## Purpose
This interactive script helps you identify and merge duplicate players that were created during historical imports due to name variations (like "Aashiq" vs "Ashiq" or "Abdul Rouf" vs "Abdulrouf").

## What It Does

1. **Scans Database**: Loads all players from Firebase
2. **Finds Duplicates**: Identifies duplicates using two methods:
   - **Exact Match**: Same name after normalization (removes spaces, special chars)
   - **Similar Names**: >85% similarity using Levenshtein distance
3. **Interactive Review**: Shows you each duplicate group
4. **Smart Merge**: Lets you choose which player to keep
5. **Updates References**: Updates all stats records to point to the kept player
6. **Cleanup**: Deletes duplicate player documents

## Usage

### Step 1: Run the Script
```bash
node scripts/merge-duplicate-players.js
```

### Step 2: Review Duplicates
For each duplicate group, you'll see:

```
================================================================================
📋 Duplicate Group 1 of 15
================================================================================
Type: ✅ Exact Match (normalized)
Players in group: 4

[1] Aashiq
    ID: sspslpsl0123
    Firebase Doc ID: abc123
    Created: 11/1/2024, 10:30:00 AM

[2] Aashiq
    ID: sspslpsl0234
    Firebase Doc ID: def456
    Created: 11/2/2024, 2:15:00 PM

[3] Aashiq
    ID: sspslpsl0345
    Firebase Doc ID: ghi789
    Created: 11/3/2024, 4:20:00 PM

[4] Aashiq
    ID: sspslpsl0456
    Firebase Doc ID: jkl012
    Created: 11/4/2024, 6:45:00 PM

Options:
  [1-4] - Select player to KEEP (others will be merged into this one)
  [s] - Skip this group (no changes)
  [q] - Quit script

Your choice: 
```

### Step 3: Choose an Action

**Option 1: Merge** - Select a number (1-4)
- Choose the player you want to KEEP
- All other players will be merged into this one
- Their stats will be updated to reference the kept player
- Duplicate player documents will be deleted

**Option 2: Skip** - Type `s`
- Leave this group unchanged
- Move to the next duplicate group

**Option 3: Quit** - Type `q`
- Exit the script
- No changes will be made to unreviewed groups

### Step 4: Confirm Merge
After selecting a player to keep, you'll see:
```
✅ Will KEEP: Aashiq (sspslpsl0123)
❌ Will MERGE & DELETE: Aashiq (sspslpsl0234), Aashiq (sspslpsl0345), Aashiq (sspslpsl0456)

Confirm? (yes/no): 
```

Type `yes` to proceed or `no` to skip.

### Step 5: View Summary
After reviewing all groups:
```
================================================================================
📊 MERGE SUMMARY
================================================================================
Total duplicate groups: 15
Merged: 12
Skipped: 3
================================================================================
```

## Examples

### Example 1: Exact Match (Same Name)
```
[1] Aashiq (ID: sspslpsl0123) - Created 11/1/2024
[2] Aashiq (ID: sspslpsl0234) - Created 11/2/2024
[3] Aashiq (ID: sspslpsl0345) - Created 11/3/2024

Choose: 1  ← Keep the oldest one
```

### Example 2: Name Variations
```
[1] Abdul Rouf (ID: sspslpsl0156) - Created 11/1/2024
[2] Abdulrouf (ID: sspslpsl0267) - Created 11/2/2024
[3] Abdul Rouf (ID: sspslpsl0378) - Created 11/3/2024

Choose: 1  ← Keep preferred spelling
```

### Example 3: Similar Names (>85% similarity)
```
Type: 🔄 Similar Names

[1] Aashiq (ID: sspslpsl0123)
    Similarity: 91.2%

[2] Ashiq (ID: sspslpsl0234)
    Similarity: 91.2%

Choose: 1 or s  ← Merge if same person, skip if different
```

## What Gets Merged

When you merge players:

✅ **Updated**:
- All `realplayerstats` records → `player_id` updated to kept player
- All stats now point to the single kept player

❌ **Deleted**:
- Duplicate player documents from `realplayers` collection

✅ **Preserved**:
- All stats data (nothing is lost)
- The chosen player document

## Safety Features

1. **Interactive**: You review and confirm each merge
2. **Non-destructive**: Only updates references and deletes duplicates
3. **Skip Option**: Can skip any uncertain duplicates
4. **Confirmation**: Must type "yes" to confirm each merge
5. **Quit Anytime**: Press `q` to exit without completing all merges

## Tips for Choosing Which Player to Keep

**Criteria** (in order of importance):

1. **Oldest Creation Date**: Usually the "original" player
2. **Most Complete Data**: Player with email, phone, etc.
3. **Better Name Spelling**: Preferred/correct spelling
4. **Registration Status**: Registered players preferred

## After Running the Script

### Verify Results
1. Check `/players` page
2. Verify duplicate names are gone
3. Confirm stats are correctly linked

### Test Import
1. Re-import a historical season
2. Verify no new duplicates are created
3. Existing players should be reused (after our batch loading fix)

## Troubleshooting

### Issue: "No duplicate players found"
- ✅ Good! Your database is clean
- Or duplicates don't match the 85% similarity threshold

### Issue: Error during merge
- Check Firebase permissions
- Verify `serviceAccountKey.json` exists
- Check console for specific error message

### Issue: Too many duplicates shown
- Script uses 85% similarity threshold
- Some might not be actual duplicates
- Use `s` to skip false positives

### Issue: Want to undo a merge
- **Can't undo automatically** ⚠️
- Need to restore from backup
- Be careful when confirming merges!

## Technical Details

### Duplicate Detection

**Exact Match** (Normalized):
```javascript
normalizeName("Abdul Rouf")   → "abdulrouf"
normalizeName("Abdulrouf")    → "abdulrouf"
// ✅ Match!
```

**Similar Names** (Levenshtein Distance):
```javascript
similarity("Aashiq", "Ashiq")  → 91.2%
similarity("Aashiq", "Aashique") → 87.5%
// ✅ Both above 85% threshold
```

### What's Updated

**Firebase Collections**:
- `realplayerstats` - Updated `player_id` and `player_name`
- `realplayers` - Duplicate documents deleted

**NOT Updated** (doesn't exist or not needed):
- Neon DB (stats use Firebase player IDs as reference)
- Any other collections

## Prevention (For Future Imports)

To prevent duplicates in future imports:

1. ✅ **Batch Loading Fix**: Already applied - loads ALL players
2. ✅ **Player Linking UI**: Implement the feature from `docs/PLAYER_LINKING_FEATURE.md`
3. ✅ **Bulk Find & Replace**: Use preview page feature to normalize names
4. ✅ **Auto-Linking**: Will be added with linking UI

## Related Documentation

- `docs/PLAYER_DUPLICATE_FIX.md` - Root cause and batch loading fix
- `docs/PLAYER_LINKING_FEATURE.md` - How to add manual linking UI
- `docs/HISTORICAL_IMPORT_TEAM_LINKING_FIX.md` - Similar fix for teams

## Need Help?

If you encounter issues:
1. Check the console output for error details
2. Verify Firebase credentials
3. Review the duplicate suggestions carefully
4. Use `s` to skip uncertain matches
5. Can always run script multiple times
