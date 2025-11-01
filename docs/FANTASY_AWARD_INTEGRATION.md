# Fantasy Award Points Integration

## Overview

The fantasy league system now **automatically awards points** to fantasy teams when real players receive awards from the committee. This integration ensures that committee-created scoring rules for player awards are respected and fantasy points are granted automatically.

## How It Works

### 1. Award Types and Scoring Rules

Committees can create fantasy scoring rules for various award types:

- **Individual Awards**: Golden Boot, Most Assists, Most Clean Sheets, etc.
- **Category Awards**: Best Attacker, Best Midfielder, Best Defender, Best Goalkeeper
- **Match-Specific Awards**: Man of the Match (MOTM), Player of the Day, etc.

### 2. Automatic Point Assignment

When a player receives an award (either manually or automatically):

1. The system checks if a fantasy league exists for the season
2. It looks for a matching fantasy scoring rule for the award type
3. If found, it awards the configured points to **all fantasy teams** that drafted that player
4. Points are recorded in `fantasy_player_points` and the team's `total_points` is updated

### 3. Award Type Mapping

Award types are mapped to fantasy rule types with normalization:

```typescript
'Man of the Match' → 'motm'
'Golden Boot' → 'golden_boot'
'Best Attacker' → 'best_attacker'
'Player of the Day' → 'player_of_day'
// etc.
```

## Integration Points

### Manual Awards

**API**: `/api/player-awards/add`

When committee members manually add a player award:
```json
{
  "player_id": "123",
  "player_name": "John Doe",
  "season_id": "season-1",
  "award_category": "individual",
  "award_type": "Golden Boot",
  "award_position": "Winner"
}
```

Response includes fantasy points info:
```json
{
  "success": true,
  "award": {...},
  "message": "Player award added successfully",
  "fantasy_points": {
    "success": true,
    "points": 10,
    "message": "Added 10 points to 3 fantasy team(s)"
  }
}
```

### Auto-Awards

**API**: `/api/player-awards/auto-award`

When the system auto-awards based on season statistics:
```json
{
  "season_id": "season-1"
}
```

The system will:
- Award Golden Boot (top 3 scorers)
- Award Most Assists (top 3)
- Award Most Clean Sheets (top 3 goalkeepers)
- Award Best Attacker, Midfielder, Defender, Goalkeeper (top 3 per category)

Fantasy points are **automatically added** for each award if matching scoring rules exist.

## Database Schema

### fantasy_player_points

Records are created for each fantasy team that owns the awarded player:

```sql
CREATE TABLE fantasy_player_points (
  id UUID PRIMARY KEY,
  team_id UUID REFERENCES fantasy_teams(team_id),
  real_player_id TEXT,
  player_name TEXT,
  league_id UUID REFERENCES fantasy_leagues(league_id),
  fixture_id TEXT,              -- NULL for season-wide awards
  round_number INTEGER,          -- NULL for season-wide awards
  award_type TEXT,               -- e.g. "Golden Boot"
  award_points INTEGER,          -- Points from this award
  total_points INTEGER,          -- Total points for this record
  created_at TIMESTAMPTZ
);
```

## Committee Configuration

### Creating Award-Based Scoring Rules

1. Navigate to Fantasy League → Scoring Rules
2. Add a new rule with `rule_type` matching the award name
3. Example rule types:
   - `golden_boot` - Golden Boot award
   - `best_attacker` - Best Attacker award
   - `most_assists` - Most Assists award
   - `motm` - Man of the Match
   - `player_of_day` - Player of the Day

### Points Configuration

```typescript
// Example scoring rule creation
{
  "league_id": "league-uuid",
  "rule_type": "golden_boot",
  "points_value": 50,  // 50 points for Golden Boot winner
  "description": "Golden Boot Award",
  "is_active": true
}
```

## Example Workflow

### Scenario: Golden Boot Award

1. **Season Ends** - Committee runs auto-awards
2. **Player Awarded** - "John Doe" receives Golden Boot (Winner)
3. **Fantasy Check** - System finds `golden_boot` scoring rule (50 points)
4. **Teams Check** - 3 fantasy teams have John Doe on their roster
5. **Points Added**:
   - Team A: +50 points
   - Team B: +50 points
   - Team C: +50 points
6. **Records Created** - 3 entries in `fantasy_player_points`
7. **Leaderboard Updated** - Team standings reflect new points

## Testing the Integration

### Manual Test

1. Create a fantasy league for a season
2. Add a scoring rule: `golden_boot` = 100 points
3. Draft players to fantasy teams
4. Manually award Golden Boot to a drafted player
5. Verify fantasy teams received 100 points

### Auto-Award Test

1. Ensure player stats exist for the season
2. Create fantasy scoring rules for awards
3. Run auto-awards: `POST /api/player-awards/auto-award`
4. Check fantasy team points increased correctly

## Error Handling

The system gracefully handles:
- **No Fantasy League**: Logs message, no error
- **No Scoring Rule**: Logs message, award still recorded
- **Player Not Drafted**: Award recorded, no points given
- **Duplicate Awards**: Prevents double-counting with conflict checks

## Logging

Check server logs for integration details:
```
🏆 Adding 50 fantasy points for John Doe's "Golden Boot" award to 3 team(s)
Fantasy points result: { success: true, points: 50, message: "..." }
```

## Future Enhancements

Potential improvements:
- Award position-based points (Winner=50, Runner-up=30, Third=20)
- Award history and audit trail
- Fantasy points breakdown UI
- Award notification system
- Retroactive point calculation

## Files Modified

- `lib/fantasy-award-points.ts` - Core integration logic
- `app/api/player-awards/add/route.ts` - Manual award integration
- `lib/award-player-awards.ts` - Auto-award integration

## Notes

- MOTM awards from fixtures use a different flow (calculated per-fixture)
- Season-wide awards have no `fixture_id` in `fantasy_player_points`
- Committee members should configure scoring rules **before** the season starts
- Points are idempotent - duplicate awards won't double-count points
