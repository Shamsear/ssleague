# Knockout Fixture Settings - Implementation Complete

## Overview
You can now customize fixture settings when generating knockout fixtures, even if the group stage had different settings.

## Features Implemented

### 1. Matchup Mode Selection
- **Manual Mode**: Committee manually creates matchups for each fixture
- **Blind Lineup Mode**: Teams submit player order, matchups auto-created when phase ends
- Can be changed from group stage settings when creating knockout fixtures

### 2. Leg Configuration
- **Single Leg (1 leg)**: One match per tie
- **Two-Legged (2 legs)**: Home and away matches for each tie
- Can be changed from group stage settings when creating knockout fixtures
- **Finals are always forced to 1 leg** regardless of the 2-leg setting

### 3. How It Works

#### API Endpoint
`POST /api/tournaments/{id}/generate-knockout`

**Request Body:**
```json
{
  "pairing_method": "standard",
  "start_date": "2026-01-24",
  "matchup_mode": "manual",      // or "blind_lineup"
  "is_two_legged": false          // true for 2-legged ties
}
```

**Response:**
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
  "fixtures": [...]
}
```

#### Frontend UI
Located in: `app/dashboard/committee/team-management/tournament/page.tsx`

The existing UI controls for `matchupMode` and `isTwoLegged` are now used for both:
- Regular fixture generation
- Knockout fixture generation

### 4. Business Rules

1. **Finals Always 1 Leg**: The final is always created as a single-leg match, regardless of the `is_two_legged` setting
2. **Two-Legged Ties**: When enabled, creates both home and away fixtures with:
   - Leg 1: Original pairing
   - Leg 2: Reversed pairing (home becomes away, away becomes home)
   - 7-day gap between legs
3. **Matchup Mode**: Applied to all knockout fixtures created in that generation

### 5. Example Scenarios

#### Scenario 1: Group Stage with Blind Lineup → Knockout with Manual
- Group stage: `matchup_mode: "blind_lineup"`, `is_two_legged: true`
- Knockout: Can change to `matchup_mode: "manual"`, `is_two_legged: false`
- Result: Knockout fixtures use manual matchups with single legs

#### Scenario 2: Two-Legged Knockout with 1-Leg Final
- Settings: `is_two_legged: true`
- Quarter-finals: 2 legs each (4 fixtures total)
- Semi-finals: 2 legs each (2 fixtures total)
- Final: 1 leg only (1 fixture) - **automatically forced**

## Files Modified

1. **API**: `app/api/tournaments/[id]/generate-knockout/route.ts`
   - Added `matchup_mode` and `is_two_legged` parameters
   - Implemented 2-legged fixture creation logic
   - Added automatic 1-leg enforcement for finals

2. **Frontend**: `app/dashboard/committee/team-management/tournament/page.tsx`
   - Updated `handleGenerateKnockoutFixtures` to pass new parameters
   - Reuses existing UI controls for matchup mode and leg settings

## Testing

To test this feature:

1. Create a tournament with group stage
2. Assign teams and generate group fixtures
3. Complete group stage matches
4. Go to Fixtures tab
5. Select matchup mode (Manual or Blind Lineup)
6. Toggle "Two-Legged Matches" on/off
7. Click "Generate Knockout"
8. Verify:
   - Knockout fixtures use selected settings
   - If 2-legged is enabled, each tie has 2 fixtures (except final)
   - Final is always 1 leg

## Notes

- The UI controls are shared between regular fixture generation and knockout generation
- Settings can be different between group stage and knockout stage
- Finals are always 1 leg to ensure a decisive match
- Two-legged ties automatically swap home/away for the second leg
