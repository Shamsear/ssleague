# Manual Finalization Migration - Quick Start

## Quick Run

```bash
# Set your database URL
export DATABASE_URL="your_neon_database_url"

# Run the migration
python migrations/run_manual_finalization_migration.py
```

## What This Does

1. Adds `finalization_mode` column to `rounds` table (default: 'auto')
2. Creates `pending_allocations` table for storing preview results
3. Creates 3 indexes for performance
4. Verifies all changes were applied successfully

## Expected Output

```
============================================================
Manual Finalization Migration
============================================================
Started at: 2025-11-25 10:30:00

📡 Connecting to database...
✓ Connected successfully

🔍 Checking if migration already applied...
✓ Migration not yet applied - proceeding

📝 Step 1: Adding finalization_mode column to rounds table...
✓ Column added successfully

📝 Step 2: Creating pending_allocations table...
✓ Table created successfully

📝 Step 3: Creating indexes...
✓ Indexes created successfully

📝 Step 4: Adding table and column comments...
✓ Comments added successfully

🔍 Step 5: Verifying migration...
✓ rounds.finalization_mode: character varying (default: 'auto')
✓ pending_allocations table: 10 columns
✓ Indexes created: 4
  - idx_pending_allocations_player
  - idx_pending_allocations_round
  - idx_pending_allocations_team
  - pending_allocations_pkey

📊 Checking existing rounds...
✓ Found 42 existing rounds
  All existing rounds will default to 'auto' finalization mode

💾 Committing changes...
✓ Migration committed successfully

============================================================
✅ Migration completed successfully!
============================================================
```

## Rollback (if needed)

```sql
DROP TABLE IF EXISTS pending_allocations CASCADE;
ALTER TABLE rounds DROP COLUMN IF EXISTS finalization_mode;
```

## Troubleshooting

### Error: psycopg2 not installed
```bash
pip install psycopg2-binary
```

### Error: DATABASE_URL not set
```bash
export DATABASE_URL="postgresql://user:pass@host/db"
```

### Error: Permission denied
Ensure your database user has CREATE TABLE and ALTER TABLE permissions.

## Next Steps

After successful migration:
1. ✅ Database schema updated
2. ⏳ Deploy backend API changes
3. ⏳ Deploy frontend changes
4. ⏳ Test manual finalization feature

## Files Created

- `migrations/add_manual_finalization_support.sql` - SQL migration
- `migrations/run_manual_finalization_migration.py` - Python runner
- `migrations/MANUAL_FINALIZATION_MIGRATION.md` - Full documentation
- `migrations/MIGRATION_QUICK_START.md` - This file
