# Committee Player Stats - Matchday Breakdown Feature

## Overview
Added an expandable matchday-by-matchday breakdown for each player in the committee player stats page (`/dashboard/committee/player-stats`).

## Features Implemented

### 1. New API Endpoint
**File:** `app/api/committee/player-matchday-stats/route.ts`

- Fetches matchday-by-matchday performance for a specific player
- **Important:** Handles the player ID mapping correctly:
  - Frontend passes the composite ID (e.g., `sspslpsl0020_SSPSLS16`)
  - API extracts the actual player_id (e.g., `sspslpsl0020`) from `player_seasons` table
  - Uses the actual player_id to query the `matchups` table
- Shows:
  - Round number (matchday)
  - Opponent details
  - Goals scored and conceded in each matchup
  - Goal difference
  - Points earned (capped at +5 or -5 per match based on GD)
  - Total points across all matches

### 2. Enhanced UI
**File:** `app/dashboard/committee/player-stats/page.tsx`

#### New Column
- Added "Expand" column with toggle button for each player

#### Expandable Section
When a player row is expanded, it shows:
- **Matchday table** with:
  - Round number
  - Matchup details (player names and team names)
  - Match score (goals scored vs goals conceded)
  - Goal difference with color coding (green for positive, red for negative)
  - Points earned (max +5 or -5 based on GD)
- **Total points** summary at the bottom
- **Empty state** if no completed matches exist

#### Visual Design
- Gradient background (blue to purple)
- Color-coded badges for positive/negative values
- Responsive table layout
- Loading spinner while fetching data
- Smooth expand/collapse animation

## Points Calculation Logic

Points per matchup are calculated as:
```
points = min(5, max(-5, goal_difference))
```

This means:
- Win by 5+ goals = +5 points
- Win by 3 goals = +3 points
- Draw = 0 points
- Lose by 2 goals = -2 points
- Lose by 5+ goals = -5 points

## Example Output

For Muhammed Fijas:
- Round 1: Lost 1-3 (GD: -2, Points: -2) ❌
- Round 2: Won 6-4 (GD: +2, Points: +2) ✅
- Round 3: Won 6-2 (GD: +4, Points: +4) ✅
- Round 4: Lost 0-5 (GD: -5, Points: -5) ❌
- Round 5: Won 11-0 (GD: +11, Points: +5) ✅ (capped at +5)
- **Total: 18 points**

## Usage

1. Navigate to `/dashboard/committee/player-stats`
2. Click the expand button (▼) in the first column for any player
3. View their matchday-by-matchday breakdown
4. Click again to collapse (▲)

## Technical Details

- Data is cached per player (only fetched once)
- Only shows completed matches with results
- Filters by season (currently SSPSLS16)
- Uses the `matchups` table joined with `fixtures` table
- Distinguishes between home and away matches
- Highlights the player's name in bold in matchup display
- **Bug Fix:** Correctly maps composite player IDs to actual player IDs for matchup queries

## Database Schema Notes

- `player_seasons.id` = composite ID (e.g., `sspslpsl0020_SSPSLS16`)
- `player_seasons.player_id` = actual player ID (e.g., `sspslpsl0020`)
- `matchups.home_player_id` and `matchups.away_player_id` = actual player ID (not composite)

## Future Enhancements

Potential improvements:
- Add season selector
- Export matchday data to Excel
- Filter by date range
- Show match dates
- Add charts/graphs for performance trends
- Show win/loss/draw record in matchday breakdown
