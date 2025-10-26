# Group Stage Tournaments

## Overview
Full support for group stage tournaments (World Cup-style format) where teams are divided into groups, play within their groups, and top teams advance to knockout rounds.

## Features

### 1. Tournament Configuration
When creating a tournament, you can enable group stage with these settings:

- **Enable Group Stage**: Checkbox to activate group stage format
- **Number of Groups**: 2-8 groups (A, B, C, D, etc.)
- **Teams Per Group**: 2-8 teams in each group
- **Teams Advancing Per Group**: How many teams qualify for knockouts (typically 2)

### 2. Fixture Generation
- **Round-robin within groups**: Every team plays every other team in their group
- **Automatic team distribution**: Teams are randomly distributed across groups
- **Smart scheduling**: Round-robin algorithm ensures fair fixture distribution

### 3. Group Standings
Automatic calculation of standings for each group:
- **Match Statistics**: Played, Wins, Draws, Losses
- **Goals**: Goals For, Goals Against, Goal Difference
- **Points**: 3 for win, 1 for draw, 0 for loss
- **Sorting**: Points → Goal Difference → Goals For

### 4. Knockout Bracket Generation
- **Automatic seeding**: Based on group stage results
- **Smart pairing**: Group winners play runners-up from different groups
- **Progression system**: Winners advance round by round
- **Stages supported**: Round of 16, Quarter Finals, Semi Finals, Final

## Database Schema

### Tournaments Table
```sql
has_group_stage BOOLEAN DEFAULT false
number_of_groups INTEGER DEFAULT 4
teams_per_group INTEGER DEFAULT 4
teams_advancing_per_group INTEGER DEFAULT 2
```

### Firestore Collections

#### `group_fixtures`
```typescript
{
  season_id: string
  tournament_id: string
  group_name: string  // 'A', 'B', 'C', etc.
  round: number
  home_team_id: string
  home_team_name: string
  away_team_id: string
  away_team_name: string
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  home_score?: number
  away_score?: number
  result?: 'home_win' | 'away_win' | 'draw'
}
```

#### `knockout_matches`
```typescript
{
  season_id: string
  tournament_id: string
  stage: 'round_of_16' | 'quarter_final' | 'semi_final' | 'final'
  match_number: number
  home_team_id?: string
  home_team_name?: string
  away_team_id?: string
  away_team_name?: string
  status: 'pending' | 'scheduled' | 'in_progress' | 'completed'
  winner_id?: string
  winner_name?: string
}
```

## API Endpoints

### Group Fixtures

#### Generate Group Fixtures
```http
POST /api/groups/fixtures
Content-Type: application/json

{
  "season_id": "SSPSLS16",
  "tournament_id": "SSPSLS16CH",
  "number_of_groups": 4,
  "teams_per_group": 4,
  "teams": [
    { "id": "team1", "name": "Team 1" },
    { "id": "team2", "name": "Team 2" },
    ...
  ]
}
```

#### Get Group Fixtures
```http
GET /api/groups/fixtures?season_id=SSPSLS16&tournament_id=SSPSLS16CH
```

#### Delete Group Fixtures
```http
DELETE /api/groups/fixtures?season_id=SSPSLS16&tournament_id=SSPSLS16CH
```

### Group Standings

#### Get Group Standings
```http
GET /api/groups/standings?season_id=SSPSLS16&tournament_id=SSPSLS16CH
```

Response:
```json
{
  "success": true,
  "standings": {
    "A": [
      {
        "group_name": "A",
        "team_id": "team1",
        "team_name": "Team 1",
        "matches_played": 3,
        "wins": 2,
        "draws": 1,
        "losses": 0,
        "goals_for": 6,
        "goals_against": 2,
        "goal_difference": 4,
        "points": 7,
        "position": 1
      },
      ...
    ],
    "B": [...],
    ...
  }
}
```

## Usage

### Creating a Group Stage Tournament

1. **Navigate to Tournament Management**
   ```
   /dashboard/committee/team-management/tournament
   ```

2. **Click "Tournament Management" tab**

3. **Fill in tournament details:**
   - Tournament Type: Champions League (or any type)
   - Auto-generated name: "SS Super League S16 Champions League"
   - Auto-generated code: "SSPSLS16CH"

4. **Enable Group Stage:**
   - ✅ Check "Enable Group Stage"
   - Set number of groups: 4
   - Set teams per group: 4
   - Set teams advancing: 2

5. **Configure other settings** (deadlines, knockout stage, etc.)

6. **Create Tournament**

### Generating Fixtures

Using the API or admin interface:
```typescript
import { generateGroupStageFixtures } from '@/lib/firebase/groupStage';

const result = await generateGroupStageFixtures(
  'SSPSLS16',      // season_id
  'SSPSLS16CH',    // tournament_id
  4,               // number_of_groups
  4,               // teams_per_group
  teams            // array of team objects
);
```

### Viewing Group Stage

Use the `GroupStageView` component:
```tsx
import GroupStageView from '@/components/tournament/GroupStageView';

<GroupStageView 
  seasonId="SSPSLS16"
  tournamentId="SSPSLS16CH"
/>
```

Features:
- **Group tabs**: Switch between groups (A, B, C, D...)
- **View toggle**: Switch between Standings and Fixtures
- **Real-time standings**: Automatically calculated from results
- **Visual indicators**: Qualifying positions highlighted in green

### Generating Knockout Bracket

After group stage completes:
```typescript
import { generateKnockoutBracket } from '@/lib/firebase/knockoutBracket';

const result = await generateKnockoutBracket(
  'SSPSLS16',      // season_id
  'SSPSLS16CH',    // tournament_id
  4,               // number_of_groups
  2                // teams_advancing_per_group
);
```

This will:
1. Get top 2 teams from each group (8 total teams)
2. Create Quarter Final matches
3. Seed matches: 1A vs 2B, 1B vs 2A, 1C vs 2D, 1D vs 2C

### Progressing Through Knockout Rounds

```typescript
import { progressToNextRound } from '@/lib/firebase/knockoutBracket';

// After quarter finals complete
await progressToNextRound('SSPSLS16', 'SSPSLS16CH', 'quarter_final');
// Creates semi-final matches from QF winners

// After semi finals complete
await progressToNextRound('SSPSLS16', 'SSPSLS16CH', 'semi_final');
// Creates final match from SF winners
```

## Example: Champions League Format

### Configuration
- **4 groups** (A, B, C, D)
- **4 teams per group**
- **Top 2 advance** from each group
- **Total**: 16 teams → 8 advance to knockouts

### Group Stage
Each group plays round-robin:
- Group A: 4 teams × 3 matches each = 6 matches total
- Group B: 6 matches
- Group C: 6 matches
- Group D: 6 matches
- **Total: 24 group stage matches**

### Knockout Stage
8 teams advance:
- **Quarter Finals**: 4 matches (8 teams → 4 winners)
- **Semi Finals**: 2 matches (4 teams → 2 winners)
- **Final**: 1 match (2 teams → 1 champion)

## Migration

Run the SQL migration to add group stage columns:
```bash
# Connect to your tournament database
# Run: scripts/migrations/add-group-stage-fields.sql
```

Or manually:
```sql
ALTER TABLE tournaments 
ADD COLUMN IF NOT EXISTS has_group_stage BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS number_of_groups INTEGER DEFAULT 4,
ADD COLUMN IF NOT EXISTS teams_per_group INTEGER DEFAULT 4,
ADD COLUMN IF NOT EXISTS teams_advancing_per_group INTEGER DEFAULT 2;
```

## Files Created

### Core Logic
- `lib/firebase/groupStage.ts` - Group fixtures and standings
- `lib/firebase/knockoutBracket.ts` - Knockout bracket generation

### API Endpoints
- `app/api/groups/fixtures/route.ts` - Group fixtures API
- `app/api/groups/standings/route.ts` - Group standings API

### UI Components
- `components/tournament/GroupStageView.tsx` - Group stage display

### Database
- `scripts/migrations/add-group-stage-fields.sql` - Schema migration

### Documentation
- `docs/GROUP_STAGE_TOURNAMENTS.md` - This file

## Features Summary

✅ **Tournament Configuration** - Enable/configure group stage in creation form  
✅ **Database Schema** - 4 new columns for group stage settings  
✅ **Fixture Generation** - Round-robin algorithm for group matches  
✅ **Team Distribution** - Random allocation to groups  
✅ **Group Standings** - Automatic calculation with proper sorting  
✅ **API Endpoints** - RESTful APIs for fixtures and standings  
✅ **UI Components** - Beautiful group stage viewer with tabs  
✅ **Knockout Bracket** - Auto-generation from group results  
✅ **Smart Seeding** - Winners vs runners-up from different groups  
✅ **Round Progression** - Automatic advancement through knockout stages  

## Status
🎉 **Complete** - Full group stage tournament support is ready!

All 8 tasks completed. The system now fully supports group stage tournaments from creation to final.
