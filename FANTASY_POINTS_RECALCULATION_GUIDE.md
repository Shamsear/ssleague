# Fantasy Points Recalculation Guide

## Overview

This system provides a complete recalculation of all fantasy points in the league. It combines four separate recalculation processes into one comprehensive operation.

## What Gets Recalculated

### 1. Player Points
- Recalculates all player performance points from completed fixtures
- Applies captain (2x) and vice-captain (1.5x) multipliers
- Based on goals, clean sheets, MOTM, wins/draws/losses, etc.
- Creates one record per player per team per fixture in `fantasy_player_points`

### 2. Passive Team Bonus Points
- Recalculates team affiliation bonuses
- Based on the real team's performance that fantasy teams support
- Awards points for wins, draws, clean sheets, high-scoring games
- Stored in `fantasy_team_bonus_points`

### 3. Squad Player Totals
- Updates the total points for each player in each fantasy squad
- Aggregates all points from `fantasy_player_points`
- Updates `fantasy_squad.total_points`

### 4. Fantasy Team Totals and Ranks
- Updates total points for each fantasy team (player points + passive points)
- Recalculates ranks for all teams in each league
- Updates `fantasy_teams.total_points`, `player_points`, `passive_points`, and `rank`

## How to Use

### Option 1: Admin Web Interface (Recommended)

1. Navigate to: `/dashboard/committee/fantasy/recalculate`
2. Click "Start Recalculation"
3. Confirm the operation
4. Wait for completion (may take several minutes)
5. View the results summary

**URL:** `https://your-domain.com/dashboard/committee/fantasy/recalculate`

### Option 2: Command Line Script

Run the combined script:

```bash
node scripts/recalculate-all-fantasy-points.js
```

This will:
- Load environment variables from `.env.local`
- Connect to both tournament and fantasy databases
- Perform all 4 recalculation steps
- Display a detailed summary with top 10 teams

### Option 3: API Endpoint

Make a POST request to:

```bash
POST /api/admin/fantasy/recalculate-all-points
```

Response:
```json
{
  "success": true,
  "message": "Fantasy points recalculation completed successfully",
  "results": {
    "playerPointsInserted": 148,
    "passiveBonusesAwarded": 47,
    "squadPlayersUpdated": 44,
    "teamsUpdated": 8,
    "leaguesRanked": 1
  }
}
```

## When to Use

Use this recalculation when:

- ✅ Scoring rules have been changed
- ✅ Match results have been corrected or updated
- ✅ Captain/Vice-captain assignments have been changed
- ✅ Data inconsistencies are detected
- ✅ New fixtures have been added retroactively
- ✅ Team affiliations (supported teams) have been updated

## What Happens During Recalculation

### Step 1: Player Points (30-40% of time)
```
1. Fetch all scoring rules from database
2. Get all completed fixtures and matchups
3. Get all fantasy squad data
4. DELETE all existing fantasy_player_points
5. Calculate points for each player in each team
6. Apply captain/VC multipliers
7. INSERT new records
```

### Step 2: Passive Bonuses (30-40% of time)
```
1. Get all active fantasy leagues
2. Reset all passive_points to 0
3. DELETE all existing fantasy_team_bonus_points
4. For each league:
   - Get team scoring rules
   - Get completed fixtures for the season
   - Calculate bonuses for home and away teams
   - Award bonuses to fantasy teams supporting those real teams
5. INSERT new bonus records
6. UPDATE fantasy_teams with passive_points
```

### Step 3: Squad Totals (10-15% of time)
```
1. Get all players in fantasy squads
2. For each player:
   - SUM total_points from fantasy_player_points
   - UPDATE fantasy_squad.total_points
```

### Step 4: Team Totals & Ranks (10-15% of time)
```
1. Get all fantasy teams
2. For each team:
   - SUM player_points from fantasy_player_points
   - Get passive_points from fantasy_teams
   - Calculate total = player_points + passive_points
   - UPDATE fantasy_teams
3. Recalculate ranks for each league
```

## Performance

- **Small League (5-10 teams):** ~10-30 seconds
- **Medium League (10-20 teams):** ~30-60 seconds
- **Large League (20+ teams):** ~1-3 minutes

Time depends on:
- Number of completed fixtures
- Number of fantasy teams
- Number of players in squads
- Database connection speed

## Safety Features

- ✅ Confirmation dialog before starting
- ✅ All operations are transactional
- ✅ Duplicate prevention (skips existing records)
- ✅ Error handling and logging
- ✅ Progress indicators
- ✅ Detailed results summary

## Database Tables Affected

| Table | Operation | Description |
|-------|-----------|-------------|
| `fantasy_player_points` | DELETE + INSERT | All player performance records |
| `fantasy_team_bonus_points` | DELETE + INSERT | All team affiliation bonuses |
| `fantasy_squad` | UPDATE | Player total points |
| `fantasy_teams` | UPDATE | Team totals, player_points, passive_points, rank |

## Troubleshooting

### Script fails with "No scoring rules found"
- Check that `fantasy_scoring_rules` table has active rules
- Ensure `is_active = true` for the rules you want to use

### Some teams have 0 points after recalculation
- Check that players in their squad have actually played in completed fixtures
- Verify that the team has selected a supported real team for passive bonuses

### Passive points are 0 for all teams
- Check that team scoring rules exist (`applies_to = 'team'`)
- Verify that fantasy teams have `supported_team_id` set
- Ensure the `supported_team_id` format matches fixture team IDs

### Script takes too long
- This is normal for large leagues with many fixtures
- Consider running during off-peak hours
- The web interface shows progress indicators

## Related Scripts

Individual scripts (now deprecated, use combined script instead):
- `scripts/recalculate-fantasy-player-points.js` - Player points only
- `scripts/recalculate-fantasy-team-points.js` - Team totals only
- `scripts/recalculate-fantasy-squad-points.js` - Squad totals only
- `scripts/calculate-passive-team-points.js` - Passive bonuses only

## Example Output

```
🎮 Starting Complete Fantasy Points Recalculation...

📊 STEP 1: Recalculating Player Points
✅ Loaded scoring rules
✅ Found 23 completed fixtures
✅ Found 115 completed matchups
✅ Found 44 squad entries
✅ Inserted 148 player point records

📊 STEP 2: Recalculating Passive Team Bonus Points
✅ Found 1 active league(s)
✅ Awarded 47 total bonus points

📊 STEP 3: Recalculating Squad Player Totals
✅ Updated 44 squad player totals

📊 STEP 4: Recalculating Fantasy Team Totals and Ranks
✅ Updated 8 team totals
✅ Updated ranks for 1 league(s)

🎉 Complete Fantasy Points Recalculation Finished!

📊 Summary:
  ✅ Player point records: 148
  ✅ Passive bonus points: 47
  ✅ Squad players updated: 44
  ✅ Teams updated: 8
  ✅ Leagues ranked: 1

🏆 Top 10 Teams:
1. FC Barcelona: 637 pts (Player: 617, Passive: 20)
2. Skill 555: 637 pts (Player: 622, Passive: 15)
3. Varsity Soccers: 635 pts (Player: 634, Passive: 1)
...
```

## Support

For issues or questions:
1. Check the console logs for detailed error messages
2. Verify database connections are working
3. Ensure all required tables exist
4. Check that scoring rules are properly configured
