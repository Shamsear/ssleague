# Transfer V2 Migration Guide

This migration adds support for the enhanced player transfer and swap system by adding new fields to player tables.

## What This Migration Does

### Adds to `footballplayers` table:
- `star_rating` (INTEGER, 3-10): Player star rating that affects transfer value multipliers
- `points` (INTEGER): Points accumulated by player, determines star rating upgrades
- `salary_per_match` (DECIMAL): Calculated salary per match based on player value
- `transfer_count` (INTEGER): Number of times player has been transferred

### Adds to `player_seasons` table (if exists):
- Same fields as above, for real players

### Creates Indexes:
- `idx_footballplayers_star_rating`: For star rating queries
- `idx_footballplayers_points`: For points queries
- `idx_footballplayers_transfer_count`: For transfer count analytics
- `idx_footballplayers_team_season_star`: Composite index for team/season/star queries
- `idx_footballplayers_salary`: For salary calculations
- Similar indexes for `player_seasons` if table exists

## Prerequisites

- Neon database connection configured in `.env.local`
- Database backup (recommended)
- Node.js installed for testing

## Running the Migration

### Option 1: Using Neon SQL Editor (Recommended)

1. Log in to your Neon dashboard
2. Navigate to your database
3. Open the SQL Editor
4. Copy the contents of `migrations/add_transfer_v2_fields.sql`
5. Paste and execute the SQL
6. Verify the output shows successful completion

### Option 2: Using psql Command Line

```bash
# Set your database URL
export NEON_DATABASE_URL="your-connection-string"

# Run the migration
psql $NEON_DATABASE_URL -f migrations/add_transfer_v2_fields.sql
```

### Option 3: Using Node.js Script

```bash
# Create a simple runner script
node -e "
const { Pool } = require('@neondatabase/serverless');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

async function runMigration() {
  const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL });
  try {
    const sql = fs.readFileSync('migrations/add_transfer_v2_fields.sql', 'utf8');
    await pool.query(sql);
    console.log('✅ Migration completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}
runMigration();
"
```

## Testing the Migration

After running the migration, test it to ensure everything works:

```bash
node migrations/test_transfer_v2_migration.js
```

The test script will:
1. ✅ Verify all columns were added
2. ✅ Check default values
3. ✅ Test star_rating constraints (3-10 range)
4. ✅ Verify indexes were created
5. ✅ Check player_seasons table (if exists)
6. ✅ Test inserting a player with new fields

Expected output:
```
🧪 Testing Transfer V2 Migration...

📋 Test 1: Checking footballplayers columns...
✅ All 4 columns exist in footballplayers table
   - points: integer (default: 180)
   - salary_per_match: numeric (default: 0.00)
   - star_rating: integer (default: 5)
   - transfer_count: integer (default: 0)

📋 Test 2: Checking default values...
✅ Default values check:
   - star_rating: 5 (expected: 5)
   - points: 180 (expected: 180)
   - salary_per_match: 0.00 (expected: 0.00)
   - transfer_count: 0 (expected: 0)

📋 Test 3: Testing star_rating constraint...
✅ Constraint working: Rejected star_rating < 3
✅ Constraint working: Rejected star_rating > 10

📋 Test 4: Checking indexes...
✅ Found 5 indexes:
   - idx_footballplayers_points
   - idx_footballplayers_salary
   - idx_footballplayers_star_rating
   - idx_footballplayers_team_season_star
   - idx_footballplayers_transfer_count

📋 Test 5: Checking player_seasons table...
ℹ️  player_seasons table does not exist (this is OK if only using footballplayers)

📋 Test 6: Testing insert with new fields...
✅ Successfully inserted player with new fields:
   - star_rating: 7
   - points: 250
   - salary_per_match: 2.50
   - transfer_count: 1
✅ Test player cleaned up

🎉 All migration tests passed!
```

## Verification Queries

After migration, you can manually verify the changes:

### Check columns exist:
```sql
SELECT 
    column_name, 
    data_type, 
    column_default,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'footballplayers' 
AND column_name IN ('star_rating', 'points', 'salary_per_match', 'transfer_count')
ORDER BY column_name;
```

### Check indexes:
```sql
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'footballplayers' 
AND (indexname LIKE '%star_rating%' 
     OR indexname LIKE '%points%' 
     OR indexname LIKE '%transfer_count%'
     OR indexname LIKE '%salary%')
ORDER BY indexname;
```

### Check constraints:
```sql
SELECT 
    conname,
    pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'footballplayers'::regclass
AND conname LIKE '%star_rating%';
```

## Rollback (if needed)

If you need to rollback the migration:

```sql
-- Remove columns from footballplayers
ALTER TABLE footballplayers 
DROP COLUMN IF EXISTS star_rating,
DROP COLUMN IF EXISTS points,
DROP COLUMN IF EXISTS salary_per_match,
DROP COLUMN IF EXISTS transfer_count;

-- Remove indexes
DROP INDEX IF EXISTS idx_footballplayers_star_rating;
DROP INDEX IF EXISTS idx_footballplayers_points;
DROP INDEX IF EXISTS idx_footballplayers_transfer_count;
DROP INDEX IF EXISTS idx_footballplayers_team_season_star;
DROP INDEX IF EXISTS idx_footballplayers_salary;

-- If player_seasons exists, remove columns from it too
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables 
               WHERE table_name = 'player_seasons') THEN
        ALTER TABLE player_seasons 
        DROP COLUMN IF EXISTS star_rating,
        DROP COLUMN IF EXISTS points,
        DROP COLUMN IF EXISTS salary_per_match,
        DROP COLUMN IF EXISTS transfer_count;
        
        DROP INDEX IF EXISTS idx_player_seasons_star_rating;
        DROP INDEX IF EXISTS idx_player_seasons_points;
        DROP INDEX IF EXISTS idx_player_seasons_transfer_count;
        DROP INDEX IF EXISTS idx_player_seasons_team_season_star;
        DROP INDEX IF EXISTS idx_player_seasons_salary;
    END IF;
END $$;
```

## Troubleshooting

### Error: "column already exists"
This is safe to ignore. The migration uses `IF NOT EXISTS` clauses to handle this gracefully.

### Error: "relation does not exist"
Make sure you're connected to the correct database and that the `footballplayers` table exists.

### Error: "permission denied"
Ensure your database user has ALTER TABLE and CREATE INDEX permissions.

### Test script fails
1. Check your `.env.local` file has the correct `NEON_DATABASE_URL`
2. Ensure `@neondatabase/serverless` is installed: `npm install @neondatabase/serverless`
3. Make sure the migration was run successfully first

## Next Steps

After successful migration:

1. ✅ Update TypeScript interfaces to include new fields
2. ✅ Implement transfer calculation functions
3. ✅ Create transfer and swap API endpoints
4. ✅ Build UI components for transfer forms
5. ✅ Test the complete transfer flow

## Related Files

- Migration SQL: `migrations/add_transfer_v2_fields.sql`
- Test Script: `migrations/test_transfer_v2_migration.js`
- Requirements: `.kiro/specs/player-transfer-window/requirements.md`
- Design: `.kiro/specs/player-transfer-window/design.md`
- Tasks: `.kiro/specs/player-transfer-window/tasks.md`

## Support

If you encounter issues:
1. Check the verification queries above
2. Review the test script output
3. Check Neon database logs
4. Ensure all prerequisites are met
