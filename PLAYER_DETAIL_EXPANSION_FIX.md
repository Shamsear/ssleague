# Player Detail Expansion Fix ✅

## Problem
When clicking "Click for details" on a player (e.g., Vimal), the expansion showed:
- Total Points: 0
- Goals: 0
- Clean Sheets: 0
- Matches: 0
- Match-by-Match: "No match data yet"

Even though the player card showed 18pts from the database.

## Root Cause
The `togglePlayerBreakdown` function was **completely missing** from the code! The onClick handler was calling a non-existent function, so clicking on players did nothing.

## Solution

### 1. Added Missing Function
Created the `togglePlayerBreakdown` function that:
- Toggles player expansion (collapse if already open)
- Fetches player match data from API
- Handles loading and error states

```typescript
const togglePlayerBreakdown = async (playerId: string) => {
  if (expandedPlayer === playerId) {
    setExpandedPlayer(null);
    setPlayerData(null);
    return;
  }

  setExpandedPlayer(playerId);
  setIsLoadingPlayer(true);

  try {
    const response = await fetchWithTokenRefresh(
      `/api/fantasy/players/${playerId}/matches?league_id=${leagueId}`
    );
    const data = await response.json();
    setPlayerData(data);
  } catch (error) {
    setPlayerData({ error: true });
  } finally {
    setIsLoadingPlayer(false);
  }
};
```

### 2. Created API Endpoint
**File**: `app/api/fantasy/players/[playerId]/matches/route.ts`

Fetches and calculates:
- **Match data**: All completed matchups for the player
- **Stats**: Total goals, clean sheets, MOTM, matches played
- **Points**: Total points from `fantasy_squad` table
- **Captain/VC status**: From fantasy squad data

**Data returned:**
```json
{
  "stats": {
    "total_goals": 6,
    "total_clean_sheets": 1,
    "total_motm": 1,
    "total_matches": 1,
    "total_points": 18,
    "average_points": "18.0",
    "best_performance": 18,
    "total_bonus_points": 0
  },
  "matches": [
    {
      "round_number": 1,
      "opponent_name": "Qatar Gladiators",
      "goals_scored": 3,
      "goals_conceded": 2,
      "clean_sheet": false,
      "motm": false,
      "is_captain": false,
      "is_vice_captain": true
    }
  ]
}
```

### 3. Match Data Processing
The API:
- Queries `matchups` table for player's completed matches
- Determines if player was home or away
- Calculates goals scored/conceded from player's perspective
- Checks for clean sheets (0 goals conceded)
- Checks if player was MOTM
- Includes captain/VC status for point calculation

## What Now Works

When clicking on a player:
1. ✅ **Expansion opens** with loading indicator
2. ✅ **Stats display** correctly:
   - Total Points (from database)
   - Goals scored
   - Clean sheets
   - MOTM count
   - Matches played
   - Average points
3. ✅ **Match-by-Match breakdown** shows:
   - Each match with round number
   - Opponent name
   - Goals scored/conceded
   - Win/Draw/Loss result
   - Point breakdown with all scoring rules
   - Captain/VC multiplier

## Files Changed
1. `app/dashboard/committee/fantasy/teams/[leagueId]/page.tsx`
   - Added `togglePlayerBreakdown` function
   
2. `app/api/fantasy/players/[playerId]/matches/route.ts` (NEW)
   - Fetches player match data
   - Calculates stats
   - Returns formatted data for display

## Testing
1. Navigate to Committee → Fantasy → Teams
2. Select a team
3. Click "Click for details" on any player
4. Should see:
   - Loading indicator
   - Stats populated with actual data
   - Match-by-match breakdown with all matches
   - Correct point calculations

Player details now load and display correctly! 🎉
