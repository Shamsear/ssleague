# Starred Players Feature

## Overview
The starred players feature allows each team to maintain their own list of favorite/bookmarked players. Each team can independently star and unstar players, with the starred status being specific to that team.

## Database Schema

### Table: `starred_players`
This is a junction table that creates a many-to-many relationship between teams and players.

```sql
CREATE TABLE starred_players (
  id SERIAL PRIMARY KEY,
  team_id VARCHAR(255) NOT NULL,          -- Firebase Auth UID of the team
  player_id VARCHAR(255) NOT NULL REFERENCES footballplayers(id) ON DELETE CASCADE,
  starred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(team_id, player_id)              -- Prevents duplicate starring
);
```

**Note**: `player_id` is `VARCHAR(255)` to match the data type of `footballplayers.id`.

### Indexes
- `idx_starred_players_team_id` - Fast lookup by team
- `idx_starred_players_player_id` - Fast lookup by player
- `idx_starred_players_team_player` - Composite index for checking if a specific team starred a player

### Key Features
1. **Team-Specific**: Each team has their own independent starred list
2. **Unique Constraint**: A team can only star a player once
3. **Cascade Delete**: If a player is deleted, all starred references are automatically removed
4. **Timestamp**: Tracks when each player was starred

## API Endpoints

### 1. Star a Player
**Endpoint**: `POST /api/players/star/[id]`

**Authentication**: Required (session cookie)

**Description**: Stars a player for the authenticated team

**Response**:
```json
{
  "success": true,
  "message": "Player starred successfully"
}
```

### 2. Unstar a Player
**Endpoint**: `POST /api/players/unstar/[id]`

**Authentication**: Required (session cookie)

**Description**: Unstars a player for the authenticated team

**Response**:
```json
{
  "success": true,
  "message": "Player unstarred successfully"
}
```

### 3. Get All Players (with starred status)
**Endpoint**: `GET /api/players/database?page=1&limit=100`

**Authentication**: Optional (starred status only shown if authenticated)

**Description**: Returns all players with `is_starred` field indicating if the current team has starred each player

**Response**:
```json
{
  "success": true,
  "data": {
    "players": [
      {
        "id": 1,
        "name": "Player Name",
        "position": "QB",
        "overall_rating": 85,
        "is_starred": true,
        ...
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 100,
      "total": 500,
      "totalPages": 5
    }
  }
}
```

### 4. Get Starred Players Only
**Endpoint**: `GET /api/players/starred`

**Authentication**: Required (session cookie)

**Description**: Returns only the players starred by the authenticated team

**Response**:
```json
{
  "success": true,
  "data": {
    "players": [
      {
        "id": 1,
        "name": "Player Name",
        "position": "QB",
        "overall_rating": 85,
        "is_starred": true,
        "starred_at": "2025-10-04T09:30:00Z",
        ...
      }
    ],
    "count": 15
  }
}
```

## Frontend Usage

### In Team Statistics Page

The player database page (`app/dashboard/team/statistics/page.tsx`) automatically shows the starred status for each player based on the authenticated team.

**Star/Unstar Toggle**:
```typescript
const toggleStarPlayer = async (playerId: number, event: React.MouseEvent) => {
  event.stopPropagation();
  
  const player = players.find(p => p.id === playerId);
  if (!player) return;

  const endpoint = player.is_starred 
    ? `/api/players/unstar/${playerId}` 
    : `/api/players/star/${playerId}`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (response.ok) {
      // Update local state
      setPlayers(prevPlayers =>
        prevPlayers.map(p =>
          p.id === playerId ? { ...p, is_starred: !p.is_starred } : p
        )
      );
    }
  } catch (err) {
    console.error('Error toggling star:', err);
  }
};
```

### Filter Starred Players
```typescript
const [showStarredOnly, setShowStarredOnly] = useState(false);

// In useEffect for filtering
useEffect(() => {
  let filtered = [...players];
  
  if (showStarredOnly) {
    filtered = filtered.filter(player => player.is_starred);
  }
  
  setFilteredPlayers(filtered);
}, [players, showStarredOnly]);
```

## Migration Steps

### 1. Run SQL Migration
Execute the migration script to create the `starred_players` table:

```bash
# Connect to your Neon database
psql "postgresql://[connection-string]"

# Run the migration
\i migrations/create_starred_players_table.sql
```

Or use Neon's SQL Editor in the dashboard to run the migration.

### 2. (Optional) Migrate Existing Data
If you have existing `is_starred` data in the `footballplayers` table, you can migrate it:

```sql
-- Migrate existing starred data (if needed)
-- This assumes all starred players belong to a specific team
INSERT INTO starred_players (team_id, player_id)
SELECT '[TEAM_ID_HERE]', id
FROM footballplayers
WHERE is_starred = true
ON CONFLICT (team_id, player_id) DO NOTHING;
```

### 3. Remove Old Column (Optional)
After confirming everything works, you can remove the old `is_starred` column:

```sql
ALTER TABLE footballplayers DROP COLUMN IF EXISTS is_starred;
```

## Benefits of This Approach

1. **Multi-Tenant**: Each team has independent starred lists
2. **Scalable**: Efficient queries with proper indexes
3. **Data Integrity**: Foreign key constraints ensure referential integrity
4. **Automatic Cleanup**: Cascade delete removes orphaned records
5. **Flexible**: Easy to add more features like:
   - Star count per player
   - Most starred players leaderboard
   - Collaborative team favorites

## Example Use Cases

1. **Watchlist**: Teams can star players they're interested in bidding on
2. **Favorites**: Mark frequently viewed players for quick access
3. **Strategy Planning**: Bookmark players for different tactical approaches
4. **Scouting**: Keep track of players to research further

## Testing Checklist

- [ ] Can star a player as Team A
- [ ] Can unstar a player as Team A
- [ ] Team A's starred players are independent from Team B
- [ ] Starred status persists after page reload
- [ ] Filter by starred players works correctly
- [ ] Cannot star the same player twice (handled by UNIQUE constraint)
- [ ] Starred player count updates correctly
- [ ] API returns 401 for unauthenticated requests
- [ ] Deleting a player removes all starred references

## Database Queries for Analysis

### Count starred players per team
```sql
SELECT team_id, COUNT(*) as starred_count
FROM starred_players
GROUP BY team_id
ORDER BY starred_count DESC;
```

### Most starred players overall
```sql
SELECT 
  fp.name,
  fp.position,
  COUNT(sp.id) as star_count
FROM footballplayers fp
LEFT JOIN starred_players sp ON fp.id = sp.player_id
GROUP BY fp.id, fp.name, fp.position
ORDER BY star_count DESC
LIMIT 10;
```

### Get all starred players for a specific team
```sql
SELECT fp.*, sp.starred_at
FROM starred_players sp
JOIN footballplayers fp ON sp.player_id = fp.id
WHERE sp.team_id = 'team_uid_here'
ORDER BY sp.starred_at DESC;
```

## Future Enhancements

1. **Starred Limit**: Limit the number of players a team can star
2. **Categories**: Allow teams to categorize starred players (e.g., "Target", "Backup", "Watch")
3. **Notes**: Add notes to starred players
4. **Share Lists**: Allow teams to share their starred lists with other teams
5. **Notifications**: Notify teams when their starred players are available in auction
6. **Analytics**: Show insights about starred vs acquired players

## Files Modified/Created

### Created
- `migrations/create_starred_players_table.sql` - Database migration
- `app/api/players/starred/route.ts` - Get starred players endpoint
- `docs/STARRED_PLAYERS_FEATURE.md` - This documentation

### Modified
- `app/api/players/star/[id]/route.ts` - Updated to use new table with auth
- `app/api/players/unstar/[id]/route.ts` - Updated to use new table with auth
- `app/api/players/database/route.ts` - Added team-specific starred status

### Unchanged (already working)
- `app/dashboard/team/statistics/page.tsx` - Frontend already compatible
