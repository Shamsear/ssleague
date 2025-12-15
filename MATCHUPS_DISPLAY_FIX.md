# Matchups Display Issue Fix

## Problem
When home team opens the fixture page during home_fixture phase with both lineups submitted and no matchups created, they see "Waiting for Matchups" instead of the "Create Matchups" interface.

## Root Cause
The `canCreateMatchups` state is likely being set to `false` when it should be `true` for the home team.

## Expected Behavior

### Home Fixture Phase (Before Home Deadline)
**Home Team:**
- Both lineups submitted ✅
- No matchups exist ✅
- Should see: "Create Matchups" interface with player selection
- `canCreateMatchups` should be `true`

**Away Team:**
- Both lineups submitted ✅
- No matchups exist ✅
- Should see: "Waiting for Matchups - Home team will create player matchups during this phase"
- `canCreateMatchups` should be `false`

### Fixture Entry Phase (After Home Deadline, Before Away Deadline)
**Both Teams (if no matchups):**
- Should see: "Create Matchups" interface
- `canCreateMatchups` should be `true`
- First to submit wins

## Logic to Verify

In the `loadFixture` function around line 740-800, check this logic:

```typescript
// Determine matchup permissions with separate phases
const matchupsExist = matchupsList.length > 0;
const bothLineupsSubmitted = actualHomeLineupSubmitted && actualAwayLineupSubmitted;

// Check if round has actually started based on status
const roundHasStarted = deadlines.status === 'in_progress' || 
                       deadlines.status === 'started' || 
                       deadlines.status === 'active';

let canCreate = false;
let canEditMatch = false;

// Matchups can only be created/edited AFTER the round has started
if (roundHasStarted) {
  if (currentPhase === 'home_fixture' && bothLineupsSubmitted) {
    // Home fixture phase (before home deadline)
    // Only home team can create/edit matchups
    if (!matchupsExist) {
      canCreate = isHome;  // ← Should be true for home team
    } else {
      canEditMatch = isHome;
    }
  } else if (currentPhase === 'fixture_entry' && bothLineupsSubmitted) {
    // Fixture entry phase (after home deadline, before away deadline)
    // Both teams can create if not exist
    if (!matchupsExist) {
      canCreate = true;  // Both teams can create
    } else {
      // Check who created the matchups
      const firstMatchup = matchupsList[0];
      const createdByHome = firstMatchup?.home_player_id && homePlayersList.some(p => p.player_id === firstMatchup.home_player_id);
      const createdByThisTeam = (isHome && createdByHome) || (!isHome && !createdByHome);
      canEditMatch = createdByThisTeam;
    }
  }
} else {
  // Round hasn't started yet - no matchup creation allowed
  console.log('⏰ Round has not started yet - matchup creation disabled');
}

setCanCreateMatchups(canCreate);
setCanEditMatchups(canEditMatch);
```

## Debug Steps

1. Check browser console for these logs:
   - `🎮 Matchup Permissions Check:`
   - Look for values of:
     - `currentPhase` - should be 'home_fixture'
     - `bothLineupsSubmitted` - should be true
     - `matchupsExist` - should be false
     - `isHome` - should be true for home team
     - `roundHasStarted` - should be true
     - `roundStatus` - should be 'in_progress', 'started', or 'active'

2. If `roundHasStarted` is false:
   - Check `deadlines.status` value
   - The round might not be marked as started yet
   - Committee needs to start the round

3. If `bothLineupsSubmitted` is false:
   - Check if both lineups are actually submitted
   - Check the lineup fetching logic

## Quick Fix

If the issue is that the round status is not 'in_progress', the committee needs to:
1. Go to committee dashboard
2. Find the round
3. Click "Start Round" or change status to "In Progress"

## UI Message Fix

The "Waiting for Matchups" message should only show for:
- Away team during home_fixture phase
- Both teams if round hasn't started
- Both teams if lineups not submitted

For home team during home_fixture phase with both lineups submitted and round started, should show the create matchups interface.
