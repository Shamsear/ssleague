# Team Seasons Collection Schema

## Overview
The `team_seasons` collection tracks which teams are participating in which seasons and maintains their season-specific statistics.

## Collection: `team_seasons`

### Document ID Format
`{team_id}_{season_id}`

Example: `abc123_season_2024`

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `team_id` | string | Reference to user UID (the team) |
| `season_id` | string | Reference to season document ID |
| `team_name` | string | Team's display name |
| `team_email` | string | Team's email address |
| `team_logo` | string | URL to team's logo image |
| `status` | string | Registration status: `registered` or `declined` |
| `budget` | number | Current remaining budget for the season |
| `starting_balance` | number | Initial budget at season start (e.g., 15000) |
| `total_spent` | number | Total amount spent on players |
| `players_count` | number | Total number of players acquired |
| `position_counts` | object | Breakdown of players by position |
| `joined_at` | timestamp | When team joined the season |
| `declined_at` | timestamp | When team declined the season (if applicable) |
| `created_at` | timestamp | Document creation time |
| `updated_at` | timestamp | Last update time |

### Position Counts Object

The `position_counts` field contains a count for each football position:

```typescript
{
  GK: 0,    // Goalkeeper
  CB: 0,    // Center Back
  LB: 0,    // Left Back
  RB: 0,    // Right Back
  DMF: 0,   // Defensive Midfielder
  CMF: 0,   // Central Midfielder
  AMF: 0,   // Attacking Midfielder
  LMF: 0,   // Left Midfielder
  RMF: 0,   // Right Midfielder
  LWF: 0,   // Left Wing Forward
  RWF: 0,   // Right Wing Forward
  SS: 0,    // Second Striker
  CF: 0     // Center Forward
}
```

## Example Document

```json
{
  "team_id": "abc123xyz789",
  "season_id": "season_2024_spring",
  "team_name": "Manchester Eagles",
  "team_email": "eagles@example.com",
  "team_logo": "https://example.com/logos/eagles.png",
  "status": "registered",
  "budget": 12500,
  "starting_balance": 15000,
  "total_spent": 2500,
  "players_count": 5,
  "position_counts": {
    "GK": 1,
    "CB": 2,
    "LB": 0,
    "RB": 1,
    "DMF": 0,
    "CMF": 1,
    "AMF": 0,
    "LMF": 0,
    "RMF": 0,
    "LWF": 0,
    "RWF": 0,
    "SS": 0,
    "CF": 0
  },
  "joined_at": "2024-01-15T10:30:00Z",
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-20T15:45:00Z"
}
```

## When to Update team_seasons

### On Season Registration
- Initialize `budget` with `starting_balance`
- Set `total_spent` to 0
- Set `players_count` to 0
- Initialize all `position_counts` to 0
- Set `status` to `registered`

### On Player Acquisition (Round Win)
When a team wins a player in an auction:

1. **Decrement budget**: `budget -= acquisition_price`
2. **Increment total_spent**: `total_spent += acquisition_price`
3. **Increment players_count**: `players_count += 1`
4. **Increment position count**: `position_counts[player.position] += 1`

Example:
```typescript
// When team wins a CF player for 500
await updateDoc(doc(db, 'team_seasons', teamSeasonId), {
  budget: increment(-500),
  total_spent: increment(500),
  players_count: increment(1),
  'position_counts.CF': increment(1),
  updated_at: serverTimestamp()
});
```

### On Player Release/Trade (Future Feature)
When a team releases a player:

1. **Increment budget** (if release gives refund)
2. **Decrement total_spent** (if applicable)
3. **Decrement players_count**: `players_count -= 1`
4. **Decrement position count**: `position_counts[player.position] -= 1`

## Related Collections

- **`seasons`**: Parent season information
- **`users`**: Team user account information
- **`players`**: Individual player assignments (links to team_id and season_id)
- **`rounds`**: Auction rounds where players are acquired
- **`bids`**: Team bids on players in rounds

## Firebase Security Rules

Teams can:
- ✅ Read all `team_seasons` documents (to view other teams)
- ✅ Create their own registration
- ✅ Update their own registration
- ❌ Delete registrations (only admins)

Admins can:
- ✅ Full CRUD access

## Notes

- This schema replaces the old cricket positions (batsman, bowler, etc.) with football positions
- The `budget` field should always equal `starting_balance - total_spent`
- The `players_count` should always equal the sum of all `position_counts` values
- When displaying team stats, read from `team_seasons` instead of recalculating from `players` collection
