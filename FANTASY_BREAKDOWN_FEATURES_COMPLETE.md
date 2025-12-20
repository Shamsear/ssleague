# Fantasy Breakdown Features - Complete

## Summary

Fixed player breakdown data mismatch issues and added passive points breakdown feature to fantasy league pages.

## Issues Fixed

### 1. Player Breakdown Team ID Mismatch

**Problem:**
- Players in multiple fantasy teams were showing incorrect data in the breakdown modal
- Example: Player "Goku" is in 3 teams (FC Barcelona as VC with 64 pts, Los Blancos as regular with 42 pts, Psychoz as regular with 42 pts)
- When clicking on Goku in FC Barcelona's roster, it would sometimes show Los Blancos' data instead
- Root cause: API was using `league_id` only, which returns arbitrary team when player is in multiple teams

**Solution:**
- Updated frontend pages to pass `team_id` parameter to API
- Updated API endpoint to filter by `team_id` when provided
- Now correctly shows the selected team's data (captain status, multipliers, points)

**Files Changed:**
- `app/dashboard/team/fantasy/all-teams/page.tsx` - Pass team_id in API call
- `app/dashboard/committee/fantasy/teams/[leagueId]/page.tsx` - Pass team_id in API call
- `app/api/fantasy/players/[playerId]/matches/route.ts` - Accept and use team_id parameter

### 2. Added Passive Points Breakdown Feature

**New Feature:**
- Clickable passive points section that expands to show round-by-round breakdown
- Shows statistics: total points, total rounds, average per round, best round
- Displays detailed bonus breakdown for each round (win bonuses, clean sheet bonuses, etc.)
- Similar UX to player breakdown with expandable sections

**Files Created:**
- `app/api/fantasy/teams/[teamId]/passive-breakdown/route.ts` - New API endpoint

**Files Updated:**
- `app/dashboard/team/fantasy/all-teams/page.tsx` - Added passive breakdown UI
- `app/dashboard/committee/fantasy/teams/[leagueId]/page.tsx` - Added passive breakdown UI

## API Endpoints

### GET /api/fantasy/players/[playerId]/matches
**Query Parameters:**
- `league_id` (required) - Fantasy league ID
- `team_id` (optional) - Specific fantasy team ID (recommended for players in multiple teams)

**Returns:**
```json
{
  "stats": {
    "total_goals": 5,
    "total_clean_sheets": 2,
    "total_motm": 1,
    "total_matches": 4,
    "total_points": 64,
    "average_points": "16.0",
    "best_performance": 20
  },
  "matches": [
    {
      "round_number": 4,
      "opponent_name": "Team B",
      "goals_scored": 2,
      "clean_sheet": true,
      "motm": false,
      "points_multiplier": 150,
      "base_points": 10,
      "total_points": 15
    }
  ]
}
```

### GET /api/fantasy/teams/[teamId]/passive-breakdown
**Returns:**
```json
{
  "team": {
    "team_id": "SSPSLT0006",
    "team_name": "FC Barcelona",
    "owner_name": "fcbarcalona",
    "supported_team_name": "Psychoz",
    "passive_points": 20
  },
  "stats": {
    "total_rounds": 4,
    "total_passive_points": 20,
    "average_per_round": "5.0",
    "best_round": 5,
    "rounds_with_bonus": 4
  },
  "rounds": [
    {
      "round_number": 4,
      "real_team_name": "Psychoz",
      "bonus_breakdown": {
        "win": 5
      },
      "total_bonus": 5
    }
  ]
}
```

## Database Tables Used

### fantasy_player_points
- Stores player performance points by fixture and team
- Includes `team_id` to distinguish same player in multiple teams
- Contains `points_multiplier` (100/150/200 for regular/VC/captain)

### fantasy_team_bonus_points
- Stores passive team bonuses by round
- Includes `bonus_breakdown` JSONB field with detailed breakdown
- Tracks which real team earned the bonus

## Testing

### Test Scripts Created:
1. `scripts/diagnose-player-breakdown-mismatch.js` - Identifies players in multiple teams
2. `scripts/test-player-breakdown-fix.js` - Validates the team_id fix
3. `scripts/test-passive-breakdown.js` - Tests passive points breakdown API

### Test Results:
```
✅ Player "Goku" correctly shows different data for each team:
   - FC Barcelona: Vice-Captain, 64 pts (150x multiplier)
   - Los Blancos: Regular, 42 pts (100x multiplier)
   - Psychoz: Regular, 42 pts (100x multiplier)

✅ Passive breakdown for FC Barcelona:
   - 4 rounds with bonuses
   - 20 total passive points
   - 5 points per round average
   - All from "win" bonuses
```

## User Experience

### Player Breakdown:
1. Click on any player in the team roster
2. Expands to show match-by-match performance
3. Displays goals, clean sheets, MOTM, captain status
4. Shows point calculations with multipliers
5. Correctly reflects the selected team's perspective

### Passive Points Breakdown:
1. Click on the "Supported Team (Passive Points)" section
2. Expands to show round-by-round bonuses
3. Displays statistics (total, average, best round)
4. Shows detailed breakdown of bonus types (win, clean sheet, etc.)
5. Color-coded with green theme to distinguish from player points

## Impact

### For Players in Multiple Teams:
- **Before:** Random/incorrect data shown (8 players affected, including one in 6 teams)
- **After:** Always shows correct team-specific data

### For Passive Points:
- **Before:** Only total shown, no breakdown available
- **After:** Full transparency on how passive points were earned

## Future Enhancements

Potential improvements:
1. Add filtering by round range in breakdowns
2. Export breakdown data to CSV/Excel
3. Compare player performance across different teams
4. Show passive points trends over time
5. Add notifications when passive bonuses are awarded

## Conclusion

Both features are now fully functional and provide users with complete transparency into their fantasy points. The team_id fix ensures data accuracy for players in multiple teams, and the passive breakdown gives users insight into their team affiliation bonuses.
