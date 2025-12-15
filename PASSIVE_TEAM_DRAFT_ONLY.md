# Passive Team Selection - Draft Only Feature

## Overview
Passive team (supported team) selection is now restricted to the draft phase only. Teams cannot change their supported team after draft submission.

## Changes Made

### 1. Transfers Page Cleanup ✅
- **File**: `app/dashboard/team/fantasy/transfers/page.tsx`
- ❌ Removed "Team Affiliation" tab completely
- ❌ Removed team affiliation state variables
- ❌ Removed `changeTeamAffiliation()` function
- ❌ Removed real teams fetching
- ❌ Removed UsersIcon import
- ✅ Now only shows "Player Transfers" (no tabs needed)

### 2. Draft Page (Already Correct) ✅
- **File**: `app/dashboard/team/fantasy/draft/page.tsx`
- ✅ Has supported team selection UI
- ✅ Validates supported team before draft submission
- ✅ Teams must select supported team during draft

## User Flow

### During Draft Phase:
1. Team drafts players
2. Team selects supported team from dropdown
3. Team submits draft (validates supported team is selected)
4. Supported team is locked after submission

### After Draft Submission:
1. Team can view their supported team on "My Team" page
2. Team CANNOT change supported team
3. Transfers page only allows player transfers
4. Supported team remains fixed for the season

## What Was Removed

### From Transfers Page:
- ❌ "Team Affiliation" tab
- ❌ Supported team dropdown selector
- ❌ "Change Supported Team" button
- ❌ Team affiliation change functionality
- ❌ Real teams API call

### What Remains:
- ✅ Player transfers functionality
- ✅ Transfer history
- ✅ Transfer window status
- ✅ Points cost display

## Display Only (No Changes Allowed)

### My Team Page:
- Shows current supported team (read-only)
- Displays passive points earned
- No option to change team

### Draft Page:
- Shows supported team selector (during draft)
- Required before submission
- Locked after submission

## API Endpoints

### Still Available:
```
POST /api/fantasy/teams/select-supported
- Used during draft phase only
- Sets supported team for first time
- Cannot be called after draft submission
```

### Removed from UI:
- Team affiliation change from transfers page
- No UI to call the API after draft

## Benefits

1. **Fairness**: Teams cannot switch to winning teams mid-season
2. **Commitment**: Teams must commit to their supported team
3. **Strategy**: Supported team choice becomes part of draft strategy
4. **Simplicity**: One-time selection, no ongoing management

## Validation

### Draft Submission:
```javascript
// Validates supported team is selected
if (!myTeam.supported_team_id || !myTeam.supported_team_name) {
  alert('❌ Please select a Supported Team for passive points before submitting.');
  return;
}
```

### After Draft:
- No UI to change supported team
- API endpoint still exists but not accessible from UI
- Teams must contact admin for changes (manual process)

## Testing Checklist

### Draft Phase:
- [ ] Can select supported team during draft
- [ ] Cannot submit draft without supported team
- [ ] Supported team shows in confirmation message
- [ ] Supported team saved correctly

### After Draft:
- [ ] Transfers page has NO team affiliation tab
- [ ] Transfers page only shows player transfers
- [ ] My Team page shows supported team (read-only)
- [ ] No way to change supported team from UI

### Edge Cases:
- [ ] Team with no supported team cannot submit draft
- [ ] Team cannot bypass validation
- [ ] Supported team persists across sessions
- [ ] Passive points calculated correctly

## Documentation Updates

### User Guide:
- Supported team must be selected during draft
- Cannot be changed after draft submission
- Choose wisely - this is permanent for the season
- Passive points earned from supported team wins

### Admin Guide:
- Teams cannot change supported team via UI
- Manual changes require database update if needed
- Encourage teams to choose carefully during draft

## Migration Notes

- Existing teams keep their current supported team
- No data migration needed
- Only UI changes (removed functionality)
- API endpoint still exists for draft phase

## Future Considerations

### Possible Enhancements:
- Admin page to manually change supported team (emergency)
- Transfer window for supported team changes (with cost)
- One-time supported team change per season
- Supported team change during specific windows

### Current Decision:
- Keep it simple: Draft only, no changes
- Maintains fairness and commitment
- Reduces complexity
