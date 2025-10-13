# Database Migrations Applied

This document tracks all database migrations that have been applied to the system.

## Migration History

### 2025-01-05: Tiebreaker System Tables
**Script**: `scripts/create-tiebreaker-tables.ts`
**Status**: ✅ Applied Successfully

**Tables Created**:
1. `tiebreakers` - Main tiebreaker records
   - id (UUID, PK)
   - round_id (UUID, FK to rounds)
   - player_id (VARCHAR, FK to footballplayers)
   - original_amount (INTEGER)
   - status (VARCHAR: 'active', 'resolved', 'excluded')
   - winning_team_id (VARCHAR)
   - winning_amount (INTEGER)
   - duration_minutes (INTEGER, default: 2)
   - created_at (TIMESTAMP)
   - resolved_at (TIMESTAMP)

2. `team_tiebreakers` - Junction table for tiebreaker participation
   - id (UUID, PK)
   - tiebreaker_id (UUID, FK to tiebreakers)
   - team_id (VARCHAR)
   - original_bid_id (UUID, FK to bids)
   - new_bid_amount (INTEGER)
   - submitted (BOOLEAN)
   - submitted_at (TIMESTAMP)
   - created_at (TIMESTAMP)

**Indexes Created**:
- idx_tiebreakers_round_id
- idx_tiebreakers_status
- idx_team_tiebreakers_tiebreaker_id
- idx_team_tiebreakers_team_id

**Purpose**: 
Enable tiebreaker functionality to handle situations where multiple teams bid the same amount for a player.

---

### 2025-01-05: Encrypted Bid Data Support
**Script**: `scripts/add-encrypted-bid-column.ts`
**Status**: ✅ Applied Successfully

**Columns Added to `bids` table**:
1. `encrypted_bid_data` (TEXT)
   - Stores encrypted player_id and amount for blind bidding
   - Allows bids to remain hidden until round finalization

2. `phase` (VARCHAR(20), default: 'regular')
   - Tracks bid phase: 'regular' or 'incomplete'
   - Used for penalizing teams with incomplete bids

3. `actual_bid_amount` (INTEGER, nullable)
   - Stores original bid amount for incomplete bids
   - Used when average price is applied as penalty

**Purpose**: 
Support blind bidding system where bid details remain encrypted and hidden until round closes. Also enables incomplete bid penalty system.

**Backward Compatibility**:
The existing `player_id` and `amount` columns are retained for backward compatibility. New bids use `encrypted_bid_data` while old bids can still use the original columns.

---

### 2025-01-05: Add 'finalizing' Status to Rounds
**Script**: `scripts/add-finalizing-status.ts`
**Status**: ✅ Applied Successfully

**Constraint Updated**:
- Dropped old `rounds_status_check` constraint
- Added new constraint allowing: 'active', 'completed', 'finalizing', 'tiebreaker', 'cancelled'

**Purpose**: 
Allow rounds to have a 'finalizing' status during the finalization process, especially when tiebreakers are detected and need to be resolved before the round can be completed.

**New Status Values**:
- `active` - Round is open for bidding
- `completed` - Round finished successfully
- `finalizing` - Round being finalized (processing bids)
- `tiebreaker` - Round has active tiebreakers  
- `cancelled` - Round was cancelled

---

## How to Apply Migrations

### For New Databases
Run all migration scripts in order:

```bash
# 1. Create tiebreaker tables
npx tsx scripts/create-tiebreaker-tables.ts

# 2. Add encrypted bid columns
npx tsx scripts/add-encrypted-bid-column.ts

# 3. Add finalizing status to rounds
npx tsx scripts/add-finalizing-status.ts
```

### For Existing Databases
Check which migrations have been applied and run only the missing ones.

**To check if a table/column exists**:
```sql
-- Check if tiebreakers table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_name = 'tiebreakers'
);

-- Check if encrypted_bid_data column exists
SELECT EXISTS (
  SELECT FROM information_schema.columns 
  WHERE table_name = 'bids' 
  AND column_name = 'encrypted_bid_data'
);
```

## Migration Status Tracking

| Migration | Date Applied | Script | Status | Notes |
|-----------|-------------|---------|--------|-------|
| Tiebreaker Tables | 2025-01-05 | create-tiebreaker-tables.ts | ✅ Complete | Tables and indexes created |
| Encrypted Bid Data | 2025-01-05 | add-encrypted-bid-column.ts | ✅ Complete | Columns added to bids table |
| Finalizing Status | 2025-01-05 | add-finalizing-status.ts | ✅ Complete | Updated rounds status constraint |

## Rollback Instructions

### Rollback Tiebreaker System
```sql
-- Drop tiebreaker tables (this will cascade to team_tiebreakers)
DROP TABLE IF EXISTS tiebreakers CASCADE;
DROP TABLE IF EXISTS team_tiebreakers CASCADE;

-- Drop indexes (if tables weren't dropped)
DROP INDEX IF EXISTS idx_tiebreakers_round_id;
DROP INDEX IF EXISTS idx_tiebreakers_status;
DROP INDEX IF EXISTS idx_team_tiebreakers_tiebreaker_id;
DROP INDEX IF EXISTS idx_team_tiebreakers_team_id;
```

### Rollback Encrypted Bid Columns
```sql
-- Remove encrypted bid columns from bids table
ALTER TABLE bids DROP COLUMN IF EXISTS encrypted_bid_data;
ALTER TABLE bids DROP COLUMN IF EXISTS phase;
ALTER TABLE bids DROP COLUMN IF EXISTS actual_bid_amount;
```

**⚠️ Warning**: Rollbacks will result in data loss. Only rollback if you're certain no data needs to be preserved.

## Verification Queries

### Verify Tiebreaker System
```sql
-- Check tiebreakers table
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'tiebreakers'
ORDER BY ordinal_position;

-- Check team_tiebreakers table
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'team_tiebreakers'
ORDER BY ordinal_position;

-- Check indexes
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename IN ('tiebreakers', 'team_tiebreakers');
```

### Verify Encrypted Bid Columns
```sql
-- Check bids table columns
SELECT column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_name = 'bids'
AND column_name IN ('encrypted_bid_data', 'phase', 'actual_bid_amount');
```

## Notes

- All migrations use `IF NOT EXISTS` or `ADD COLUMN IF NOT EXISTS` to ensure idempotency
- Migrations can be safely re-run without causing errors
- Always backup your database before running migrations
- Test migrations on a development/staging database first

## Future Migrations

When adding new migrations:
1. Create a new migration script in `scripts/` directory
2. Use descriptive names (e.g., `add-xyz-feature.ts`)
3. Update this document with migration details
4. Test thoroughly before applying to production
5. Document rollback procedures
