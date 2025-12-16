# Fix Duplicate Player Points Guide

## Problem
When fixture results are submitted multiple times, player points in the `player_seasons` table were being calculated twice, leading to inflated stats.

## Solution Implemented

### 1. Prevention (Already Fixed)
Enhanced the `/api/realplayers/update-stats` route to properly check `processed_fixtures` array before updating stats:
- Parses `processed_fixtures` whether it's stored as JSON or JSONB
- Skips update if fixture already processed
- Logs when duplicates are prevented

### 2. Fix Existing Duplicates

#### Option A: Web-Based Admin Tool (Recommended)
1. Navigate to `/dashboard/committee/fix-duplicate-points`
2. Click "Analyze Duplicates" to see affected players
3. Review the list showing:
   - Current (inflated) points
   - Correct points (from round_players)
   - Difference
   - Goals, assists, and fixture counts
4. Click "Fix All" to recalculate all stats from source data

#### Option B: SQL Script
Run the script at `scripts/fix-duplicate-player-points.sql`:

```bash
# Step 1: Analyze (read-only)
psql $DATABASE_URL -f scripts/fix-duplicate-player-points.sql

# Step 2: Review the output, then uncomment the UPDATE section in the script

# Step 3: Apply the fix
psql $DATABASE_URL -f scripts/fix-duplicate-player-points.sql
```

## How It Works

The fix recalculates player stats by:
1. Aggregating actual stats from `round_players` table (source of truth)
2. Using `COUNT(DISTINCT fixture_id)` to avoid counting duplicates
3. Updating `player_seasons` with correct values
4. Rebuilding the `processed_fixtures` array with unique fixture IDs

## Verification

After fixing, verify no mismatches remain:

```sql
WITH player_actual_stats AS (
  SELECT 
    rp.player_id,
    rp.season_id,
    SUM(rp.points) as actual_total_points
  FROM round_players rp
  WHERE rp.points IS NOT NULL
  GROUP BY rp.player_id, rp.season_id
)
SELECT COUNT(*) as mismatched_players
FROM player_seasons ps
JOIN player_actual_stats pas ON ps.player_id = pas.player_id AND ps.season_id = pas.season_id
WHERE ps.total_points != pas.actual_total_points;
```

Should return `0` mismatched players.

## Related Issues Fixed
- ✅ Duplicate salary deductions (see `FIX_TEAM_FINANCES_GUIDE.md`)
- ✅ Duplicate player points (this guide)
- ✅ Penalty goals not counted (fixed in matchups API)
- ✅ Deadline blocking result entry (fixed in fixture API)
