# Knockout Scoring Systems - Complete Implementation

## Overview
All three knockout formats now support both **Goal-Based** and **Win-Based** scoring systems.

---

## 🎯 Three Knockout Formats

### 1. **Single Leg** (single_leg)
- **Structure**: One fixture with 5 matchups
- **Matchups**: 1v1, 2v2, 3v3, 4v4, 5v5
- **Modes**: Can be `blind_lineup` or `manual`

### 2. **Two-Legged** (two_leg)
- **Structure**: Two fixtures (home + away)
- **Matchups**: Each fixture has 5 matchups
- **Winner**: Aggregate score across both legs

### 3. **Round Robin** (round_robin)
- **Structure**: One fixture with 25 matchups
- **Matchups**: Each of 5 home players vs each of 5 away players (5×5)
- **Winner**: Team with most wins/goals

---

## ⚽ Two Scoring Systems

### Goal-Based Scoring (`scoring_system: 'goals'`)
**How it works:**
- Winner determined by **total goals scored**
- Sum all goals from all matchups
- Add penalty goals (substitution penalties, fines)

**Example:**
```
Matchup 1: Home 3-2 Away
Matchup 2: Home 1-4 Away
Matchup 3: Home 2-2 Away
Matchup 4: Home 0-3 Away
Matchup 5: Home 4-1 Away
---
Home Total: 10 goals
Away Total: 12 goals
Winner: Away Team
```

**With Penalties:**
```
Home Goals: 10
Away Goals: 12
Home Substitution Penalty: +2 goals to Away
Away Substitution Penalty: +3 goals to Home
---
Home Final: 10 + 3 = 13 goals
Away Final: 12 + 2 = 14 goals
Winner: Away Team
```

---

### Win-Based Scoring (`scoring_system: 'wins'`)
**How it works:**
- Each matchup awards points:
  - **Win**: 3 points
  - **Draw**: 1 point each
  - **Loss**: 0 points
- Winner determined by **total points**
- Penalties count as points (not goals)

**Example:**
```
Matchup 1: Home 3-2 Away → Home +3 pts
Matchup 2: Home 1-4 Away → Away +3 pts
Matchup 3: Home 2-2 Away → Both +1 pt
Matchup 4: Home 0-3 Away → Away +3 pts
Matchup 5: Home 4-1 Away → Home +3 pts
---
Home Total: 3 + 1 + 3 = 7 points
Away Total: 3 + 1 + 3 = 7 points
Result: DRAW
```

**With Penalties:**
```
Home Points: 7
Away Points: 7
Home Substitution Penalty: +2 points to Away
Away Substitution Penalty: +3 points to Home
---
Home Final: 7 + 3 = 10 points
Away Final: 7 + 2 = 9 points
Winner: Home Team
```

---

## 🏗️ Database Schema

### Fixtures Table
```sql
ALTER TABLE fixtures 
ADD COLUMN scoring_system VARCHAR(20) DEFAULT 'goals';

-- Values: 'goals' or 'wins'
-- Applies to all knockout formats
```

### Matchups Table
```sql
-- Existing fields used for both systems:
home_goals INTEGER
away_goals INTEGER
home_sub_penalty INTEGER  -- Penalty awarded TO opponent
away_sub_penalty INTEGER  -- Penalty awarded TO opponent
```

---

## 📊 How Each Format Uses Scoring

### Single Leg + Goal-Based
```
5 matchups → Sum all goals → Add penalties → Winner
```

### Single Leg + Win-Based
```
5 matchups → Count wins (3pts), draws (1pt) → Add penalty points → Winner
```

### Two-Legged + Goal-Based
```
Home Leg: Sum goals
Away Leg: Sum goals
Aggregate: Home total + Away total → Winner
```

### Two-Legged + Win-Based
```
Home Leg: Count points
Away Leg: Count points
Aggregate: Home total + Away total → Winner
```

### Round Robin + Goal-Based
```
25 matchups → Sum all goals → Add penalties → Winner
```

### Round Robin + Win-Based
```
25 matchups → Count wins/draws → Add penalty points → Winner
```

---

## 🎮 UI Implementation

### Committee Tournament Management Page
**Location**: `app/dashboard/committee/team-management/tournament/page.tsx`

**New Selector Added:**
```tsx
{/* Scoring System Selection */}
<div className="mb-4">
  <label>Scoring System</label>
  <div className="flex gap-3">
    <button onClick={() => setScoringSystem('goals')}>
      ⚽ Goal-Based
      <div>Winner by total goals scored</div>
    </button>
    <button onClick={() => setScoringSystem('wins')}>
      🏆 Win-Based
      <div>3 pts for win, 1 for draw</div>
    </button>
  </div>
</div>
```

**State:**
```tsx
const [scoringSystem, setScoringSystem] = useState<'goals' | 'wins'>('goals');
```

**API Call:**
```tsx
await fetch('/api/tournaments/${id}/generate-knockout', {
  method: 'POST',
  body: JSON.stringify({
    knockout_format: knockoutFormat,
    scoring_system: scoringSystem, // ← New parameter
    // ...
  })
});
```

---

### Team Fixture Page
**Location**: `app/dashboard/team/fixture/[fixtureId]/page.tsx`

**Changes:**
1. Added `scoringSystem` state
2. Loads from fixture data
3. WhatsApp share text adapts to scoring system
4. Score calculation uses active scoring system

**Score Calculation:**
```tsx
const activeScoring = scoringSystem || tournamentSystem;

if (activeScoring === 'wins') {
  // Calculate points from wins/draws
  matchups.forEach(m => {
    if (m.home_goals > m.away_goals) homePoints += 3;
    else if (m.away_goals > m.home_goals) awayPoints += 3;
    else { homePoints += 1; awayPoints += 1; }
  });
  
  homeTotalScore = homePoints + awaySubPenalties + homePenaltyGoals;
  awayTotalScore = awayPoints + homeSubPenalties + awayPenaltyGoals;
} else {
  // Sum goals
  homeTotalScore = homePlayerGoals + awaySubPenalties + homePenaltyGoals;
  awayTotalScore = awayPlayerGoals + homeSubPenalties + awayPenaltyGoals;
}
```

---

## 🔄 API Updates

### Generate Knockout API
**Endpoint**: `/api/tournaments/[id]/generate-knockout`

**Request Body:**
```json
{
  "knockout_format": "single_leg" | "two_leg" | "round_robin",
  "scoring_system": "goals" | "wins",
  "matchup_mode": "manual" | "blind_lineup",
  "pairing_method": "standard",
  "start_date": "2026-01-25"
}
```

**Response:**
```json
{
  "success": true,
  "fixtures_created": 4,
  "knockout_structure": {
    "first_round": "Quarter Finals",
    "format": "single_leg",
    "scoring": "wins"
  }
}
```

---

## 📱 WhatsApp Share Format

### Goal-Based Example
```
*SS PES SUPER LEAGUE - S16*

*MATCHDAY 12* - Quarter Final

*Team A* vs *Team B*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*MATCHUPS:*

1. Player1 *3-2* Player6 (6min)
2. Player2 *1-4* Player7 (6min)
3. Player3 *2-2* Player8 (6min)
4. Player4 *0-3* Player9 (6min)
5. Player5 *4-1* Player10 (6min)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*SCORE BREAKDOWN:*

*Team A*
Total: *13* goals
   - Player Goals: 10
   - Opponent Sub Penalties: +3

*Team B*
Total: *14* goals
   - Player Goals: 12
   - Opponent Sub Penalties: +2

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*RESULT*
*Team B WON!*
```

### Win-Based Example
```
*SS PES SUPER LEAGUE - S16*

*MATCHDAY 12* - Quarter Final

*Team A* vs *Team B*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*MATCHUPS:*

1. Player1 *3-2* Player6 (6min)
2. Player2 *1-4* Player7 (6min)
3. Player3 *2-2* Player8 (6min)
4. Player4 *0-3* Player9 (6min)
5. Player5 *4-1* Player10 (6min)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*SCORE BREAKDOWN:*

*Team A*
Total: *10* points
   - Player Points: 7
   - Opponent Sub Penalties: +3

*Team B*
Total: *9* points
   - Player Points: 7
   - Opponent Sub Penalties: +2

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*RESULT*
*Team A WON!*
```

---

## 🧪 Testing Scenarios

### Test 1: Single Leg + Goals
1. Create knockout with `single_leg` + `goals`
2. Enter 5 matchup results
3. Verify winner = team with most total goals

### Test 2: Single Leg + Wins
1. Create knockout with `single_leg` + `wins`
2. Enter 5 matchup results
3. Verify winner = team with most points (3 per win, 1 per draw)

### Test 3: Two-Legged + Goals
1. Create knockout with `two_leg` + `goals`
2. Enter results for both legs
3. Verify aggregate goals determine winner

### Test 4: Two-Legged + Wins
1. Create knockout with `two_leg` + `wins`
2. Enter results for both legs
3. Verify aggregate points determine winner

### Test 5: Round Robin + Goals
1. Create knockout with `round_robin` + `goals`
2. Enter all 25 matchup results
3. Verify total goals determine winner

### Test 6: Round Robin + Wins
1. Create knockout with `round_robin` + `wins`
2. Enter all 25 matchup results
3. Verify total points determine winner

### Test 7: Penalties in Win-Based
1. Use win-based scoring
2. Add substitution penalty (e.g., +2)
3. Verify penalty counts as points, not goals

---

## 🚀 Migration Guide

### Step 1: Run Database Migration
```bash
psql $DATABASE_URL -f migrations/add_knockout_scoring_system.sql
```

### Step 2: Update Existing Fixtures (Optional)
```sql
-- Set all existing knockout fixtures to goal-based (default)
UPDATE fixtures 
SET scoring_system = 'goals' 
WHERE knockout_round IS NOT NULL 
  AND scoring_system IS NULL;
```

### Step 3: Deploy Frontend Changes
- Committee tournament page updated
- Team fixture page updated
- WhatsApp share logic updated

---

## 📝 Key Points

✅ **All 3 formats** support both scoring systems
✅ **Backward compatible** - defaults to 'goals'
✅ **Fixture-level setting** - each fixture can have different scoring
✅ **Penalties adapt** - count as goals or points based on system
✅ **WhatsApp share** - automatically shows correct units (goals/points)
✅ **UI selectors** - clear visual distinction between systems

---

## 🎯 Future Enhancements

1. **Standings Page**: Show knockout bracket with scoring system indicator
2. **Statistics**: Track win-based vs goal-based performance separately
3. **Awards**: Different awards for goal-based vs win-based tournaments
4. **Analytics**: Compare team performance across scoring systems

---

## 📞 Support

For questions or issues:
- Check fixture `scoring_system` field in database
- Verify API passes `scoring_system` parameter
- Test WhatsApp share to confirm correct calculation
- Review console logs for scoring system detection

---

**Implementation Complete** ✅
All three knockout formats now fully support both goal-based and win-based scoring!
