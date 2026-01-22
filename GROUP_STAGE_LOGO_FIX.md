# Group Stage Team Logo Fix

## Issue
Group stage tournaments (Champions League, Pro League) were not showing team logos in the standings table, while league format tournaments were showing them correctly.

## Root Cause
The `calculateGroupStandings` function in the standings API was not fetching team logos from Firebase, unlike the `calculateLeagueStandings` function which did fetch them.

## Changes Made

### 1. API Route (`app/api/tournaments/[id]/standings/route.ts`)
- **Made `calculateGroupStandings` async**: Changed from regular function to async function
- **Added team logo fetching**: Now fetches team logos from Firebase for all teams in all groups
- **Updated team initialization**: Added `team_logo: null` field to team objects
- **Updated function call**: Changed to `await calculateGroupStandings(...)` in the main handler

### 2. GroupStageStandings Component (`components/tournament/GroupStageStandings.tsx`)
- **Added team_logo field**: Updated `GroupTeam` interface to include optional `team_logo` field
- **Added logo display**: Updated the team name cell to show team logo (or fallback avatar) similar to league table
- **Improved layout**: Team logo appears next to team name with proper styling

## How It Works Now

1. **API fetches fixtures** for the tournament
2. **Calculates group standings** from completed fixtures
3. **Fetches team logos** from Firebase `teams` collection
4. **Maps logos to teams** in all groups
5. **Returns standings** with team logos included
6. **Component displays** team logos in the standings table

## Visual Changes

### Before
- Group stage standings showed only team names (text only)
- No visual distinction between teams

### After
- Group stage standings show team logos next to team names
- Fallback avatar (first letter of team name) if no logo exists
- Consistent with league format display
- Better visual hierarchy and team recognition

## Testing
1. Navigate to Champions League or Pro League standings
2. Verify team logos appear next to team names in the group tables
3. Check that fallback avatars appear for teams without logos
4. Confirm logos are consistent across all group tabs

## Files Modified
- `app/api/tournaments/[id]/standings/route.ts`
- `components/tournament/GroupStageStandings.tsx`
