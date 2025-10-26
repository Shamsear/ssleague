# Add Contract Columns Migration

## Overview
This migration adds contract-related columns to the `player_seasons` table to support Real Player (SS Member) contracts.

## Columns Added
- `auction_value` (INTEGER) - Amount paid for player in auction
- `salary_per_match` (DECIMAL) - Calculated salary per match
- `contract_id` (VARCHAR) - Unique contract identifier
- `contract_start_season` (VARCHAR) - Season when contract starts
- `contract_end_season` (VARCHAR) - Season when contract ends
- `contract_length` (INTEGER) - Length of contract in seasons

## Indexes Created
- `idx_player_seasons_contract_id` - For fast contract lookups
- `idx_player_seasons_contract_season` - For contract season queries

## How to Run

### Option 1: Using TypeScript (Recommended)
```bash
npx tsx scripts/add-contract-columns.ts
```

### Option 2: Using SQL directly in Neon Console
1. Go to Neon Console → Tournament Database
2. Open SQL Editor
3. Copy and paste contents of `add-contract-columns.sql`
4. Execute

## Verification
After running, verify columns exist:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'player_seasons' 
AND column_name LIKE '%contract%' OR column_name LIKE '%auction%' OR column_name LIKE '%salary%';
```

## Impact
- **Zero downtime** - Uses `ADD COLUMN IF NOT EXISTS`
- **Safe to re-run** - Idempotent operations
- **Existing data preserved** - Only adds new columns with defaults

## What This Enables
- Committee can assign Real Players (SS Members) to teams
- Track auction values and salaries
- Manage 2-season contracts
- Auto-create next season registrations
