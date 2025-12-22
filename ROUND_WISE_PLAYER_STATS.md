# Round-Wise Player Stats Feature

## Overview
Added dynamic round-wise filtering to the Team Management Player Stats page, allowing committee admins to view player statistics for specific round ranges (weekly stats). The round ranges are automatically generated based on the actual rounds in the database.

## Changes Made

### 1. Frontend - Player Stats Page
**File**: `app/dashboard/committee/team-management/player-stats/page.tsx`

- Removed hardcoded `RoundRangeType` and replaced with dynamic `RoundRange` interface
- Added state for `roundRanges` array and `totalRounds` count
- Added `useEffect` to fetch round information from the API
- Dynamically generates round range tabs (7 rounds per tab) based on actual data
- Shows total rounds count in the UI
- Updated round range tabs to render dynamically using `.map()`

### 2. API - Fixtures Rounds Endpoint
**File**: `app/api/fixtures/rounds/route.ts` (NEW)

- Created new API endpoint to get round information
- Queries `fixtures` table to get max, min, and total round count
- Returns round statistics for a given season

### 3. Hook - usePlayerStats
**File**: `hooks/useStats.ts`

- Added `startRound?: number` parameter
- Added `endRound?: number` parameter
- Updated query parameters to include round range in API calls

### 4. Backend - Player Stats API
**File**: `app/api/stats/players/route.ts`

- Added `startRound` and `endRound` query parameter parsing
- **Uses actual database tables**: `matchups` and `fixtures`
- Aggregates stats using CTE (Common Table Expression) with UNION for home/away players
- Calculates the following metrics:
  - Matches played (count of distinct fixtures)
  - Wins, draws, losses (based on goal comparison)
  - Goals scored, goals conceded
  - Clean sheets (when opponent scored 0)
  - MOTM awards (from `fixtures.motm_player_id`)
- Joins with `player_seasons` to get team info and star rating
- Only works for modern seasons (Season 16+)

## Features

### Dynamic Round Range Tabs
- **All Rounds**: Shows cumulative stats for the entire season
- **Rounds 1-7, 8-14, 15-21, etc.**: Automatically generated based on actual rounds
- Shows total round count in the header (e.g., "📅 Round Range (42 rounds total)")
- Adapts to any season length (not hardcoded to 42 rounds)

### Benefits
1. **Flexible**: Works with any number of rounds (14, 28, 42, etc.)
2. **Weekly Performance Tracking**: See how players performed in specific weeks
3. **Form Analysis**: Identify players in good/bad form during certain periods
4. **Award Decisions**: Make informed decisions for weekly awards
5. **Excel Export**: Export stats with round range included in filename

## Usage

1. Navigate to `/dashboard/committee/team-management/player-stats`
2. Round range tabs are automatically generated based on season data
3. Select a round range to view filtered statistics
4. Use the existing tabs (Golden Boot, Golden Glove, etc.) to see top performers
5. Export to Excel with round range included in filename

## Technical Notes

### Database Tables Used
- **`matchups`**: Contains individual match results (home_goals, away_goals, player IDs)
- **`fixtures`**: Contains MOTM data, round_number, and season_id
- **`player_seasons`**: Contains team info, category, and star rating

### Query Strategy
The API uses a CTE to UNION home and away player stats:
```sql
WITH player_match_stats AS (
  -- Home players
  SELECT player_id, goals, goals_conceded, result, clean_sheet, motm
  FROM matchups m
  INNER JOIN fixtures f ON m.fixture_id = f.id
  WHERE f.round_number BETWEEN startRound AND endRound
  
  UNION ALL
  
  -- Away players
  SELECT player_id, goals, goals_conceded, result, clean_sheet, motm
  FROM matchups m
  INNER JOIN fixtures f ON m.fixture_id = f.id
  WHERE f.round_number BETWEEN startRound AND endRound
)
SELECT player_id, SUM(goals), SUM(wins), etc.
FROM player_match_stats
GROUP BY player_id
```

### Round Range Generation
- Fetches max round number from `fixtures` table
- Generates ranges of 7 rounds each (1-7, 8-14, 15-21, etc.)
- Last range may have fewer than 7 rounds (e.g., 36-42 for a 42-round season)

## API Endpoints

### GET `/api/fixtures/rounds?seasonId={seasonId}`
Returns round information for a season:
```json
{
  "success": true,
  "maxRound": 42,
  "minRound": 1,
  "totalRounds": 42
}
```

### GET `/api/stats/players?tournamentId={id}&startRound={n}&endRound={m}`
Returns aggregated player stats for the specified round range.

## Future Enhancements

Potential improvements:
1. Custom round range selector (e.g., "Rounds 5-12")
2. Comparison view (compare two round ranges side-by-side)
3. Round-by-round breakdown chart
4. Historical season support (if matchups data is available)
5. Configurable rounds per tab (e.g., 5 or 10 instead of 7)
