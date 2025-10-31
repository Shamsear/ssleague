# Historical Import - Trophy & Awards Update

## Overview

Updated the historical season import system to properly save player trophies/awards and team trophies using the new normalized database structure.

## Changes Made

### 1. **Player Awards** - Now Saved to `player_awards` Table

#### Before:
- Player trophies (category + individual) were saved as JSONB in `realplayerstats.trophies`
- No separation of award name and position
- Harder to query and display

#### After:
- Player awards saved to dedicated `player_awards` table
- Proper separation of `award_name` and `award_position`
- Each award is a separate row with full metadata

#### Implementation Details:

**Award Name Parsing**:
The system now automatically parses award strings to extract position:
```typescript
"Golden Boot Winner" → name: "Golden Boot", position: "Winner"
"Best Attacker Runner Up" → name: "Best Attacker", position: "Runner-up"
"Top Scorer Third Place" → name: "Top Scorer", position: "Third Place"
"Most Assists" → name: "Most Assists", position: null
```

**Supported Position Formats**:
- Winner / Winners
- Runner Up / Runner-up
- Third Place / 3rd Place

**Award Types**:
- **Category Trophies**: Awards within player categories (e.g., "Category A Winner")
- **Individual Trophies**: Overall season awards (e.g., "Golden Boot", "Most Assists")

### 2. **Team Trophies** - Already Using `team_trophies` Table

Team trophies continue to be saved correctly to the `team_trophies` table with:
- Separate `trophy_name` and `trophy_position` columns
- League position trophies (Winner, Runner-up)
- Cup trophies from Excel data

### 3. **Preview Page**

The import preview page already shows separated fields:
- `category_wise_trophy_1`, `category_wise_trophy_2` for category awards
- `individual_wise_trophy_1`, `individual_wise_trophy_2` for individual awards

These are displayed in separate columns in the player data table.

## Database Structure

### player_awards Table
```sql
CREATE TABLE player_awards (
    id SERIAL PRIMARY KEY,
    player_id VARCHAR(255) NOT NULL,
    player_name VARCHAR(255) NOT NULL,
    season_id INTEGER NOT NULL,
    award_name VARCHAR(255) NOT NULL,
    award_position VARCHAR(100),      -- Winner, Runner-up, Third Place, or NULL
    award_value NUMERIC(10, 2),
    notes TEXT,                       -- Stores award type: "Category Trophy" or "Individual Trophy"
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_player_season_award UNIQUE (player_id, season_id, award_name)
);
```

### team_trophies Table
```sql
CREATE TABLE team_trophies (
    id SERIAL PRIMARY KEY,
    team_id VARCHAR(255) NOT NULL,
    team_name VARCHAR(255) NOT NULL,
    season_id VARCHAR(50) NOT NULL,
    trophy_type VARCHAR(100) NOT NULL,
    trophy_name VARCHAR(255) NOT NULL,
    trophy_position VARCHAR(100),     -- Winner, Runner-up, Third Place
    position INTEGER,                 -- League position (1, 2, 3)
    awarded_by VARCHAR(100),
    ...
);
```

## Import Flow

### For Each Player:

1. **Parse Trophy Data**:
   - Scan Excel columns for `category_wise_trophy_*` and `individual_wise_trophy_*`
   - Extract award name and position using regex parsing
   - Build array of award objects

2. **Save to realplayerstats**:
   - Still save JSONB for backward compatibility
   - Contains simplified structure for quick access

3. **Save to player_awards** (NEW):
   - Insert separate row for each award
   - Include proper name/position separation
   - Mark as category or individual in notes

### For Each Team:

1. **Parse Trophy Data**:
   - Scan Excel columns for `cup_*` fields
   - Extract trophy name and position

2. **Save to teamstats**:
   - JSONB for backward compatibility

3. **Save to team_trophies**:
   - League position trophies (auto-assigned based on rank)
   - Cup trophies from Excel data
   - Each trophy as separate row

## Excel Column Names Supported

### Player Awards:
- `category_trophies`
- `category_wise_trophy`
- `category_wise_trophy_1`, `category_wise_trophy_2`, etc.
- `individual_trophies`
- `individual_wise_trophy`
- `individual_wise_trophy_1`, `individual_wise_trophy_2`, etc.

### Team Trophies:
- `cups`
- `cup`
- `cup_1`, `cup_2`, `cup_3`, etc.

## Benefits

### 1. **Proper Data Normalization**
- Awards are first-class entities, not embedded JSON
- Easy to query, filter, and aggregate
- No need to parse JSON in application code

### 2. **Consistent Structure**
- Both team and player awards follow same pattern
- Separate name and position columns
- Standardized position values

### 3. **Better Display**
- Player profiles can show awards with trophy icons
- Leaderboards can display award counts
- Historical statistics are more accessible

### 4. **Future-Proof**
- Easy to add new award types
- Support for unlimited awards per player/team
- Can add award metadata (value, date, etc.)

## Example Data

### Player Awards After Import:
```sql
-- Category Trophy
INSERT INTO player_awards VALUES (
    1,                          -- id
    'PLAYER123',                -- player_id
    'John Doe',                 -- player_name
    1,                          -- season_id
    'Category A',               -- award_name
    'Winner',                   -- award_position
    NULL,                       -- award_value
    'Category Trophy',          -- notes
    NOW(), NOW()
);

-- Individual Trophy
INSERT INTO player_awards VALUES (
    2,
    'PLAYER123',
    'John Doe',
    1,
    'Golden Boot',
    'Runner-up',
    23,                         -- goals scored
    'Individual Trophy',
    NOW(), NOW()
);
```

### Team Trophies After Import:
```sql
-- League Winner
INSERT INTO team_trophies VALUES (
    1,
    'TEAM001',
    'FC Barcelona',
    'SSPSLS12',
    'league',
    'League',
    'Winner',
    1,
    'system',
    ...
);

-- Cup Trophy
INSERT INTO team_trophies VALUES (
    2,
    'TEAM001',
    'FC Barcelona',
    'SSPSLS12',
    'cup',
    'Champions Cup',
    'Winner',
    NULL,
    'system',
    ...
);
```

## Testing

To test the new import system:

1. **Prepare Excel File** with trophy columns:
   - Add `category_wise_trophy_1`, `individual_wise_trophy_1` for players
   - Add `cup_1`, `cup_2` for teams
   - Use format: "Award Name Winner" or "Award Name Runner Up"

2. **Import via SuperAdmin**:
   - Go to `/dashboard/superadmin/historical-seasons/import`
   - Upload Excel file
   - Review preview page (check trophy columns)
   - Start import

3. **Verify in Database**:
   ```sql
   -- Check player awards
   SELECT * FROM player_awards WHERE season_id = 'SSPSLS12';
   
   -- Check team trophies
   SELECT * FROM team_trophies WHERE season_id = 'SSPSLS12';
   ```

4. **Verify in UI**:
   - Visit player profile: `/dashboard/team/player/[id]`
   - Check "Season Awards" section
   - Should show awards with proper names and positions

## Migration Notes

- **Backward Compatibility**: Existing `realplayerstats.trophies` JSONB is still populated
- **No Data Loss**: Old trophies remain in JSONB for reference
- **New Imports**: Use `player_awards` table as primary source
- **Old Imports**: Can be migrated using a script if needed

## Related Files

- **Import Route**: `app/api/seasons/historical/import/route.ts`
- **Preview Page**: `app/dashboard/superadmin/historical-seasons/preview/page.tsx`
- **Player Profile**: `app/dashboard/team/player/[id]/page.tsx`
- **Library Functions**: `lib/neon/playerAwards.ts`
- **Setup Guide**: `docs/PLAYER_AWARDS_SETUP.md`

## Future Enhancements

- [ ] Migration script to convert old JSONB trophies to `player_awards` table
- [ ] Bulk award assignment UI for admins
- [ ] Award statistics dashboard
- [ ] Award filtering in player leaderboards
- [ ] Award badges/icons on player cards
- [ ] Award history timeline view

## Summary

✅ Player awards now properly saved to `player_awards` table with separated name/position  
✅ Team trophies continue using `team_trophies` table correctly  
✅ Preview page already shows separated trophy fields  
✅ Award parsing handles position indicators automatically  
✅ Both category and individual trophies supported  
✅ Backward compatible with existing JSONB structure  

The historical import system is now fully integrated with the normalized trophy/award system!
