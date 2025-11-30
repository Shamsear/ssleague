# Fetch Team Football Players Guide

This guide explains how to fetch football players (eFootball players) for any team from the auction database.

## Database Structure

The system uses two tables to store football player data:

1. **`footballplayers`** - Contains all player details (name, position, ratings, stats, etc.)
2. **`team_players`** - Junction table linking teams to their acquired players (includes purchase price, acquisition date, etc.)

## Available Tools

### 1. Command Line Script

**Location:** `scripts/fetch-team-players.ts`

**Usage:**
```bash
# Fetch players for a specific team
npx tsx scripts/fetch-team-players.ts SSPSLT0002

# If no team ID provided, defaults to SSPSLT0002
npx tsx scripts/fetch-team-players.ts
```

**Output:**
- Team information (name, season, budget, spending)
- Complete list of all players with detailed stats
- Summary statistics (total spent, position breakdown)

### 2. Find Team Script

**Location:** `scripts/find-team.ts`

**Usage:**
```bash
# Search for teams by ID or name
npx tsx scripts/find-team.ts
```

**Output:**
- Lists all teams in the database
- Shows team IDs, names, seasons, and player counts
- Helps you find the correct team ID to use

### 3. API Endpoint

**Location:** `app/api/teams/[id]/football-players/route.ts`

**Endpoint:** `GET /api/teams/{teamId}/football-players`

**Query Parameters:**
- `seasonId` (optional) - Filter players by specific season

**Example Requests:**
```bash
# Get all players for Manchester United
GET /api/teams/SSPSLT0002/football-players

# Get players for a specific season
GET /api/teams/SSPSLT0002/football-players?seasonId=SSPSLS16
```

**Response Format:**
```json
{
  "success": true,
  "data": {
    "team": {
      "id": "SSPSLT0002",
      "name": "Manchester United",
      "season_id": "SSPSLS16",
      "football_budget": 6325,
      "football_spent": 3675,
      "football_players_count": 14
    },
    "players": [
      {
        "team_player_id": 123,
        "player_id": "1805",
        "player_name": "Yankuba Minteh",
        "position": "RMF",
        "position_group": null,
        "club": "Brighton WB",
        "overall_rating": 75,
        "nationality": "The Gambia",
        "age": null,
        "playing_style": "Roaming Flank",
        "purchase_price": 19,
        "acquired_at": "2025-11-30T06:34:58.000Z",
        "round_id": "SSPSLFR00014",
        "season_id": "SSPSLS16",
        "speed": 85,
        "acceleration": 84,
        "ball_control": 69,
        "dribbling": 72,
        "finishing": 62
      }
    ],
    "source": "team_players_table",
    "count": 14,
    "statistics": {
      "total_spent": 3675,
      "position_breakdown": {
        "Unknown": 7,
        "CF-2": 1,
        "CB-2": 1
      }
    }
  },
  "message": "Players fetched successfully"
}
```

## Available Teams (Season 16)

| Team ID | Team Name | Players | Budget | Spent |
|---------|-----------|---------|--------|-------|
| SSPSLT0002 | Manchester United | 14 | €6,325 | €3,675 |
| SSPSLT0004 | Red Hawks FC | 14 | - | - |
| SSPSLT0006 | FC Barcelona | 14 | - | - |
| SSPSLT0008 | La Masia | 14 | - | - |
| SSPSLT0009 | Qatar Gladiators | 14 | - | - |
| SSPSLT0010 | Varsity Soccers | 14 | - | - |
| SSPSLT0013 | Psychoz | 14 | - | - |
| SSPSLT0015 | Legends FC | 14 | - | - |
| SSPSLT0016 | Blue Strikers | 14 | - | - |
| SSPSLT0020 | Skill 555 | 14 | - | - |
| SSPSLT0021 | Los Galacticos | 14 | - | - |
| SSPSLT0023 | Kopites | 14 | - | - |
| SSPSLT0026 | Portland Timbers | 14 | - | - |
| SSPSLT0034 | Los Blancos | 14 | - | - |

## Note About Team ID SSPSLT0005

The team ID `SSPSLT0005` does not exist in the current database. If you're looking for a specific team, use the `find-team.ts` script to search for it, or refer to the table above for available teams.

## Player Data Fields

Each player record includes:

### Basic Info
- `player_id` - Unique player identifier
- `player_name` - Player's full name
- `position` - Specific position (e.g., RMF, CB, DMF)
- `position_group` - Position category
- `club` - Real-world club
- `nationality` - Player's nationality
- `age` - Player's age
- `playing_style` - Playing style (e.g., "Roaming Flank", "Anchor Man")

### Ratings & Stats
- `overall_rating` - Overall player rating (0-99)
- `speed` - Speed stat
- `acceleration` - Acceleration stat
- `ball_control` - Ball control stat
- `dribbling` - Dribbling stat
- `low_pass` - Low pass stat
- `lofted_pass` - Lofted pass stat
- `finishing` - Finishing stat
- `heading` - Heading stat
- `physical_contact` - Physical contact stat
- `stamina` - Stamina stat

### Acquisition Info (from team_players)
- `purchase_price` - Amount paid for the player (in €)
- `acquired_at` - Date/time when player was acquired
- `round_id` - Round in which player was acquired
- `season_id` - Season identifier

## Integration Examples

### Frontend Component
```typescript
import { useEffect, useState } from 'react';

function TeamPlayers({ teamId }: { teamId: string }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/teams/${teamId}/football-players`)
      .then(res => res.json())
      .then(data => {
        setData(data.data);
        setLoading(false);
      });
  }, [teamId]);

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h2>{data.team.name}</h2>
      <p>Budget: €{data.team.football_budget}</p>
      <p>Spent: €{data.team.football_spent}</p>
      <p>Players: {data.count}</p>
      
      <ul>
        {data.players.map(player => (
          <li key={player.player_id}>
            {player.player_name} - {player.position} - Rating: {player.overall_rating}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

### Backend Query
```typescript
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

async function getTeamPlayers(teamId: string, seasonId?: string) {
  const players = await sql`
    SELECT 
      tp.player_id,
      tp.purchase_price,
      fp.name as player_name,
      fp.position,
      fp.overall_rating
    FROM team_players tp
    INNER JOIN footballplayers fp ON tp.player_id = fp.id
    WHERE tp.team_id = ${teamId}
    ${seasonId ? sql`AND tp.season_id = ${seasonId}` : sql``}
    ORDER BY tp.acquired_at DESC
  `;
  
  return players;
}
```

## Troubleshooting

### Team Not Found
If you get a "Team not found" error:
1. Run `npx tsx scripts/find-team.ts` to see all available teams
2. Verify the team ID format (should be like `SSPSLT0002`)
3. Check if the team exists in the current season

### No Players Returned
If a team has no players:
1. The team might not have participated in any auctions yet
2. The team might be from a different season
3. Try querying without the `seasonId` parameter to see all historical players

### Database Connection Issues
Ensure your `.env.local` file has the correct database URL:
```
DATABASE_URL=your_neon_database_url
NEON_DATABASE_URL=your_neon_database_url
```
