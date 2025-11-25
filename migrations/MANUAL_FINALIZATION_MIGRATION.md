# Manual Finalization Migration

## Overview

This migration adds support for manual finalization of auction rounds, allowing committee admins to preview results before applying them.

## Changes

### 1. Database Schema Changes

#### New Column: `rounds.finalization_mode`
- **Type:** VARCHAR(20)
- **Default:** 'auto'
- **Values:** 'auto' | 'manual'
- **Purpose:** Controls whether a round auto-finalizes on expiry or requires manual approval

#### New Table: `pending_allocations`
Stores preview finalization results before they are applied.

| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| round_id | INTEGER | Reference to rounds table |
| team_id | VARCHAR(255) | Team ID (readable format) |
| team_name | VARCHAR(255) | Team name for display |
| player_id | VARCHAR(255) | Player ID from footballplayers |
| player_name | VARCHAR(255) | Player name for display |
| amount | INTEGER | Bid amount |
| bid_id | VARCHAR(255) | Winning bid ID or synthetic ID |
| phase | VARCHAR(20) | 'regular' or 'incomplete' |
| created_at | TIMESTAMP | Preview creation timestamp |

**Constraints:**
- UNIQUE(round_id, team_id) - One player per team per round
- Foreign key to rounds(id) with CASCADE delete

**Indexes:**
- idx_pending_allocations_round (round_id)
- idx_pending_allocations_team (team_id)
- idx_pending_allocations_player (player_id)

## Running the Migration

### Option 1: Using Python Script (Recommended)

```bash
# Install dependencies if needed
pip install psycopg2-binary

# Set environment variable
export DATABASE_URL="your_database_url"
# or
export NEON_DATABASE_URL="your_database_url"

# Run migration
python migrations/run_manual_finalization_migration.py
```

### Option 2: Using SQL File Directly

```bash
# Using psql
psql $DATABASE_URL -f migrations/add_manual_finalization_support.sql

# Using Neon CLI
neon sql < migrations/add_manual_finalization_support.sql
```

## Verification

After running the migration, verify the changes:

```sql
-- Check finalization_mode column
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'rounds' AND column_name = 'finalization_mode';

-- Check pending_allocations table
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name = 'pending_allocations'
ORDER BY ordinal_position;

-- Check indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'pending_allocations';

-- Verify existing rounds have default value
SELECT id, finalization_mode, status
FROM rounds
LIMIT 5;
```

## Backward Compatibility

- All existing rounds will default to `finalization_mode = 'auto'`
- Existing finalization logic continues to work unchanged
- No data migration required
- No breaking changes to existing functionality

## Rollback

If you need to rollback this migration:

```sql
-- Drop pending_allocations table
DROP TABLE IF EXISTS pending_allocations CASCADE;

-- Remove finalization_mode column
ALTER TABLE rounds DROP COLUMN IF EXISTS finalization_mode;
```

## Impact

### Database
- Adds 1 column to `rounds` table (minimal impact)
- Creates 1 new table with 3 indexes
- No impact on existing data or queries

### Application
- Requires backend API changes to support new endpoints
- Requires frontend changes to display finalization mode options
- Existing auto-finalization continues to work

## Testing

After migration, test the following:

1. **Existing Functionality**
   - Create a round with auto mode (default)
   - Verify it auto-finalizes on expiry
   - Verify results are immediately visible

2. **New Functionality**
   - Create a round with manual mode
   - Verify it doesn't auto-finalize on expiry
   - Preview finalization
   - Verify pending allocations stored
   - Apply pending allocations
   - Verify results become visible

3. **Edge Cases**
   - Cancel pending allocations
   - Re-preview after cancellation
   - Verify no duplicate allocations

## Related Files

- `migrations/add_manual_finalization_support.sql` - SQL migration script
- `migrations/run_manual_finalization_migration.py` - Python migration runner
- `lib/finalize-round.ts` - Finalization logic (to be updated)
- `lib/lazy-finalize-round.ts` - Auto-finalization logic (to be updated)

## Support

If you encounter issues:

1. Check database connection
2. Verify environment variables are set
3. Check database user has necessary permissions (CREATE TABLE, ALTER TABLE)
4. Review migration logs for specific errors
5. Use rollback instructions if needed

## Next Steps

After successful migration:

1. Deploy backend API changes (preview, apply, cancel endpoints)
2. Deploy frontend changes (finalization mode selector, pending allocations modal)
3. Update documentation
4. Test with a manual finalization round
5. Monitor for errors
