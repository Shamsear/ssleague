# Player History Table Implementation

## Problem
The `footballplayers` table has a UNIQUE constraint on `player_id`, which means:
- Each player can only exist once in the table
- Cannot track historical ownership across seasons
- Team takeovers require updating existing records, losing history

## Solution: player_history Table

A new table that tracks complete ownership and contract history for every player across all seasons.

### Table Structure

```sql
player_history (
  id                  SERIAL PRIMARY KEY,
  player_id           VARCHAR(255),      -- References footballplayers.player_id
  player_name         VARCHAR(255),
  position            VARCHAR(50),
  team_id             VARCHAR(255),
  team_name           VARCHAR(255),
  season_id           VARCHAR(255),
  acquisition_type    VARCHAR(50),       -- 'auction', 'transfer', 'swap', 'takeover', 'carryover'
  acquisition_value   INTEGER,
  acquisition_date    TIMESTAMP,
  status              VARCHAR(50),       -- 'active', 'released', 'transferred', 'swapped'
  end_date            TIMESTAMP,
  end_reason          VARCHAR(50),       -- 'release', 'transfer', 'swap', 'season_end', 'takeover'
  round_id            VARCHAR(255),
  transaction_id      VARCHAR(255),
  related_history_id  INTEGER,           -- Links to previous record (for swaps)
  created_at          TIMESTAMP,
  updated_at          TIMESTAMP
)
```

### Benefits

1. **Complete History**: Every ownership change is recorded
2. **Transfer Routes**: Can trace a player's journey across teams and seasons
3. **Team Takeovers**: Properly handled without losing data
4. **Audit Trail**: Full transparency of all player movements
5. **Analytics**: Can analyze transfer patterns, team building strategies

### Usage Patterns

#### When a player is won in auction:
```sql
-- 1. Update footballplayers (current state)
UPDATE footballplayers SET team_id = 'TEAM123', is_sold = true ...

-- 2. Create history record
INSERT INTO player_history (
  player_id, team_id, season_id, 
  acquisition_type = 'auction',
  status = 'active'
) ...
```

#### When a player is released:
```sql
-- 1. Update footballplayers
UPDATE footballplayers SET is_sold = false ...

-- 2. Close history record
UPDATE player_history 
SET status = 'released', end_date = NOW(), end_reason = 'release'
WHERE player_id = '123' AND status = 'active'
```

#### When a player is transferred:
```sql
-- 1. Close old history record
UPDATE player_history 
SET status = 'transferred', end_date = NOW(), end_reason = 'transfer'
WHERE player_id = '123' AND team_id = 'OLD_TEAM' AND status = 'active'

-- 2. Create new history record
INSERT INTO player_history (
  player_id, team_id = 'NEW_TEAM', 
  acquisition_type = 'transfer',
  status = 'active'
) ...

-- 3. Update footballplayers
UPDATE footballplayers SET team_id = 'NEW_TEAM' ...
```

#### When a player is swapped:
```sql
-- Similar to transfer, but with related_history_id linking the two swapped players
```

#### Team takeover:
```sql
-- 1. Close all S16 history records
UPDATE player_history 
SET status = 'takeover', end_date = NOW(), end_reason = 'takeover'
WHERE team_id = 'OLD_TEAM' AND season_id = 'S16' AND status = 'active'

-- 2. Create new S17 history records for new team
INSERT INTO player_history (
  player_id, team_id = 'NEW_TEAM', season_id = 'S17',
  acquisition_type = 'takeover',
  status = 'active'
) ...

-- 3. Update footballplayers to S17
UPDATE footballplayers 
SET team_id = 'NEW_TEAM', season_id = 'S17' ...
```

### Query Examples

**Get complete transfer history for a player:**
```sql
SELECT * FROM player_history 
WHERE player_id = '118042' 
ORDER BY acquisition_date DESC
```

**Get all active contracts for a team in a season:**
```sql
SELECT * FROM player_history 
WHERE team_id = 'SSPSLT0023' 
AND season_id = 'SSPSLS17' 
AND status = 'active'
```

**Get transfer route for a player:**
```sql
SELECT 
  season_id,
  team_name,
  acquisition_type,
  acquisition_value,
  acquisition_date,
  end_date,
  end_reason
FROM player_history 
WHERE player_id = '118042' 
ORDER BY acquisition_date
```

**Find players who moved between specific teams:**
```sql
SELECT DISTINCT player_name, player_id
FROM player_history h1
WHERE h1.team_id = 'TEAM_A'
AND EXISTS (
  SELECT 1 FROM player_history h2 
  WHERE h2.player_id = h1.player_id 
  AND h2.team_id = 'TEAM_B'
)
```

## Implementation Steps

### 1. Create the table
```bash
psql $DATABASE_URL -f migrations/create_player_history_table.sql
```

### 2. Backfill existing data
```bash
node scripts/backfill-player-history.js
```

### 3. Update application code
- Modify auction finalization to create history records
- Modify transfer APIs to create/close history records
- Modify release APIs to close history records
- Modify swap APIs to create linked history records

### 4. Execute team takeover
```bash
# Preview first
node scripts/preview-team-takeover-complete.js

# Execute (with DRY_RUN = false)
node scripts/execute-team-takeover-with-history.js
```

## Files Created

1. `migrations/create_player_history_table.sql` - Table schema
2. `scripts/backfill-player-history.js` - Backfill existing data
3. `scripts/execute-team-takeover-with-history.js` - Takeover with history preservation

## Next Steps

1. Review and approve the table schema
2. Create the table in database
3. Backfill existing data
4. Test with team takeover
5. Update application code to maintain history on all player movements
6. Create UI to display player transfer history

## Future Enhancements

- Add player stats snapshots at each ownership change
- Track contract modifications (value changes, extensions)
- Add notes/comments field for manual adjustments
- Create analytics dashboard for transfer patterns
- Export transfer history reports
