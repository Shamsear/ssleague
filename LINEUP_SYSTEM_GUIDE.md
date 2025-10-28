# Lineup System - Complete Guide

## Overview
The Lineup System allows teams to submit lineups for fixtures with validation, deadline management, and substitution tracking.

## Key Features
- ✅ 5 starting players + 2 substitutes per lineup
- ✅ Minimum 2 classic category players required
- ✅ Automatic deadline locking (1 hour after round starts)
- ✅ In-match substitutions with full tracking
- ✅ Warning system for missing lineups
- ✅ Opponent penalty selection
- ✅ Participation-based stats tracking

---

## Database Tables

### `lineups`
Main table storing team lineups for each fixture.

```sql
- id (PK): lineup_{fixture_id}_{team_id}
- fixture_id (FK)
- team_id
- starting_xi: JSONB array of 5 player IDs
- substitutes: JSONB array of 2 player IDs
- classic_player_count: min 2 required
- is_locked: true after deadline
- warning_given: penalty tracking
- selected_by_opponent: if opponent selected lineup
```

### `lineup_substitutions`
Tracks all substitutions made during matches.

```sql
- lineup_id (FK)
- player_out: player substituted out
- player_in: player substituted in
- made_at: timestamp
- made_by: user who made the substitution
```

### `realplayerstats` (Modified)
Added columns for participation tracking.

```sql
- participation_type: 'started' | 'subbed_in' | 'subbed_out' | 'unused_sub'
- match_played: boolean (true only for started/subbed_in)
- lineup_id: reference to lineup used
```

---

## API Endpoints

### 1. Submit/Update Lineup
**POST** `/api/lineups`

Submit or update a team's lineup for a fixture.

**Request Body:**
```json
{
  "fixture_id": "fixture_123",
  "team_id": "team_456",
  "starting_xi": ["player1", "player2", "player3", "player4", "player5"],
  "substitutes": ["player6", "player7"],
  "submitted_by": "user_id",
  "submitted_by_name": "John Doe"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Lineup submitted successfully",
  "lineup_id": "lineup_fixture_123_team_456",
  "validation": {
    "isValid": true,
    "errors": [],
    "classicPlayerCount": 3
  }
}
```

**Validation Rules:**
- Exactly 5 starting players
- Exactly 2 substitutes
- No duplicate players
- All players must be registered for team/season
- Minimum 2 classic category players
- Deadline not passed

---

### 2. Get Lineup(s)
**GET** `/api/lineups?fixture_id={id}&team_id={id}`

Fetch lineup for a fixture.

**Query Params:**
- `fixture_id` (required)
- `team_id` (optional - omit to get both teams)

**Response:**
```json
{
  "success": true,
  "lineups": {
    "id": "lineup_fixture_123_team_456",
    "starting_xi": ["player1", "player2", "player3", "player4", "player5"],
    "substitutes": ["player6", "player7"],
    "is_locked": false,
    "classic_player_count": 3,
    "substitutions": [
      {
        "player_out": "player1",
        "player_in": "player6",
        "made_at": "2024-01-15T10:30:00Z"
      }
    ]
  }
}
```

---

### 3. Make Substitution
**POST** `/api/lineups/{lineup_id}/substitute`

Swap a starting player with a substitute during match.

**Request Body:**
```json
{
  "player_out": "player1",
  "player_out_name": "John Doe",
  "player_in": "player6",
  "player_in_name": "Jane Smith",
  "made_by": "user_id",
  "made_by_name": "Manager Name",
  "notes": "Tactical change"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Substitution completed successfully",
  "lineup": {
    "starting_xi": ["player6", "player2", "player3", "player4", "player5"],
    "substitutes": ["player1", "player7"]
  }
}
```

**Rules:**
- `player_out` must be in starting XI
- `player_in` must be in substitutes
- Lineup must not be locked

---

### 4. Lock Lineup
**POST** `/api/lineups/{lineup_id}/lock`

Manually lock a lineup (committee admin).

**Request Body:**
```json
{
  "locked_by": "admin_user_id",
  "locked_by_name": "Admin Name"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Lineup locked successfully"
}
```

---

### 5. Get Missing Lineups
**GET** `/api/lineups/missing?round_number={num}&season_id={id}`

Find teams that haven't submitted lineups for a round.

**Query Params:**
- `round_number` (required)
- `season_id` (required)

**Response:**
```json
{
  "success": true,
  "round_number": 3,
  "season_id": "SSPSLS16",
  "total_fixtures": 5,
  "missing_count": 2,
  "missing": [
    {
      "fixture_id": "fixture_123",
      "match_number": 1,
      "team_id": "team_456",
      "team_name": "Team A",
      "team_type": "home",
      "opponent_id": "team_789",
      "opponent_name": "Team B",
      "warning_given": false
    }
  ]
}
```

---

## Deadline Logic

### Timeline
```
Round Created
    ↓
Teams can submit/edit lineup
    ↓
Round Starts (scheduled_date)
    ↓
1-hour grace period (still editable)
    ↓
Deadline: Round Start + 1 Hour
    ↓
Lineups LOCKED 🔒
```

### Checking Editability
```typescript
import { isLineupEditable } from '@/lib/lineup-validation';

const check = await isLineupEditable(fixtureId);
if (check.editable) {
  // Allow editing
} else {
  // Show: check.reason
}
```

---

## Validation Utilities

### Validate Lineup
```typescript
import { validateLineup } from '@/lib/lineup-validation';

const result = await validateLineup(
  { starting_xi: [...], substitutes: [...] },
  seasonId,
  teamId
);

if (!result.isValid) {
  console.log(result.errors);
}
```

### Check Submission Status
```typescript
import { hasSubmittedLineup } from '@/lib/lineup-validation';

const submitted = await hasSubmittedLineup(fixtureId, teamId);
```

### Get Fixture Lineup Status
```typescript
import { getFixtureLineupStatus } from '@/lib/lineup-validation';

const status = await getFixtureLineupStatus(fixtureId);
console.log(status.homeTeam.hasLineup); // true/false
console.log(status.awayTeam.hasLineup); // true/false
```

---

## Stats Calculation

### Participation Types

| Type | Match Played? | Stats Counted? | Use Case |
|------|---------------|----------------|----------|
| `started` | ✅ Yes | ✅ Yes | Player in starting XI and finished match |
| `subbed_in` | ✅ Yes | ✅ Yes | Player came on as substitute |
| `subbed_out` | ❌ No | ❌ No | Player was substituted out |
| `unused_sub` | ❌ No | ❌ No | Player was on bench but didn't play |

### Example Logic
```typescript
// When calculating player stats
if (participation_type === 'subbed_out' || participation_type === 'unused_sub') {
  // Don't count any stats
  match_played = false;
  goals = 0;
  assists = 0;
} else if (participation_type === 'started' || participation_type === 'subbed_in') {
  // Count all stats
  match_played = true;
  // Record actual stats
}
```

---

## Warning & Penalty System

### First Offense
- Team doesn't submit lineup
- System sends **warning**
- Team gets grace period to submit

### Second Offense
- Team still hasn't submitted
- **Opponent gets to select lineup**
- Opponent must follow same rules (2 classic players)
- Selected lineup is marked: `selected_by_opponent = true`

### Implementation
```typescript
// Check if team has warning
if (!lineup && !warning_given) {
  // First offense: give warning
  await giveWarning(teamId, fixtureId);
} else if (!lineup && warning_given) {
  // Second offense: let opponent select
  await notifyOpponent(opponentTeamId, fixtureId);
}
```

---

## UI Flow

### Team User Flow
1. View upcoming fixtures
2. Click "Submit Lineup" for a match
3. Select 5 starting + 2 subs
4. System validates (2 classic minimum)
5. Save lineup (can edit until deadline)
6. After deadline: lineup locked
7. During match: can make substitutions

### Committee Admin Flow
1. View round management
2. See lineup submission status
3. Identify teams with missing lineups
4. Send warnings
5. Handle opponent selection (if needed)
6. Manually lock lineups if required

---

## Next Steps

### Pending Implementation
- [ ] UI components for lineup submission
- [ ] Team dashboard integration
- [ ] Substitution UI during match
- [ ] Committee monitoring dashboard
- [ ] Automatic lineup locking job
- [ ] Stats calculation integration
- [ ] Notification system

---

## Database Migration

Run the migration:
```bash
npx tsx scripts/run-lineup-migration.ts
```

Verify tables:
```bash
npx tsx scripts/verify-lineup-tables.ts
```

---

## Testing

### Test Lineup Submission
```bash
curl -X POST http://localhost:3000/api/lineups \
  -H "Content-Type: application/json" \
  -d '{
    "fixture_id": "test_fixture",
    "team_id": "test_team",
    "starting_xi": ["p1","p2","p3","p4","p5"],
    "substitutes": ["p6","p7"],
    "submitted_by": "user123"
  }'
```

### Test Substitution
```bash
curl -X POST http://localhost:3000/api/lineups/lineup_123/substitute \
  -H "Content-Type: application/json" \
  -d '{
    "player_out": "p1",
    "player_in": "p6",
    "made_by": "user123"
  }'
```

---

## Troubleshooting

### Common Issues

**"Lineup validation failed: Some players are not eligible"**
- Check players are registered in `player_seasons` table
- Verify `team_id` and `season_id` match

**"Lineup cannot be edited: Deadline has passed"**
- More than 1 hour has passed since round started
- Lineup is locked

**"Missing required fields"**
- Ensure all required fields in request body
- Check field names match exactly

---

## Support

For issues or questions, check:
- API logs in console
- Database constraints
- Validation error messages

**Created:** 2024-01-27  
**Last Updated:** 2024-01-27  
**Version:** 1.0
