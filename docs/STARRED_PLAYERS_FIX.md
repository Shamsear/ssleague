# Starred Players Table - Data Type Fix

## Problem

The initial migration script had a data type mismatch:
- `starred_players.player_id` was defined as `INTEGER`
- `footballplayers.id` is actually `VARCHAR(255)`

This caused the foreign key constraint error:
```
ERROR: foreign key constraint "starred_players_player_id_fkey" cannot be implemented (SQLSTATE 42804)
```

## Root Cause

The `footballplayers` table schema uses:
```sql
CREATE TABLE footballplayers (
    id VARCHAR(255) PRIMARY KEY,  -- VARCHAR, not INTEGER!
    player_id VARCHAR(255) UNIQUE NOT NULL,
    ...
);
```

## Solution

### If You Haven't Created the Table Yet

Use the updated migration script:
```bash
# Run: migrations/create_starred_players_table.sql
# It now correctly uses VARCHAR(255) for player_id
```

### If You Already Tried to Create the Table

Use the fix script to drop and recreate:

**1. In Neon SQL Editor:**
```sql
-- Run the entire fix script
-- File: migrations/fix_starred_players_table.sql
```

**2. Or manually:**
```sql
-- Drop the incorrect table
DROP TABLE IF EXISTS starred_players CASCADE;

-- Create with correct data types
CREATE TABLE starred_players (
  id SERIAL PRIMARY KEY,
  team_id VARCHAR(255) NOT NULL,
  player_id VARCHAR(255) NOT NULL REFERENCES footballplayers(id) ON DELETE CASCADE,
  starred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(team_id, player_id)
);

-- Create indexes
CREATE INDEX idx_starred_players_team_id ON starred_players(team_id);
CREATE INDEX idx_starred_players_player_id ON starred_players(player_id);
CREATE INDEX idx_starred_players_team_player ON starred_players(team_id, player_id);
```

## Correct Schema

```sql
CREATE TABLE starred_players (
  id SERIAL PRIMARY KEY,
  team_id VARCHAR(255) NOT NULL,          -- Firebase Auth UID
  player_id VARCHAR(255) NOT NULL         -- ✅ VARCHAR to match footballplayers.id
    REFERENCES footballplayers(id) 
    ON DELETE CASCADE,
  starred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(team_id, player_id)
);
```

## Verification

After running the fix, verify the schema:

```sql
SELECT 
    column_name, 
    data_type,
    character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'starred_players'
ORDER BY ordinal_position;
```

Expected output:
```
column_name  | data_type         | character_maximum_length
-------------|-------------------|-------------------------
id           | integer           | NULL
team_id      | character varying | 255
player_id    | character varying | 255  ✅ Should be VARCHAR, not INTEGER
starred_at   | timestamp         | NULL
```

## Files Updated

1. ✅ `migrations/create_starred_players_table.sql` - Fixed to use VARCHAR(255)
2. ✨ `migrations/fix_starred_players_table.sql` - New fix script
3. ✅ `docs/STARRED_PLAYERS_FEATURE.md` - Updated documentation
4. ✅ `docs/SETUP_STARRED_PLAYERS.md` - Added troubleshooting section

## Why VARCHAR for ID?

The `footballplayers` table likely uses VARCHAR for IDs because:
1. IDs might be imported from external systems with string formats
2. Allows for alphanumeric identifiers (e.g., "P12345")
3. Flexibility for different ID schemes
4. UUIDs or hash-based IDs

## API Routes Status

✅ All API routes are already compatible:
- They use `params.id` which is a string
- SQL queries work with both VARCHAR and INTEGER
- No changes needed to the API code

## Next Steps

1. Run the fix script: `migrations/fix_starred_players_table.sql`
2. Verify the schema (see verification query above)
3. Test the feature in your application
4. Starred players should now work correctly!

## Summary

| Item | Before | After |
|------|--------|-------|
| `player_id` data type | INTEGER ❌ | VARCHAR(255) ✅ |
| Foreign key | Failed | Works! ✅ |
| Migration script | Had bug | Fixed ✅ |
| API routes | N/A | Already compatible ✅ |
