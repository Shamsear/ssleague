# API Routes Documentation

## Overview

All API routes are organized by database:
- `/api/auction/*` - Uses Neon DB1 (Auction)
- `/api/tournament/*` - Uses Neon DB2 (Tournament)
- `/api/stats/*` - Uses Neon DB2 (Tournament)

---

## Auction API Routes

### 1. Football Players

**GET** `/api/auction/footballplayers`

Fetch players for auction from auction database.

**Query Parameters:**
- `seasonId` - Filter by season
- `isAuctionEligible` - Filter by auction eligibility (true/false)
- `isSold` - Filter by sold status (true/false)
- `position` - Filter by position (GK, DEF, MID, FWD)
- `positionGroup` - Filter by position group

**Example:**
```bash
GET /api/auction/footballplayers?seasonId=season1&isSold=false
```

**Response:**
```json
{
  "success": true,
  "data": [...],
  "count": 150
}
```

---

### 2. Auction Rounds

**GET** `/api/auction/rounds`

Fetch auction rounds.

**Query Parameters:**
- `seasonId` - Filter by season
- `status` - Filter by status (active, completed, pending)

**POST** `/api/auction/rounds`

Create a new auction round.

**Body:**
```json
{
  "season_id": "season1",
  "position": "FWD",
  "round_number": 1,
  "max_bids_per_team": 5,
  "base_price": 10,
  "duration_seconds": 300,
  "status": "active"
}
```

---

### 3. Bids

**GET** `/api/auction/bids`

Fetch bids.

**Query Parameters:**
- `roundId` - Filter by round
- `teamId` - Filter by team
- `playerId` - Filter by player

**POST** `/api/auction/bids`

Place a new bid.

**Body:**
```json
{
  "team_id": "team1",
  "player_id": "player1",
  "round_id": "round_uuid",
  "amount": 50,
  "status": "active"
}
```

---

## Tournament API Routes

### 4. Fixtures

**GET** `/api/tournament/fixtures`

Fetch match fixtures.

**Query Parameters:**
- `seasonId` - Filter by season (required for most queries)
- `status` - Filter by status (scheduled, live, completed)
- `roundNumber` - Filter by round number
- `teamId` - Filter by team

**Example:**
```bash
GET /api/tournament/fixtures?seasonId=season1&status=scheduled
```

**POST** `/api/tournament/fixtures`

Create a new fixture.

**Body:**
```json
{
  "season_id": "season1",
  "round_number": 1,
  "home_team_id": "team1",
  "away_team_id": "team2",
  "home_team_name": "Team A",
  "away_team_name": "Team B",
  "scheduled_date": "2025-10-25T19:00:00Z",
  "status": "scheduled"
}
```

---

### 5. Matches

**GET** `/api/tournament/matches`

Fetch match results.

**Query Parameters:**
- `seasonId` - Filter by season
- `fixtureId` - Get match for specific fixture
- `teamId` - Filter by team

**POST** `/api/tournament/matches`

Create or update match result.

**Body:**
```json
{
  "fixture_id": "fixture1",
  "season_id": "season1",
  "home_team_id": "team1",
  "away_team_id": "team2",
  "home_score": 3,
  "away_score": 1,
  "winner_id": "team1",
  "match_date": "2025-10-25T21:00:00Z"
}
```

---

## Stats API Routes

### 6. Player Stats

**GET** `/api/stats/players`

Fetch player statistics.

**Query Parameters:**
- `seasonId` - Season (required)
- `playerId` - Specific player
- `teamId` - Filter by team
- `category` - Filter by category (Legend/Classic)
- `sortBy` - Sort field (points, goals_scored, assists, motm_awards)
- `limit` - Number of results (default: 100)

**Example:**
```bash
GET /api/stats/players?seasonId=season1&sortBy=goals_scored&limit=10
```

**POST** `/api/stats/players`

Update player statistics.

**Body:**
```json
{
  "player_id": "player1",
  "season_id": "season1",
  "player_name": "John Doe",
  "team": "Team A",
  "team_id": "team1",
  "category": "Legend",
  "matches_played": 10,
  "goals_scored": 15,
  "assists": 8,
  "wins": 7,
  "draws": 2,
  "losses": 1,
  "points": 145.5,
  "star_rating": 5
}
```

---

### 7. Team Stats

**GET** `/api/stats/teams`

Fetch team statistics.

**Query Parameters:**
- `seasonId` - Season (required)
- `teamId` - Specific team

**POST** `/api/stats/teams`

Update team statistics.

**Body:**
```json
{
  "team_id": "team1",
  "season_id": "season1",
  "team_name": "Team A",
  "matches_played": 10,
  "wins": 7,
  "draws": 2,
  "losses": 1,
  "goals_for": 25,
  "goals_against": 10,
  "goal_difference": 15,
  "points": 23,
  "position": 1
}
```

---

### 8. Leaderboard

**GET** `/api/stats/leaderboard`

Fetch leaderboard (cached for 5 minutes).

**Query Parameters:**
- `seasonId` - Season (required)
- `type` - 'player' or 'team' (default: player)
- `category` - Player category (for player leaderboards)

**Example:**
```bash
GET /api/stats/leaderboard?seasonId=season1&type=player&category=Legend
```

**Response:**
```json
{
  "success": true,
  "data": [...],
  "cached": true,
  "updated_at": "2025-10-23T10:00:00Z"
}
```

---

## Usage in Frontend

### React Query Example

```typescript
import { useQuery } from '@tanstack/react-query';

// Fetch player stats
const { data: playerStats } = useQuery({
  queryKey: ['player-stats', seasonId],
  queryFn: () => 
    fetch(`/api/stats/players?seasonId=${seasonId}&sortBy=points&limit=50`)
      .then(res => res.json()),
  staleTime: 2 * 60 * 1000, // 2 minutes cache
});

// Fetch fixtures
const { data: fixtures } = useQuery({
  queryKey: ['fixtures', seasonId],
  queryFn: () => 
    fetch(`/api/tournament/fixtures?seasonId=${seasonId}`)
      .then(res => res.json()),
  staleTime: 5 * 60 * 1000, // 5 minutes cache
});

// Fetch auction players
const { data: players } = useQuery({
  queryKey: ['auction-players', seasonId],
  queryFn: () => 
    fetch(`/api/auction/footballplayers?seasonId=${seasonId}&isSold=false`)
      .then(res => res.json()),
  staleTime: 3 * 60 * 1000, // 3 minutes cache
});
```

### Mutation Example

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';

// Update player stats
const updateStatsMutation = useMutation({
  mutationFn: (statsData) => 
    fetch('/api/stats/players', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(statsData)
    }).then(res => res.json()),
  onSuccess: () => {
    // Invalidate and refetch
    queryClient.invalidateQueries({ queryKey: ['player-stats'] });
    queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
  }
});

// Usage
updateStatsMutation.mutate({
  player_id: 'player1',
  season_id: 'season1',
  goals_scored: 10,
  // ... other fields
});
```

---

## Error Handling

All routes return consistent error format:

```json
{
  "success": false,
  "error": "Error message here"
}
```

**HTTP Status Codes:**
- `200` - Success
- `400` - Bad Request (missing parameters)
- `500` - Server Error

---

## Performance Notes

### Caching Strategy

1. **Player Stats**: 2-3 min cache (updates after matches)
2. **Team Stats**: 2-3 min cache (updates after matches)
3. **Fixtures**: 5-10 min cache (rarely changes)
4. **Auction Players**: 3-5 min cache (updates during auctions)
5. **Leaderboard**: 5 min cache (auto-refreshes)

### Database Reads

- **Auction DB**: Unlimited reads (Neon)
- **Tournament DB**: Unlimited reads (Neon)
- **Firebase**: Only for auth & master data lookups

### Optimization Tips

1. Always use `seasonId` to filter queries
2. Use `limit` parameter to reduce result sets
3. Leverage React Query caching
4. Use leaderboard API (pre-cached) instead of direct stats queries for rankings
5. Invalidate caches after mutations

---

## Testing

Test all routes with:
```bash
npm run dev
```

Then use:
- Browser: Visit http://localhost:3000/api/stats/players?seasonId=test
- cURL: `curl http://localhost:3000/api/stats/players?seasonId=test`
- Postman/Thunder Client: Import and test

---

## Next Steps

1. ✅ API routes created
2. ⏳ Update frontend to use these APIs
3. ⏳ Add authentication middleware
4. ⏳ Add rate limiting
5. ⏳ Add request validation with Zod
6. ⏳ Add API documentation with Swagger/OpenAPI
