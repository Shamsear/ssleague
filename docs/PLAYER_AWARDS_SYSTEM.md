# Player Awards System

## Overview
Comprehensive system for managing individual and category awards for players in active seasons.

## Database Structure

### `player_awards` Table
```sql
CREATE TABLE player_awards (
  id SERIAL PRIMARY KEY,
  player_id VARCHAR(255) NOT NULL,
  player_name VARCHAR(255) NOT NULL,
  season_id VARCHAR(255) NOT NULL,
  award_category VARCHAR(50) NOT NULL,   -- 'individual' or 'category'
  award_type VARCHAR(100) NOT NULL,       -- Award name
  award_position VARCHAR(50),             -- 'Winner', 'Runner Up', 'Third Place'
  player_category VARCHAR(50),            -- Player position (for category awards)
  performance_stats JSONB,
  awarded_by VARCHAR(50) DEFAULT 'system',
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(player_id, season_id, award_category, award_type, award_position)
);
```

## Award Types

### Individual Awards (Season-Wide)
- **Golden Boot**: Top 3 goal scorers across all positions
- **Most Assists**: Top 3 assist providers
- **Most Clean Sheets**: Top 3 goalkeepers by clean sheets

### Category Awards (Position-Specific)
- **Best Attacker**: Top 3 attackers by goals + assists
- **Best Midfielder**: Top 3 midfielders by goals + assists
- **Best Defender**: Top 3 defenders by clean sheets
- **Best Goalkeeper**: Top 3 goalkeepers by clean sheets + saves

## Award Structure

### Individual Award Example
```typescript
{
  award_category: 'individual',
  award_type: 'Golden Boot',
  award_position: 'Winner',    // or 'Runner Up', 'Third Place'
  player_category: null
}
```

### Category Award Example
```typescript
{
  award_category: 'category',
  award_type: 'Best Attacker',
  award_position: 'Winner',    // or 'Runner Up', 'Third Place'
  player_category: 'Attacker'  // Player's position
}
```

## API Endpoints

### GET /api/player-awards
List player awards with optional filters.

**Query Parameters:**
- `season_id` - Filter by season
- `player_id` - Filter by player
- `award_category` - Filter by 'individual' or 'category'

**Response:**
```json
{
  "success": true,
  "awards": [
    {
      "id": 1,
      "player_id": "P001",
      "player_name": "John Doe",
      "season_id": "SSPSLS15",
      "award_category": "individual",
      "award_type": "Golden Boot",
      "award_position": "Winner",
      "player_category": null,
      "performance_stats": { "goals": 25 },
      "awarded_by": "system",
      "notes": "Auto-awarded based on goals scored",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### POST /api/player-awards/add
Manually add a player award.

**Request Body:**
```json
{
  "player_id": "P001",
  "player_name": "John Doe",
  "season_id": "SSPSLS15",
  "award_category": "individual",
  "award_type": "Golden Boot",
  "award_position": "Winner",
  "player_category": null,
  "notes": "Optional notes"
}
```

**Response:**
```json
{
  "success": true,
  "award": { /* award object */ },
  "message": "Player award added successfully"
}
```

### DELETE /api/player-awards/[id]
Delete a player award.

**Response:**
```json
{
  "success": true,
  "message": "Player award deleted successfully"
}
```

### POST /api/player-awards/auto-award
Auto-award all player awards based on season statistics.

**Request Body:**
```json
{
  "season_id": "SSPSLS15"
}
```

**Response:**
```json
{
  "success": true,
  "awardsGiven": 21,
  "awards": [
    {
      "player_id": "P001",
      "player_name": "John Doe",
      "award_category": "individual",
      "award_type": "Golden Boot",
      "award_position": "Winner",
      "player_category": null
    }
  ],
  "message": "Successfully awarded 21 player awards"
}
```

## Auto-Award Logic

### Individual Awards

#### Golden Boot (Top 3 Goal Scorers)
```sql
SELECT player_id, player_name, goals_scored
FROM realplayerstats
WHERE season_id = ?
ORDER BY goals_scored DESC, assists DESC
LIMIT 3
```

#### Most Assists (Top 3 Assist Providers)
```sql
SELECT player_id, player_name, assists
FROM realplayerstats
WHERE season_id = ?
ORDER BY assists DESC, goals_scored DESC
LIMIT 3
```

#### Most Clean Sheets (Top 3 Goalkeepers)
```sql
SELECT player_id, player_name, clean_sheets
FROM realplayerstats
WHERE season_id = ? AND category = 'Goalkeeper'
ORDER BY clean_sheets DESC, saves DESC
LIMIT 3
```

### Category Awards

#### Best Attacker/Midfielder
```sql
SELECT player_id, player_name
FROM realplayerstats
WHERE season_id = ? AND category = ?
ORDER BY goals_scored DESC, assists DESC
LIMIT 3
```

#### Best Defender/Goalkeeper
```sql
SELECT player_id, player_name
FROM realplayerstats
WHERE season_id = ? AND category = ?
ORDER BY clean_sheets DESC, goals_scored DESC
LIMIT 3
```

## Awards Count Integration

The system automatically updates `player_season.awards_count` when awards are added or removed:

### On Award Add:
```sql
UPDATE player_season
SET awards_count = COALESCE(awards_count, 0) + 1
WHERE player_id = ? AND season_id = ?
```

### On Award Delete:
```sql
UPDATE player_season
SET awards_count = GREATEST(COALESCE(awards_count, 0) - 1, 0)
WHERE player_id = ? AND season_id = ?
```

## Usage Examples

### Auto-Award All Player Awards
```typescript
const response = await fetch('/api/player-awards/auto-award', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ season_id: 'SSPSLS15' })
});

const data = await response.json();
console.log(`Awarded ${data.awardsGiven} player awards`);
```

### Manually Add Individual Award
```typescript
const response = await fetch('/api/player-awards/add', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    player_id: 'P001',
    player_name: 'John Doe',
    season_id: 'SSPSLS15',
    award_category: 'individual',
    award_type: 'Player of the Season',
    award_position: 'Winner',
    player_category: null
  })
});
```

### Manually Add Category Award
```typescript
const response = await fetch('/api/player-awards/add', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    player_id: 'P001',
    player_name: 'John Doe',
    season_id: 'SSPSLS15',
    award_category: 'category',
    award_type: 'Best Attacker',
    award_position: 'Winner',
    player_category: 'Attacker'
  })
});
```

### List All Awards for a Season
```typescript
const response = await fetch('/api/player-awards?season_id=SSPSLS15');
const data = await response.json();
console.log(data.awards);
```

### List Player's Awards
```typescript
const response = await fetch('/api/player-awards?player_id=P001&season_id=SSPSLS15');
const data = await response.json();
console.log(data.awards);
```

## Benefits

1. **Proper Separation**: Award name and position stored separately like team_trophies
2. **Flexible Structure**: Supports both individual and category awards
3. **Auto-Award System**: Automatically awards based on statistics
4. **Awards Counting**: Automatically updates player_season.awards_count
5. **Query Optimization**: Proper indexes for fast lookups
6. **Data Integrity**: Unique constraints prevent duplicate awards
7. **Audit Trail**: Tracks who awarded (system vs manual) and when

## Next Steps

1. Create UI for committee to manage player awards
2. Add preview endpoint to show what would be awarded before auto-awarding
3. Add bulk delete functionality
4. Create player profile integration to display awards
5. Add award icons/badges for display

## Migration

To set up the player_awards system:

```bash
# Create the table
python scripts/create_player_awards_table.py
```

The table includes:
- 13 columns with proper types
- Unique constraint on (player_id, season_id, award_category, award_type, award_position)
- 6 indexes for performance
- Proper documentation via column comments
