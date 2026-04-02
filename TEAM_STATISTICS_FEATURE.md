# Team Statistics Feature

## Overview
A comprehensive statistics system that displays team performance data across tournaments and seasons, similar to the tournament standings feature.

## Components Created

### 1. API Route: `/api/teams/[id]/statistics`
**Location:** `app/api/teams/[id]/statistics/route.ts`

**Purpose:** Fetches team statistics with support for filtering by season and tournament.

**Query Parameters:**
- `seasonId` (optional): Filter statistics for a specific season
- `tournamentId` (optional): Filter statistics for a specific tournament

**Response Structure:**
```json
{
  "success": true,
  "team": {
    "team_id": "string",
    "team_name": "string",
    "team_logo": "string | null",
    "captain_name": "string"
  },
  "overall": {
    "matches_played": 0,
    "wins": 0,
    "draws": 0,
    "losses": 0,
    "goals_for": 0,
    "goals_against": 0,
    "goal_difference": 0,
    "points": 0,
    "clean_sheets": 0,
    "win_percentage": 0
  },
  "tournaments": [
    {
      "tournament_id": "string",
      "tournament_name": "string",
      "season_id": "string",
      "season_name": "string",
      "format": "league | group_stage | knockout",
      "has_knockout": false,
      "matches_played": 0,
      "wins": 0,
      "draws": 0,
      "losses": 0,
      "goals_for": 0,
      "goals_against": 0,
      "goal_difference": 0,
      "points": 0,
      "clean_sheets": 0,
      "league_position": null,
      "group_name": null,
      "group_position": null,
      "knockout_stage_reached": null
    }
  ],
  "seasons": [
    {
      "season_id": "string",
      "season_name": "string",
      "tournaments_played": 0,
      "matches_played": 0,
      "wins": 0,
      "draws": 0,
      "losses": 0,
      "goals_for": 0,
      "goals_against": 0,
      "goal_difference": 0,
      "points": 0,
      "clean_sheets": 0
    }
  ]
}
```

### 2. Component: `TeamStatistics`
**Location:** `components/team/TeamStatistics.tsx`

**Purpose:** Displays team statistics in a tabbed interface with three views:
- Overall Stats: Aggregate statistics across all matches
- By Tournament: Individual tournament performance
- By Season: Season-wise aggregated statistics

**Props:**
```typescript
interface TeamStatisticsProps {
  teamId: string;           // Required: Team ID to fetch stats for
  seasonId?: string | null; // Optional: Filter by season
  tournamentId?: string | null; // Optional: Filter by tournament
}
```

**Features:**
- Responsive design with mobile-optimized views
- Color-coded statistics (wins in green, losses in red, etc.)
- Tournament position indicators (league position, group position, knockout stage reached)
- Clean sheets tracking
- Win percentage calculation
- Goal difference highlighting

### 3. Page: Team Statistics Dashboard
**Location:** `app/dashboard/team/team-statistics/page.tsx`

**Purpose:** Full-page implementation of team statistics with filtering options.

**Features:**
- Three view modes:
  - All Time: Complete performance history
  - By Season: Season-filtered statistics
  - By Tournament: Tournament-specific statistics
- Tournament selector integration
- Automatic season detection from selected tournament
- User authentication check

## Usage Examples

### Basic Usage (All Time Stats)
```tsx
import TeamStatistics from '@/components/team/TeamStatistics';

<TeamStatistics 
  teamId="TEAM_ID_HERE"
  seasonId={null}
  tournamentId={null}
/>
```

### Season-Filtered Stats
```tsx
<TeamStatistics 
  teamId="TEAM_ID_HERE"
  seasonId="SEASON_ID_HERE"
  tournamentId={null}
/>
```

### Tournament-Specific Stats
```tsx
<TeamStatistics 
  teamId="TEAM_ID_HERE"
  seasonId="SEASON_ID_HERE"
  tournamentId="TOURNAMENT_ID_HERE"
/>
```

### Direct API Call
```typescript
// Fetch all-time statistics
const response = await fetch('/api/teams/TEAM_ID/statistics');
const data = await response.json();

// Fetch season-specific statistics
const response = await fetch('/api/teams/TEAM_ID/statistics?seasonId=SEASON_ID');
const data = await response.json();

// Fetch tournament-specific statistics
const response = await fetch('/api/teams/TEAM_ID/statistics?seasonId=SEASON_ID&tournamentId=TOURNAMENT_ID');
const data = await response.json();
```

## Statistics Calculated

### Overall Statistics
- Matches Played
- Wins, Draws, Losses
- Goals For, Goals Against, Goal Difference
- Total Points (3 for win, 1 for draw)
- Clean Sheets
- Win Percentage

### Tournament-Specific Statistics
All overall stats plus:
- League Position (for league format)
- Group Name & Position (for group stage format)
- Knockout Stage Reached (highest round reached)
- Tournament format indicator

### Season-Specific Statistics
All overall stats plus:
- Number of tournaments played in the season

## Data Sources

The API fetches data from:
1. **Neon Database (Tournament DB):**
   - `fixtures` table: Match results and scores
   - `tournaments` table: Tournament information and formats

2. **Firebase Firestore:**
   - `teams` collection: Team information and logos
   - `seasons` collection: Season names and metadata

## Key Features

1. **Format-Aware Display:**
   - Automatically detects tournament format (league, group stage, knockout)
   - Shows relevant position indicators based on format
   - Tracks knockout stage progression

2. **Comprehensive Metrics:**
   - Traditional stats (W/D/L, goals, points)
   - Advanced metrics (clean sheets, win percentage)
   - Positional data (league/group standings)

3. **Flexible Filtering:**
   - View all-time statistics
   - Filter by specific season
   - Filter by specific tournament
   - Combine filters for precise data

4. **Responsive Design:**
   - Mobile-optimized card layouts
   - Desktop-optimized table views
   - Touch-friendly interface elements

## Integration Points

### Add to Navigation Menu
```tsx
<Link href="/dashboard/team/team-statistics">
  📊 Team Statistics
</Link>
```

### Embed in Team Dashboard
```tsx
import TeamStatistics from '@/components/team/TeamStatistics';

// In your team dashboard component
<TeamStatistics 
  teamId={currentTeam.id}
  seasonId={currentSeason.id}
  tournamentId={null}
/>
```

### Use in Committee Pages
```tsx
// View any team's statistics
<TeamStatistics 
  teamId={selectedTeamId}
  seasonId={seasonFilter}
  tournamentId={tournamentFilter}
/>
```

## Performance Considerations

1. **Database Queries:**
   - Optimized queries with proper indexing on `team_id`, `season_id`, `tournament_id`
   - Filters applied at database level to reduce data transfer
   - Aggregations calculated in SQL for efficiency

2. **Caching:**
   - Consider implementing caching for frequently accessed statistics
   - Statistics only change when matches are completed

3. **Loading States:**
   - Component includes loading indicators
   - Error handling with user-friendly messages
   - Graceful fallbacks for missing data

## Future Enhancements

Potential improvements:
1. Add head-to-head statistics against specific opponents
2. Include player-level statistics within team context
3. Add charts and graphs for visual representation
4. Export statistics to PDF/CSV
5. Compare statistics across multiple teams
6. Add historical trend analysis
7. Include form guide (last 5 matches)
8. Add home vs away statistics breakdown

## Testing

To test the feature:
1. Navigate to `/dashboard/team/team-statistics`
2. Try different view modes (All Time, By Season, By Tournament)
3. Select different tournaments to see filtered statistics
4. Verify statistics match actual match results
5. Test on mobile devices for responsive design
6. Check error handling with invalid team IDs

## Notes

- Statistics are calculated only from completed matches with results
- Pending or cancelled matches are excluded from calculations
- Team logos are fetched from Firebase for display
- Season names are resolved from Firebase for better readability
- The component handles missing data gracefully with appropriate messages
