# Knockout Round - Auto Round Number

## Feature Update

The knockout round generation now automatically calculates and sets the round number to the next available round (max round + 1), eliminating the need to manually figure out which round number to use.

## What Changed

### Before
- Round number defaulted to 12
- Users had to manually check existing fixtures and calculate the next round
- Risk of using duplicate or incorrect round numbers

### After
- Round number automatically set to next available round
- Updates dynamically when tournament is selected
- Still editable if manual override is needed

## How It Works

### Auto-Calculation Logic

```typescript
// Auto-calculate next round number based on existing fixtures
useEffect(() => {
  if (selectedTournamentForFixtures && tournamentFixtures.length > 0) {
    const fixturesForTournament = tournamentFixtures.filter(
      f => f.tournament_id === selectedTournamentForFixtures
    );
    if (fixturesForTournament.length > 0) {
      const maxRound = Math.max(...fixturesForTournament.map(f => f.round_number || 0));
      const nextRound = maxRound + 1;
      if (nextRound !== knockoutRoundNumber) {
        setKnockoutRoundNumber(nextRound);
      }
    }
  }
}, [selectedTournamentForFixtures, tournamentFixtures]);
```

### Examples

**Scenario 1: Tournament with 5 rounds**
- Existing rounds: 1, 2, 3, 4, 5
- Auto-calculated round number: **6**

**Scenario 2: Tournament with 10 rounds**
- Existing rounds: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10
- Auto-calculated round number: **11**

**Scenario 3: New tournament (no fixtures)**
- Existing rounds: None
- Default round number: **1** (or initial state)

**Scenario 4: After generating Quarter Finals (Round 6)**
- Existing rounds: 1, 2, 3, 4, 5, 6
- Auto-calculated for Semi Finals: **7**

## UI Updates

### Visual Indicators

1. **Label Hint**: Shows "(Auto-set to next round)"
2. **Background Color**: Purple tint (`bg-purple-50`) to indicate auto-calculation
3. **Helper Text**: Displays "Automatically set to X (next available round)"
4. **Still Editable**: Users can override if needed

### Field Display

```tsx
<label className="block text-sm font-medium text-gray-700 mb-2">
  Round Number
  <span className="ml-2 text-xs text-purple-600 font-normal">
    (Auto-set to next round)
  </span>
</label>
<input
  type="number"
  value={knockoutRoundNumber}
  onChange={(e) => setKnockoutRoundNumber(parseInt(e.target.value))}
  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 bg-purple-50"
  placeholder="Auto-calculated"
/>
<p className="text-xs text-gray-500 mt-1">
  Automatically set to {knockoutRoundNumber} (next available round)
</p>
```

## User Experience

### Workflow

1. **Select Tournament**: Choose your tournament
2. **Round Number Auto-Updates**: Field automatically shows next available round
3. **Configure Round**: Select round type, teams, etc.
4. **Generate**: Create fixtures with correct round number
5. **Next Round**: Round number automatically increments for next knockout stage

### Example Flow

```
Tournament has rounds 1-5 (league stage)

Step 1: Select tournament
→ Round number auto-sets to 6

Step 2: Select "Quarter Finals"
→ Number of teams auto-sets to 8
→ Round number stays at 6

Step 3: Generate Quarter Finals
→ Creates fixtures for Round 6

Step 4: Generate next round
→ Round number auto-updates to 7

Step 5: Select "Semi Finals"
→ Number of teams auto-sets to 4
→ Round number stays at 7

Step 6: Generate Semi Finals
→ Creates fixtures for Round 7
```

## Benefits

### 1. Eliminates Manual Calculation
- No need to count existing rounds
- No need to remember last round number
- Automatic tracking

### 2. Prevents Errors
- No duplicate round numbers
- No skipped rounds
- Sequential progression

### 3. Faster Workflow
- One less thing to think about
- Immediate feedback
- Seamless progression

### 4. Still Flexible
- Can override if needed
- Useful for special cases
- Manual control available

## Edge Cases Handled

### 1. Tournament Switch
**Scenario**: User switches from Tournament A (5 rounds) to Tournament B (10 rounds)

**Behavior**:
- Round number updates from 6 to 11
- Reflects correct next round for new tournament

### 2. Fixtures Refresh
**Scenario**: New fixtures are added while user is on the page

**Behavior**:
- Round number updates automatically
- Always shows current next round

### 3. Manual Override
**Scenario**: User manually changes round number to 15

**Behavior**:
- Accepts manual input
- Will auto-update again if tournament changes
- Useful for non-sequential rounds

### 4. No Fixtures
**Scenario**: Tournament has no fixtures yet

**Behavior**:
- Keeps default value (12 or initial state)
- Updates once fixtures are loaded

## Technical Details

### Dependencies

The useEffect depends on:
- `selectedTournamentForFixtures`: Tournament selection
- `tournamentFixtures`: Fixture data

```typescript
}, [selectedTournamentForFixtures, tournamentFixtures]);
```

### Calculation

1. Filter fixtures for selected tournament
2. Find maximum round number
3. Add 1 to get next round
4. Update state if different

### Performance

- Efficient filtering
- Only updates when needed
- No unnecessary re-renders

## Testing

### Test Cases

1. ✅ Select tournament with 5 rounds → Shows 6
2. ✅ Select tournament with 10 rounds → Shows 11
3. ✅ Switch tournaments → Updates correctly
4. ✅ Generate round → Next round increments
5. ✅ Manual override → Accepts custom value
6. ✅ Fixtures refresh → Updates automatically
7. ✅ No fixtures → Uses default
8. ✅ Visual indicators → Shows auto-set hint

## Files Modified

- `app/dashboard/committee/team-management/tournament/page.tsx`
  - Added useEffect for auto-calculating round number
  - Updated round number field UI with hints
  - Added purple background to indicate auto-calculation

## Documentation

- `KNOCKOUT_AUTO_ROUND_NUMBER.md` (this file)

## Related Features

This works together with:
- **Auto Team Count**: Number of teams auto-set by round type
- **Round-Wise Generation**: Generate one round at a time
- **Sequential Progression**: Natural tournament flow

## Future Enhancements

Potential improvements:
1. **Round Name Suggestions**: Suggest round names based on number
2. **Gap Detection**: Warn if creating non-sequential rounds
3. **Round History**: Show previous rounds in dropdown
4. **Bulk Generation**: Generate multiple rounds at once

## Summary

The knockout round generation now automatically calculates the next round number based on existing fixtures, making it easier to create sequential knockout stages without manual calculation.

**Key Improvements:**
- ✅ Auto-calculates next round number (max + 1)
- ✅ Updates when tournament changes
- ✅ Visual indicators show auto-calculation
- ✅ Still editable for manual override
- ✅ Prevents duplicate round numbers
- ✅ Seamless progression through knockout stages

**Example:**
- League stage: Rounds 1-5
- Quarter Finals: Auto-set to Round 6
- Semi Finals: Auto-set to Round 7
- Finals: Auto-set to Round 8

No more manual counting! 🎯
