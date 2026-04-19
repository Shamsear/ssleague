# Player Seasons Takeover Guide

## Overview

When a team takeover happens, the `player_seasons` table (for real players/SSCoin players) needs to be updated differently than the `footballplayers` table.

## Key Difference

- **footballplayers**: Players move to new season (S16 → S17)
- **player_seasons**: Players keep SAME contract, just change team ownership

## Takeover Process for player_seasons

### Step 1: End Old Team Records

For each active player_seasons record with old team:

```sql
UPDATE player_seasons
SET 
  status = 'takeover',
  end_date = CURRENT_TIMESTAMP,
  end_reason = 'takeover',
  contract_end_season = 'SSPSLS17',  -- End contract in takeover season
  updated_at = CURRENT_TIMESTAMP
WHERE team_id = 'SSPSLT0023'  -- Old team (Kopites)
AND status = 'active'
```

### Step 2: Create New Team Records

For each player that was transferred, create new record:

```sql
INSERT INTO player_seasons (
  player_id,
  player_name,
  team_id,
  team_name,
  season_id,
  acquisition_type,
  acquisition_value,
  contract_start_season,  -- KEEP ORIGINAL
  contract_end_season,    -- KEEP ORIGINAL
  status,
  acquisition_date
) VALUES (
  'player_id',
  'Player Name',
  'SSPSLT0005',  -- New team (TM Asgardians)
  'TM Asgardians',
  'SSPSLS17',  -- Current season
  'takeover',
  acquisition_value,  -- Same value
  'SSPSLS16',  -- ORIGINAL contract start (not changed!)
  'SSPSLS18',  -- ORIGINAL contract end (not changed!)
  'active',
  CURRENT_TIMESTAMP
)
```

## Important Rules

1. **Preserve Original Contract**: The new record must have the SAME contract_start_season and contract_end_season as the original
2. **Season Changes**: Only season_id changes to current season (SSPSLS17)
3. **Team Changes**: team_id and team_name change to new team
4. **Acquisition Type**: Set to 'takeover' to track the ownership change
5. **Status**: Old record becomes 'takeover', new record is 'active'

## Example

If Kopites had a player with contract S16 → S18:

**Old Record (Kopites):**
```
team_id: SSPSLT0023
season_id: SSPSLS16
contract_start_season: SSPSLS16
contract_end_season: SSPSLS18
status: active → takeover
```

**New Record (TM Asgardians):**
```
team_id: SSPSLT0005
season_id: SSPSLS17
contract_start_season: SSPSLS16  ← SAME as original
contract_end_season: SSPSLS18    ← SAME as original
status: active
acquisition_type: takeover
```

## Why This Approach?

- Real players have multi-season contracts that should be honored
- The takeover is just a change of ownership, not a new contract
- Historical tracking shows the player moved teams but kept their contract terms
- This allows proper contract expiry tracking across team changes

## Future Implementation

When the `player_seasons` table is created and populated, any team takeover script should:

1. Query active player_seasons for old team
2. End those records with status='takeover'
3. Create new records for new team with SAME contract terms
4. Update season_id to current season only

## Related Tables

- `footballplayers` + `player_history`: Different approach (players move to new season)
- `player_seasons`: This approach (players keep contract, change team)
- `team_seasons`: Create new document for new team, preserve old team's document
