# Knockout Formats - Three Types Implementation

## Overview
Knockout fixtures now support three different formats for how matchups are created and played.

## Three Knockout Formats

### 1. Single Leg Format (`single_leg`)
**Description**: One fixture with 5 matchups (player 1 vs 1, 2 vs 2, etc.)

**Characteristics**:
- 1 fixture per tie
- 5 matchups total
- Can use `blind_lineup` (auto-created from lineup order) or `manual` (admin creates)
- Winner determined by who wins more matchups (best of 5)

**Use Case**: Quick knockout rounds, finals

**Example**:
```
Home Team vs Away Team
- Player 1 vs Player 1
- Player 2 vs Player 2
- Player 3 vs Player 3
- Player 4 vs Player 4
- Player 5 vs Player 5
```

---

### 2. Two-Legged Format (`two_leg`)
**Description**: Home and away fixtures (2 fixtures per tie)

**Characteristics**:
- 2 fixtures per tie (home + away)
- Each fixture has its own matchups (5 matchups each)
- Can use `blind_lineup` or `manual` for matchup creation
- Aggregate score determines winner
- Home/away teams swap for second leg

**Use Case**: Traditional knockout format with home advantage

**Example**:
```
Leg 1 (Home):
Team A (home) vs Team B (away)
- 5 matchups

Leg 2 (Away):
Team B (home) vs Team A (away)
- 5 matchups

Winner: Best aggregate score across both legs
```

---

### 3. Round Robin Format (`round_robin`)
**Description**: All players from one team play all players from the other team

**Characteristics**:
- 1 fixture per tie
- 25 matchups total (5 × 5)
- Each home player plays against each away player
- Winner determined by total wins
- Most comprehensive format

**Use Case**: Finals, important matches where you want maximum competition

**Example**:
```
Home Team (5 players) vs Away Team (5 players)

Home Player 1 vs Away Player 1
Home Player 1 vs Away Player 2
Home Player 1 vs Away Player 3
Home Player 1 vs Away Player 4
Home Player 1 vs Away Player 5

Home Player 2 vs Away Player 1
Home Player 2 vs Away Player 2
... (continues for all combinations)

Total: 25 matchups
Winner: Team with most matchup wins
```

---

## Database Schema

### Migration
File: `migrations/add_knockout_format_to_fixtures.sql`

Adds `knockout_format` column to `fixtures` table:
```sql
ALTER TABLE fixtures 
ADD COLUMN knockout_format VARCHAR(20) DEFAULT 'single_leg';
```

**Possible Values**:
- `'single_leg'` - Default, 5 matchups
- `'two_leg'` - Home + away fixtures
- `'round_robin'` - 25 matchups (all vs all)

---

## API Changes

### Generate Knockout Endpoint
**Endpoint**: `POST /api/tournaments/{id}/generate-knockout`

**New Request Parameter**:
```json
{
  "pairing_method": "standard",
  "start_date": "2026-01-24",
  "matchup_mode": "manual",
  "is_two_legged": false,
  "knockout_format": "round_robin"  // NEW PARAMETER
}
```

**knockout_format Options**:
- `"single_leg"` - Creates 1 fixture with 5 matchups
- `"two_leg"` - Creates 2 fixtures (home + away)
- `"round_robin"` - Creates 1 fixture with 25 matchups

**Response**:
```json
{
  "success": true,
  "message": "Generated 4 knockout fixtures",
  "knockout_structure": {
    "total_qualifiers": 8,
    "rounds": ["quarter_final", "semi_final", "final"],
    "first_round": "quarter_final",
    "fixtures_created": 4
  },
  "fixtures": [
    {
      "id": "SSPSLS16CH_KO_quarter_final_m1",
      "round": "quarter_final",
      "match_number": 1,
      "leg": 1,
      "knockout_format": "round_robin",
      "home_team": "Team A",
      "away_team": "Team B",
      "scheduled_date": "2026-01-24",
      "matchup_mode": "manual"
    }
  ]
}
```

---

## Frontend UI

### Location
`app/dashboard/committee/team-management/tournament/page.tsx`

### New State Variable
```typescript
const [knockoutFormat, setKnockoutFormat] = useState<'single_leg' | 'two_leg' | 'round_robin'>('single_leg');
```

### UI Control
Three-button selector in Fixtures tab:

```
┌─────────────────┬─────────────────┬─────────────────┐
│  Single Leg     │   Two Legs      │  Round Robin    │
│  5 matchups     │  Home + Away    │  25 matchups    │
│  (1v1, 2v2...)  │  fixtures       │  (all vs all)   │
└─────────────────┴─────────────────┴─────────────────┘
```

---

## Business Rules

### 1. Finals Always Single Leg
Regardless of the `knockout_format` setting, **finals are always forced to single leg format**.

```typescript
if (isFinalRound) {
  actualKnockoutFormat = 'single_leg';
  legsToCreate = 1;
}
```

**Reason**: Finals should be decisive, single matches.

### 2. Format Compatibility

| Format | Matchup Mode | Legs | Matchups |
|--------|-------------|------|----------|
| single_leg | manual or blind_lineup | 1 | 5 |
| two_leg | manual or blind_lineup | 2 | 5 per leg |
| round_robin | manual only | 1 | 25 |

**Note**: Round robin format typically uses manual matchup creation since all 25 matchups are created at once.

### 3. Backward Compatibility
- Existing fixtures without `knockout_format` default to `'single_leg'`
- `is_two_legged` parameter still works (maps to `two_leg` format)

---

## Implementation Details

### Fixture Creation Logic

```typescript
// Determine format
let actualKnockoutFormat = knockout_format;

if (isFinalRound) {
  // Finals always single leg
  actualKnockoutFormat = 'single_leg';
  legsToCreate = 1;
} else if (knockout_format === 'two_leg') {
  actualKnockoutFormat = 'two_leg';
  legsToCreate = 2;
} else if (knockout_format === 'round_robin') {
  actualKnockoutFormat = 'round_robin';
  legsToCreate = 1;
} else {
  actualKnockoutFormat = 'single_leg';
  legsToCreate = 1;
}
```

### Matchup Creation

**Single Leg & Two Leg**: 5 matchups per fixture
- Created manually by admin OR
- Auto-created from blind lineup submission

**Round Robin**: 25 matchups per fixture
- All combinations of home players vs away players
- Typically created manually by admin
- Can be auto-generated with a script

---

## Testing Scenarios

### Scenario 1: Single Leg with Blind Lineup
1. Set `knockout_format: 'single_leg'`
2. Set `matchup_mode: 'blind_lineup'`
3. Generate knockout fixtures
4. Teams submit lineups
5. **Expected**: 5 matchups auto-created (1v1, 2v2, etc.)

### Scenario 2: Two-Legged Knockout
1. Set `knockout_format: 'two_leg'`
2. Set `matchup_mode: 'manual'`
3. Generate knockout fixtures
4. **Expected**: 2 fixtures created (home + away)
5. Admin creates matchups for each fixture

### Scenario 3: Round Robin Final
1. Set `knockout_format: 'round_robin'`
2. Generate knockout for final round
3. **Expected**: 1 fixture with 25 matchup slots
4. Admin creates all 25 matchups (each player vs each player)

### Scenario 4: Finals Override
1. Set `knockout_format: 'two_leg'` for semi-finals
2. Generate knockout including finals
3. **Expected**: 
   - Semi-finals: 2 legs each
   - Final: 1 leg only (forced override)

---

## Files Modified

1. **Migration**: `migrations/add_knockout_format_to_fixtures.sql`
   - Adds `knockout_format` column

2. **API**: `app/api/tournaments/[id]/generate-knockout/route.ts`
   - Accepts `knockout_format` parameter
   - Implements format logic
   - Forces finals to single leg

3. **Frontend**: `app/dashboard/committee/team-management/tournament/page.tsx`
   - Adds `knockoutFormat` state
   - Adds UI selector (3 buttons)
   - Passes format to API

---

## Future Enhancements

1. **Auto-create Round Robin Matchups**: Script to automatically generate all 25 matchups
2. **Format-specific Scoring**: Different point systems for different formats
3. **Mixed Formats**: Different formats for different knockout rounds
4. **Custom Matchup Counts**: Allow 3v3 or 7v7 instead of fixed 5v5

---

## Summary

✅ Three knockout formats implemented
✅ UI selector added to tournament management
✅ API updated to handle all formats
✅ Finals always forced to single leg
✅ Backward compatible with existing fixtures
✅ Database migration included
