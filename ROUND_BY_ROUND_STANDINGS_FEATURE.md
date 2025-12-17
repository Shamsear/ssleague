# Round-by-Round Standings Feature

## Overview
Implemented a comprehensive round-by-round standings feature that allows users to view and share tournament standings as they were after any specific round.

## Features Implemented

### 1. Round Selector UI
- Added a round selector in the TournamentStandings component
- Shows buttons for "All Rounds" and each individual round
- Visual feedback for selected round with blue highlighting
- Only displays for league format tournaments

### 2. API Enhancements

#### New Endpoint: `/api/tournaments/[id]/rounds`
- Fetches all rounds for a tournament
- Returns round numbers, positions, and status
- Used to populate the round selector

#### Updated Endpoint: `/api/tournaments/[id]/standings`
- Added optional `upToRound` query parameter
- Filters fixtures by round before calculating standings
- Recalculates all statistics (wins, losses, goals, etc.) based only on matches up to the selected round
- Ensures accurate historical standings

### 3. ShareableLeaderboard Updates
- Receives `selectedRound` and `availableRounds` props
- Displays selected round in the leaderboard title (e.g., "LEADERBOARD - AFTER ROUND 5")
- Generated images include the round information
- Works seamlessly with download and share functionality

### 4. Data Accuracy
- Standings are recalculated from scratch for each round selection
- All statistics reflect only matches played up to the selected round:
  - Matches played
  - Wins, draws, losses
  - Goals for/against
  - Goal difference
  - Points
  - Win percentage

## How It Works

1. **User selects a round** in the TournamentStandings page
2. **Component fetches filtered data** from the API with `?upToRound=X` parameter
3. **API queries rounds table** to get all round IDs up to the selected round
4. **API filters fixtures** to only include matches from those rounds
5. **Standings are recalculated** based on the filtered fixtures
6. **UI updates** to show historical standings
7. **ShareableLeaderboard** generates images with the round information

## Usage

### For Committee Admins
Navigate to: `/dashboard/committee/team-management/team-standings`

1. Select a tournament from the dropdown
2. Use the round selector to choose:
   - "All Rounds" - Shows current complete standings
   - "Round 1", "Round 2", etc. - Shows standings as they were after that round
3. Preview and share the standings image with the selected round

### API Usage
```typescript
// Get current standings
GET /api/tournaments/{tournamentId}/standings

// Get standings after round 5
GET /api/tournaments/{tournamentId}/standings?upToRound=5
```

## Files Modified

1. **app/api/tournaments/[id]/standings/route.ts**
   - Added `upToRound` query parameter handling
   - Added round filtering logic
   - Updated fixture queries to include round_id

2. **components/tournament/TournamentStandings.tsx**
   - Added round selection state
   - Added round fetching logic
   - Added round selector UI
   - Passes round info to ShareableLeaderboard

3. **components/tournament/ShareableLeaderboard.tsx**
   - Updated props to receive selectedRound
   - Updated leaderboard title to show round
   - Removed internal round selector (moved to parent)

4. **app/api/tournaments/[id]/rounds/route.ts** (NEW)
   - Created new endpoint to fetch tournament rounds
   - Returns round numbers and metadata

## Benefits

1. **Historical Analysis**: View how standings evolved throughout the season
2. **Accurate Data**: Recalculated from scratch, not filtered from current data
3. **Shareable**: Generate and share images of standings at any point in time
4. **User-Friendly**: Simple button interface for round selection
5. **Performance**: Efficient queries using round_id filtering

## Technical Notes

- Uses PostgreSQL array operations for efficient round filtering
- Maintains backward compatibility (works without round parameter)
- Fetches team logos from Firebase for visual appeal
- Supports all tournament formats (league, group stage, knockout)
- Round selector only appears for league format tournaments
