# Database Migration Guide - Unified Rounds Schema

## Overview
This guide will help you migrate from having two separate rounds tables (`rounds` and `auction_rounds`) to a single unified `rounds` table that supports all features.

## What Changed?

### Before:
- **`rounds` table** - UUID-based, for blind bidding only
- **`auction_rounds` table** - SERIAL-based, for bulk bidding only  
- ❌ **Problem:** Code was inconsistent, some files used one table, some used the other

### After:
- **`rounds` table** - UUID-based, supports ALL round types
- ✅ **Solution:** One table with all features, consistent across entire codebase

## Migration Steps

### Step 1: Run the Unified Schema Migration

#### Via Neon Dashboard (Recommended)
1. Go to your Neon Database Dashboard: https://console.neon.tech
2. Select your project
3. Click on "SQL Editor"
4. Copy and paste the contents of `database/migrations/unified-rounds-schema.sql`
5. Click "Run" to execute

### Step 2: Verify Migration

Run these queries in the SQL Editor:

```sql
-- Check if rounds table exists with all columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'rounds'
ORDER BY ordinal_position;
```

Expected columns:
- id (uuid)
- season_id (varchar)
- round_number (integer)
- position (varchar)
- position_group (varchar)
- round_type (varchar) 
- max_bids_per_team (integer)
- base_price (integer)
- start_time (timestamp with time zone)
- end_time (timestamp with time zone)
- duration_seconds (integer)
- status (varchar)
- created_at, updated_at (timestamp with time zone)

## Now You Can Create Bulk Rounds!

### From Committee Dashboard:
1. Go to `/dashboard/committee/bulk-rounds`
2. Click "Create Bulk Round"
3. Set base price (e.g., £10)
4. Set duration (e.g., 300 seconds)
5. Click "Create Bulk Round"
6. Add players (if in draft mode)
7. Click "Start Round Now" ✅

### The unified schema supports:
- ✅ **Normal blind bidding rounds** (position-based)
- ✅ **Bulk bidding rounds** (fixed price, multiple players)
- ✅ **Tiebreaker auctions** (last person standing)

## All Code Updated

All API endpoints now use the unified `rounds` table:
- `/api/rounds` - All CRUD operations
- `/api/admin/bulk-rounds/*` - Bulk round management
- `/api/team/bulk-rounds/*` - Team bidding
- `/api/team/bulk-tiebreakers/*` - Tiebreaker participation

## What If I Get Errors?

### Error: "relation rounds does not exist"
**Solution:** Run the migration SQL file in Neon dashboard

### Error: Column missing
**Solution:** Re-run the migration (it's safe to run multiple times)

### Error: Still says "auction_rounds"
**Solution:** Restart your Next.js development server

## Quick Migration Command

```bash
# In your project directory
# Just run the SQL file in Neon Dashboard SQL Editor
# File: database/migrations/unified-rounds-schema.sql
```

That's it! Your database is now ready.
