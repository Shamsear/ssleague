# Player Seasons Stats Recalculation

## Overview
Script to recalculate player_seasons statistics from matchups and fixtures tables in the tournament database.

## Script Location
`scripts/recalculate-player-seasons-stats.js`

## What It Does
Recalculates the following statistics for each player in player_seasons table:
- `matches_played` - Total matches played (home + away)
- `goals_scored` - Total goals scored
- `goals_conceded` - Total goals conceded
- `wins` - Total wins
- `draws` - Total draws
- `losses` - Total losses
- `clean_sheets` - Matches where player didn't concede any goals
- `motm_awards` - Man of the Match awards from fixtures table

## Data Sources
1. **Matchups Table** - Player match statistics (joined with fixtures)
   - Home player stats: `home_player_id`, `home_goals`, `away_goals`
   - Away player stats: `away_player_id`, `away_goals`, `home_goals`
   - Only counts matchups from COMPLETED fixtures

2. **Fixtures Table** - Match context and MOTM awards
   - `status` - Must be 'completed' to be counted
   - `motm_player_id` - Player who won Man of the Match
   - `season_id` - Season filter

## How It Works
1. Fetches all players from player_seasons for season SSPSLS16
2. For each player:
   - Joins matchups with fixtures table
   - Filters for completed fixtures only (status = 'completed')
   - Filters by season_id
   - Calculates stats from all matchups (home and away)
   - Counts MOTM awards from the same matchup data
   - Updates player_seasons with calculated values

## Usage
```bash
node scripts/recalculate-player-seasons-stats.js
```

## Output
- Progress log showing each player's updated stats
- Summary showing:
  - Total players processed
  - Successfully updated count
  - Skipped (no data) count
  - Errors count
- Top 10 players by matches played

## Example Output
```
✅ Muhammed Fijas (Psychoz): 42MP, 170G-41GC, 36W-5D-1L, 18CS, 23MOTM
✅ Abid Rizwan (Los Galacticos): 42MP, 94G-48GC, 26W-11D-5L, 15CS, 6MOTM
✅ Rohith (Legends FC): 36MP, 118G-54GC, 23W-8D-5L, 8CS, 11MOTM
```

## Notes
- Only processes players with season_id = 'SSPSLS16'
- Only counts matchups from completed fixtures (status = 'completed')
- Joins matchups with fixtures table for proper filtering
- Clean sheets counted when opponent scored 0 goals
- MOTM awards counted from fixtures.motm_player_id in the matchup data
- Script is idempotent - can be run multiple times safely
- Uses same logic as the player-stats-by-round API endpoint

## Current Status
- ✅ Script created and tested
- ✅ All 86 players processed successfully
- ✅ Stats calculated correctly from completed fixtures
- ✅ Maximum matches: 42 (reasonable for season)
- ✅ MOTM awards being counted correctly from matchups
- ✅ Joins with fixtures table to filter by status and season

## When to Run
Run this script:
- After match results are entered and fixtures are marked as completed
- After MOTM awards are assigned in fixtures
- When player stats need to be refreshed/corrected
- After bulk match result updates
- When fixtures status changes to 'completed'

## Database Tables
### player_seasons (Updated)
- matches_played: integer
- goals_scored: integer
- goals_conceded: integer
- wins: integer
- draws: integer
- losses: integer
- clean_sheets: integer
- motm_awards: integer

### matchups (Source)
- home_player_id: text
- away_player_id: text
- home_goals: integer
- away_goals: integer
- fixture_id: text (joins with fixtures)

### fixtures (Source for filtering and MOTM)
- id: text
- status: character varying ('completed', 'pending', etc.)
- motm_player_id: text
- season_id: character varying
- tournament_id: character varying
