# Intelligent Knockout Team Loading

## Overview
Updated the "Load & Auto-Select Top Teams" button to intelligently determine where to load teams from based on the tournament progression and round type being generated.

## Problem
Previously, the system would just load from the last completed knockout round or fall back to standings. This didn't work well for complex tournament structures where:
- Semi Finals should load from Playoff (if it exists) or from standings
- Finals should load from Semi Finals
- Third Place Playoff should load LOSERS from Semi Finals

## Solution

### Smart Team Loading Logic

The system now checks the **round type being generated** and determines the appropriate source:

#### 1. Semi Finals
**Logic:**
1. Check if there's a completed Playoff round
2. If yes → Load winners from Playoff
3. If no → Load from league standings

**Use Case:**
- Tournament with Playoff (4→2): Semi Finals loads 2 winners from Playoff
- Tournament without Playoff: Semi Finals loads top 4 from standings

#### 2. Finals
**Logic:**
1. Load winners from Semi Finals

**Use Case:**
- Finals always loads the 2 winners from Semi Finals

#### 3. Third Place Playoff
**Logic:**
1. Load **LOSERS** from Semi Finals (not winners!)

**Use Case:**
- Third Place match features the 2 teams that lost in Semi Finals

#### 4. Quarter Finals
**Logic:**
1. Check if there's a completed Round of 16
2. If yes → Load winners from Round of 16
3. If no → Load from league standings

**Use Case:**
- Large tournaments: QF loads 8 winners from R16
- Smaller tournaments: QF loads top 8 from standings

#### 5. Playoff
**Logic:**
1. Load from league standings (top N teams)

**Use Case:**
- Playoff is typically the first knockout round

## Implementation Details

### Code Changes

**File:** `app/dashboard/committee/team-management/tournament/page.tsx`

**Function:** `loadAvailableTeamsForKnockout()`

### Key Features

1. **Round Type Detection**
   - Uses `knockoutRoundType` state to determine which round is being generated
   - Maps round type to expected previous round

2. **Winner/Loser Selection**
   - Most rounds load winners from previous round
   - Third Place Playoff specifically loads losers

3. **Two-Leg Support**
   - Calculates aggregate scores for two-legged ties
   - Determines winner/loser based on aggregate
   - Uses second leg result as tiebreaker if aggregate is tied

4. **Fallback to Standings**
   - If no previous round exists or isn't completed
   - Loads from league/group standings
   - Maintains existing group stage logic

### Round Type Mapping

```typescript
Round Type          → Expected Previous Round
─────────────────────────────────────────────
playoff             → League Standings
quarter_finals      → Round of 16 (or Standings)
semi_finals         → Playoff (or Standings)
finals              → Semi Finals
third_place         → Semi Finals (LOSERS)
```

## Examples

### Example 1: Standard Progression
```
League Season (14 teams)
  ↓
Playoff (Top 4 → 2 winners)
  ↓
Semi Finals (2 from Playoff + 2 from Standings = 4 teams)
  ↓
Finals (2 winners from Semi Finals)
  ↓
Third Place (2 losers from Semi Finals)
```

**Team Loading:**
- Playoff: Loads top 4 from standings
- Semi Finals: Loads 2 winners from Playoff
- Finals: Loads 2 winners from Semi Finals
- Third Place: Loads 2 losers from Semi Finals

### Example 2: No Playoff
```
League Season (14 teams)
  ↓
Semi Finals (Top 4 from Standings)
  ↓
Finals (2 winners from Semi Finals)
```

**Team Loading:**
- Semi Finals: Loads top 4 from standings (no Playoff exists)
- Finals: Loads 2 winners from Semi Finals

### Example 3: Large Tournament
```
League Season (16 teams)
  ↓
Round of 16 (All 16 teams)
  ↓
Quarter Finals (8 winners from R16)
  ↓
Semi Finals (4 winners from QF)
  ↓
Finals (2 winners from SF)
```

**Team Loading:**
- Round of 16: Loads all 16 from standings
- Quarter Finals: Loads 8 winners from Round of 16
- Semi Finals: Loads 4 winners from Quarter Finals
- Finals: Loads 2 winners from Semi Finals

## Benefits

1. **Automatic Progression**: Teams automatically flow from one round to the next
2. **Flexible Structure**: Supports tournaments with or without Playoff rounds
3. **Correct Participants**: Third Place gets losers, not winners
4. **Smart Fallback**: Falls back to standings when previous round doesn't exist
5. **Two-Leg Support**: Properly handles aggregate scores for two-legged ties

## UI Feedback

The system shows a message indicating where teams were loaded from:

- "Loaded 2 winners from Playoff (single-leg)"
- "Loaded 4 winners from Semi Finals (two-legged)"
- "Loaded 2 losers from Semi Finals (single-leg)"
- "Loaded 8 teams from standings"

## Testing Scenarios

### Test 1: Semi Finals with Playoff
1. Complete a Playoff round (4 teams → 2 winners)
2. Generate Semi Finals
3. Click "Load & Auto-Select Top Teams"
4. **Expected**: Loads 2 winners from Playoff

### Test 2: Semi Finals without Playoff
1. Don't create a Playoff round
2. Generate Semi Finals
3. Click "Load & Auto-Select Top Teams"
4. **Expected**: Loads top 4 from standings

### Test 3: Third Place Playoff
1. Complete Semi Finals (4 teams → 2 winners, 2 losers)
2. Generate Third Place Playoff
3. Click "Load & Auto-Select Top Teams"
4. **Expected**: Loads 2 LOSERS from Semi Finals

### Test 4: Finals
1. Complete Semi Finals
2. Generate Finals
3. Click "Load & Auto-Select Top Teams"
4. **Expected**: Loads 2 winners from Semi Finals

## Notes

- The system uses `knockout_round` field to identify round types
- Round names are case-insensitive ('Playoff' or 'playoff' both work)
- For two-legged ties, aggregate score determines winner/loser
- If aggregate is tied, second leg result is used as tiebreaker
- System maintains backward compatibility with existing tournaments
