# Database Update Stats Implementation

## Overview
Updated the database management system to provide a comprehensive preview before updating player stats. The system now shows exactly what will be updated, created, or left unchanged.

## Key Changes

### 1. New API Endpoint: `/api/players/compare-import/route.ts`
- Compares uploaded player data with existing database
- Categorizes players into three groups:
  - **To Update**: Existing players that will have stats updated
  - **To Create**: New players not in database
  - **Not Found**: Players in database but missing from upload

### 2. New Preview Page: `/dashboard/committee/database/update-preview/page.tsx`
- Shows detailed comparison with three tabs:
  - **Players to Update** (🔄): Shows old vs new values for:
    - Team name (not team_id - preserved)
    - Position
    - Playing style
    - Overall rating
    - Stats (pace, shooting, passing, dribbling, defending, physical)
  - **New Players** (➕): Shows all new players that will be created
  - **Not in Upload** (⚠️): Shows existing players missing from upload (will remain unchanged)

### 3. Updated Database Page: `/dashboard/committee/database/page.tsx`
- Changed "Update Stats" button to "Preview Update"
- Now navigates to preview page instead of directly updating
- Removed direct update confirmation

## Update Behavior

### What Gets Updated:
- ✅ Team name (club affiliation)
- ✅ Position
- ✅ Playing style
- ✅ Overall rating
- ✅ All stats (pace, shooting, passing, dribbling, defending, physical, etc.)

### What Gets Preserved:
- ✅ Team ID (ownership)
- ✅ Is sold status
- ✅ Acquisition value
- ✅ Season ID
- ✅ Round ID

### What Happens:
1. **Existing players** (matched by player_id): Stats updated, ownership preserved
2. **New players** (not in database): Created as new entries
3. **Missing players** (in database but not in upload): Left unchanged, no deletion

## User Flow

1. Upload SQLite database file (.db)
2. Click "Parse Database" to extract player data
3. Click "Preview Update" button
4. Review three tabs:
   - See which players will be updated (with before/after comparison)
   - See which new players will be created
   - See which existing players are not in the upload
5. Click "Confirm & Update" to apply changes
6. System updates database and redirects back to database page

## Summary Statistics

The preview page shows:
- Total existing players in database
- Total players in upload
- Number of players that will be updated
- Number of new players that will be created
- Number of players not found in upload

## Technical Details

### Comparison Logic
- Uses `player_id` as the unique identifier for matching
- Compares all relevant fields to show changes
- Preserves critical ownership data (team_id, is_sold, etc.)

### Database Operation
- Uses existing `bulkUpdatePlayerStats` function
- ON CONFLICT DO UPDATE for existing players
- INSERT for new players
- No deletion of missing players

## Benefits

1. **Transparency**: Users see exactly what will change before committing
2. **Safety**: No accidental deletions or overwrites of ownership data
3. **Clarity**: Clear categorization of updates, creates, and unchanged players
4. **Confidence**: Visual before/after comparison for all stat changes

## Files Modified

1. `app/api/players/compare-import/route.ts` (NEW)
2. `app/dashboard/committee/database/update-preview/page.tsx` (NEW)
3. `app/dashboard/committee/database/page.tsx` (MODIFIED)

## Testing Checklist

- [ ] Upload SQLite database with player data
- [ ] Verify preview shows correct categorization
- [ ] Check that old vs new values display correctly
- [ ] Confirm new players are identified
- [ ] Verify missing players are listed
- [ ] Test update process completes successfully
- [ ] Verify team_id and ownership data preserved
- [ ] Confirm stats are updated correctly
- [ ] Check that missing players remain in database