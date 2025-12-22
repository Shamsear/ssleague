# Player Stats Verification Guide

## Overview

This guide explains how to verify and fix player statistics by comparing matchup data with player_seasons records.

## Scripts

### 1. Preview Script (Read-Only)
**File**: `scripts/preview-player-stats-comparison.js`

This script analyzes all player stats without making any changes.

**What it does**:
- Aggregates stats from all matchups for each player
- Compares with current player_seasons stats
- Reports discrepancies
- Exports detailed JSON report

**Stats Checked**:
- `matches_played` - Total matches played
- `wins` - Matches won
- `draws` - Matches drawn
- `losses` - Matches lost
- `goals_scored` - Total goals scored
- `goals_conceded` - Total goals conceded
- `clean_sheets` - Matches with 0 goals conceded
- `motm_count` - Man of the Match awards

**Usage**:
```bash
node scripts/preview-player-stats-comparison.js
```

**Output**:
```
═══════════════════════════════════════════════════════════
                    SUMMARY REPORT                         
═══════════════════════════════════════════════════════════

Total Players Analyzed:        150
✅ Players Matching:            120
⚠️  Players with Discrepancies: 25
📭 Players with No Matchups:    5
🔢 Total Discrepancy Count:     48

═══════════════════════════════════════════════════════════
                 DETAILED DISCREPANCIES                    
═══════════════════════════════════════════════════════════

🔴 John Doe (player_123)
   Team: team_456 | Season: SSPSLS16
   ─────────────────────────────────────────────────────
   matches_played       | DB:   10 | Matchups:   12 | ↑ +2
   wins                 | DB:    5 | Matchups:    6 | ↑ +1
   goals_scored         | DB:   15 | Matchups:   18 | ↑ +3
```

**JSON Export**:
The script creates a timestamped JSON file with full details:
```
player-stats-discrepancies-2025-12-22T10-30-00.json
```

### 2. Recalculation Script (Write)
**File**: `scripts/recalculate-player-stats.js`

This script recalculates and updates all player stats from matchup data.

**What it does**:
- Recalculates all stats from matchups
- Updates player_seasons table
- Reports success/failure for each player

**Usage**:
```bash
node scripts/recalculate-player-stats.js
```

**Output**:
```
🔄 Starting Player Stats Recalculation...

📊 Found 150 active player seasons to recalculate

   ✅ Updated 10/150 players...
   ✅ Updated 20/150 players...
   ...

═══════════════════════════════════════════════════════════
                    RECALCULATION COMPLETE                 
═══════════════════════════════════════════════════════════

✅ Successfully updated: 145 players
⚪ Unchanged:            5 players
❌ Errors:               0 players
```

## Workflow

### Step 1: Preview (Recommended First)
Always run the preview script first to see what will change:

```bash
node scripts/preview-player-stats-comparison.js
```

Review the output and JSON file to understand discrepancies.

### Step 2: Analyze Discrepancies
Common causes of discrepancies:
- **Missing matchup results**: Some fixtures don't have results entered
- **Duplicate matchups**: Same matchup entered twice
- **Manual stat edits**: Stats were manually adjusted
- **Data migration issues**: Stats from old system not properly migrated

### Step 3: Fix Issues (If Needed)
If you find issues in the matchup data:
1. Fix the matchup data first
2. Delete duplicate matchups
3. Add missing results

### Step 4: Recalculate
Once matchup data is correct, run the recalculation:

```bash
node scripts/recalculate-player-stats.js
```

### Step 5: Verify
Run the preview script again to confirm all discrepancies are fixed:

```bash
node scripts/preview-player-stats-comparison.js
```

You should see:
```
✅ All player stats match perfectly! No discrepancies found.
```

## Understanding the Stats

### Matches Played
- Count of all matchups where the player participated
- Includes both home and away matches
- Only counts matches with results (goals entered)

### Wins/Draws/Losses
- **Win**: Player scored more goals than opponent
- **Draw**: Player scored same goals as opponent
- **Loss**: Player scored fewer goals than opponent

### Goals Scored/Conceded
- **Scored**: Total goals the player scored across all matches
- **Conceded**: Total goals scored against the player

### Clean Sheets
- Matches where the player conceded 0 goals
- Important defensive stat

### MOTM Count
- Number of times player was Man of the Match
- Counted from fixtures table, not matchups

## Troubleshooting

### "No discrepancies found" but stats look wrong
- Check if matchup results are entered correctly
- Verify season_id matches between matchups and player_seasons
- Check for soft-deleted or inactive player_seasons

### "Error updating player"
- Check database connection
- Verify player_id exists in both tables
- Check for NULL values in matchup results

### Stats still wrong after recalculation
- Verify matchup data is correct
- Check for duplicate player_seasons records
- Look for matchups with NULL results

## Database Schema

### player_seasons Table
```sql
CREATE TABLE player_seasons (
  player_id TEXT,
  season_id TEXT,
  team_id TEXT,
  player_name TEXT,
  matches_played INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  draws INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  goals_scored INTEGER DEFAULT 0,
  goals_conceded INTEGER DEFAULT 0,
  clean_sheets INTEGER DEFAULT 0,
  motm_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active'
);
```

### matchups Table
```sql
CREATE TABLE matchups (
  fixture_id TEXT,
  season_id TEXT,
  home_player_id TEXT,
  home_player_name TEXT,
  away_player_id TEXT,
  away_player_name TEXT,
  home_goals INTEGER,
  away_goals INTEGER,
  position INTEGER
);
```

## Best Practices

1. **Run preview before recalculation**: Always check what will change
2. **Backup before recalculation**: Take a database backup
3. **Fix source data first**: Don't recalculate if matchup data is wrong
4. **Run during off-peak**: Recalculation can take time for large datasets
5. **Verify after changes**: Always run preview again to confirm

## Automation

You can schedule these scripts to run automatically:

### Daily Verification (Preview Only)
```bash
# Add to cron or task scheduler
0 2 * * * cd /path/to/project && node scripts/preview-player-stats-comparison.js
```

### Weekly Recalculation
```bash
# Run every Sunday at 3 AM
0 3 * * 0 cd /path/to/project && node scripts/recalculate-player-stats.js
```

## Support

If you encounter issues:
1. Check the JSON export for detailed discrepancy data
2. Verify database connection and credentials
3. Check matchup data for anomalies
4. Review player_seasons for duplicate records

## Related Documentation

- `FIXTURE_LINEUP_LOCK_FIX.md` - Lineup locking system
- `PLAYER_STATS_DOCUMENTATION.md` - Player stats architecture
- `DATABASE_ARCHITECTURE_SUMMARY.md` - Database schema
