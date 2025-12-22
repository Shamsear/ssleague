# Fixture Lineup Lock Fix - With Warning System

## Problem
Fixture team lineups were **not getting locked** when the lineup deadline was reached. Teams could continue editing lineups even after the deadline passed.

## Root Cause
The auto-lock system had a critical mismatch:

1. **Lineups are stored in Neon database** in the `fixtures` table:
   - `fixtures.home_lineup` (JSONB column)
   - `fixtures.away_lineup` (JSONB column)

2. **Auto-lock was trying to lock Firebase collection** that doesn't exist:
   - The `/api/lineups/auto-lock` endpoint was trying to update Firebase's `lineups` collection
   - This collection is not used for fixture lineups
   - Result: Lineups never got locked in the actual database

3. **No database lock check**:
   - The lineup submission API only checked if the deadline passed
   - It didn't check if the lineup was already locked in the database
   - Even if auto-lock worked, teams could still submit

## Lineup Deadline Rules

**IMPORTANT**: Different deadlines for home vs away teams:

- **Away Team**: Lineup locks at **round start time** (automatic time-based lock)
- **Home Team**: Lineup locks when **matchups are created** (no time deadline, action-based lock)

This allows the home team flexibility to adjust their lineup until they commit by creating the fixture matchups.

## Warning System for Late Submissions

### Away Team Late Submission Rules

1. **First Offense (No previous warnings)**:
   - Team gets **1 warning** recorded in `team_seasons.lineup_warnings`
   - Team can **still submit** their lineup (with late submission penalty)
   - Violation recorded in `team_violations` table

2. **Second+ Offense (Has previous warning)**:
   - Lineup is **locked empty**
   - `away_lineup.home_can_submit = true` flag is set
   - **Home team can submit** the away team's lineup
   - Away team **cannot submit** anymore

### 5-Player Team Exception

Teams with **exactly 5 active players** (minimum squad size):
- **Auto-submit all 5 players** as starters (no substitute)
- **No warning issued** (they have no choice)
- Applies to both home and away teams
- Lineup is auto-created and locked

## Solution

### 1. Fixed Auto-Lock API (`app/api/lineups/auto-lock/route.ts`)
- Changed from Firebase to **Neon database**
- Now queries `fixtures` table and `round_deadlines` table
- Calculates round start time from round configuration
- **Away team**: Locks at round start time with warning system
- **Home team**: Auto-submits if 5 players, locks when matchups created
- Updates the `locked` field in the JSONB lineup data

**Warning System Logic**:
```typescript
// Check if away team submitted
if (!awaySubmitted) {
  // Check player count
  if (playerCount === 5) {
    // Auto-submit all 5 players, no warning
  } else {
    // Check existing warnings
    if (existingWarnings === 0) {
      // Issue first warning, allow late submission
    } else {
      // Lock lineup, allow home team to submit
    }
  }
}
```

### 2. Added Matchup Creation Lock (`app/api/fixtures/[fixtureId]/matchups/route.ts`)
- When matchups are created, **home team lineup is immediately locked**
- This happens in the POST handler after matchups are inserted
- Locks with reason: "Matchups created"
- This ensures home team can't edit lineup after committing to matchups

### 3. New Opponent Lineup Submission API (`app/api/fixtures/[fixtureId]/submit-opponent-lineup/route.ts`)
- Allows **home team to submit away team's lineup**
- Only works if `away_lineup.home_can_submit === true`
- Validates all players belong to away team
- Records action in audit log
- Locks lineup immediately after submission

### 4. Updated Hook (`hooks/useAutoLockLineups.ts`)
- Removed client-side deadline check (API now handles it)
- Always triggers the check when component mounts
- API determines if deadline has passed

### 5. Added Lock Check to Lineup API (`app/api/fixtures/[fixtureId]/lineup/route.ts`)
- Added check in both POST and PUT handlers
- Checks if `lineup.locked === true` before allowing edits
- Returns 403 error if lineup is locked
- This ensures even if auto-lock fails, manual edits are blocked

## How It Works Now

### Away Team Lineup Lock (Normal Submission)
1. **User visits fixture page** → `useAutoLockLineups` hook triggers
2. **Hook calls** `/api/lineups/auto-lock` with fixture_id
3. **API checks**:
   - Gets fixture from Neon
   - Gets round_deadlines to calculate round start time
   - Checks if `now >= roundStartTime`
4. **If round started and away submitted**:
   - Sets `away_lineup.locked = true` in database
   - Sets `away_lineup.locked_reason = 'Round started'`

### Away Team Late Submission (First Warning)
1. **Round starts, away team hasn't submitted**
2. **Auto-lock checks**: Team has 0 warnings
3. **System issues warning**:
   - Updates `team_seasons.lineup_warnings = 1`
   - Records violation in `team_violations`
   - Team can still submit (with penalty)

### Away Team Late Submission (After Warning)
1. **Round starts, away team hasn't submitted**
2. **Auto-lock checks**: Team has ≥1 warning
3. **System locks lineup**:
   - Sets `away_lineup.locked = true`
   - Sets `away_lineup.home_can_submit = true`
   - Records violation
4. **Home team can now submit**:
   - Calls `/api/fixtures/[fixtureId]/submit-opponent-lineup`
   - Submits lineup for away team
   - Lineup is locked immediately

### 5-Player Team Auto-Submission
1. **Round starts, team hasn't submitted**
2. **Auto-lock checks**: Team has exactly 5 active players
3. **System auto-submits**:
   - Creates lineup with all 5 players as starters
   - No substitute (not enough players)
   - No warning issued
   - Locks lineup immediately

### Home Team Lineup Lock
1. **Home team creates matchups** via fixture page
2. **Matchups API** inserts matchups into database
3. **Immediately after**:
   - Sets `home_lineup.locked = true` in database
   - Sets `home_lineup.locked_reason = 'Matchups created'`
   - Sets `home_lineup.locked_by = user_id`

### Lineup Edit Prevention
- **When team tries to edit**:
  - Lineup API checks `lineup.locked` field
  - Returns error if locked
  - Also checks deadline as backup

## Database Schema

### Firebase `team_seasons` Collection
```typescript
{
  lineup_warnings: number,              // Count of lineup warnings
  last_lineup_warning_fixture: string,  // Last fixture that issued warning
  last_lineup_warning_date: Date        // When last warning was issued
}
```

### Neon `team_violations` Table
```sql
CREATE TABLE team_violations (
  id SERIAL PRIMARY KEY,
  team_id TEXT NOT NULL,
  season_id TEXT NOT NULL,
  violation_type TEXT NOT NULL,  -- 'late_lineup_warning' or 'late_lineup_locked'
  fixture_id TEXT,
  round_number INTEGER,
  violation_date TIMESTAMP,
  deadline TIMESTAMP,
  penalty_applied TEXT,          -- 'warning_issued' or 'lineup_locked'
  notes TEXT
);
```

### Fixture Lineup JSONB Structure
```typescript
{
  players: Array<{
    player_id: string,
    player_name: string,
    position: number,
    is_substitute: boolean
  }>,
  locked: boolean,
  locked_at?: string,
  locked_by?: string,
  locked_reason?: string,
  submitted_by: string,
  submitted_at: string,
  auto_submitted?: boolean,
  submitted_by_home_team?: boolean,  // True if home submitted for away
  home_can_submit?: boolean          // True if home can submit for away
}
```

## Testing

### Test Away Team Lock (Normal)
1. **Create a fixture** with round start time in the past
2. **Away team submits lineup** before deadline
3. **Visit the fixture page**
4. **Check logs** - should see "✅ Locked away lineup for fixture (round started)"

### Test Away Team Warning (First Offense)
1. **Create a fixture** with round start time in the past
2. **Away team does NOT submit** lineup
3. **Visit the fixture page**
4. **Check logs** - should see "⚠️ Issued first lineup warning to away team"
5. **Check Firebase** - `team_seasons.lineup_warnings` should be 1
6. **Away team can still submit** (with penalty)

### Test Home Team Can Submit (Second Offense)
1. **Away team already has 1 warning** in season
2. **Create new fixture**, round starts
3. **Away team does NOT submit** lineup
4. **Visit the fixture page**
5. **Check logs** - should see "🔒 Locked away lineup (after warning), home can submit"
6. **Home team** calls `/api/fixtures/[fixtureId]/submit-opponent-lineup`
7. **Lineup submitted** by home team for away team

### Test 5-Player Auto-Submission
1. **Create a team** with exactly 5 active players
2. **Create a fixture**, round starts
3. **Team does NOT submit** lineup
4. **Visit the fixture page**
5. **Check logs** - should see "✅ Auto-submitted away lineup (5 players, no warning)"
6. **No warning issued**, lineup auto-created

### Database Check
```sql
-- Check lineup status
SELECT 
  id,
  home_lineup->>'locked' as home_locked,
  home_lineup->>'locked_reason' as home_reason,
  home_lineup->>'auto_submitted' as home_auto,
  away_lineup->>'locked' as away_locked,
  away_lineup->>'locked_reason' as away_reason,
  away_lineup->>'home_can_submit' as home_can_submit,
  away_lineup->>'auto_submitted' as away_auto
FROM fixtures 
WHERE id = 'fixture_id';

-- Check warnings
SELECT lineup_warnings, last_lineup_warning_fixture
FROM team_seasons (Firebase)
WHERE team_id = 'team_id' AND season_id = 'season_id';

-- Check violations
SELECT * FROM team_violations
WHERE team_id = 'team_id' AND season_id = 'season_id'
ORDER BY violation_date DESC;
```

## Files Changed

1. `app/api/lineups/auto-lock/route.ts` - Complete rewrite with warning system
2. `app/api/fixtures/[fixtureId]/matchups/route.ts` - Added home lineup locking on matchup creation
3. `app/api/fixtures/[fixtureId]/submit-opponent-lineup/route.ts` - NEW: Home team submits for away
4. `hooks/useAutoLockLineups.ts` - Simplified to always trigger check
5. `app/api/fixtures/[fixtureId]/lineup/route.ts` - Added locked field check

## Impact

- ✅ Away team lineups lock at round start time
- ✅ Home team lineups lock when matchups are created
- ✅ Teams cannot edit locked lineups
- ✅ **Warning system**: First offense = warning, second = locked
- ✅ **Home team can submit** for away team after warning
- ✅ **5-player teams auto-submit** without warning
- ✅ Auto-lock triggers on page visit (no cron needed)
- ✅ Works with existing deadline system
- ✅ Backward compatible with existing fixtures
- ✅ Respects different deadline rules for home vs away teams
- ✅ Tracks violations in database for reporting
