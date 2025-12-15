# Fantasy Lineup Feature - Testing Guide

## Summary of Changes

### ✅ Completed Updates

1. **Draft Page** - Removed captain/VC selection
   - Removed captain/VC state variables
   - Removed `saveCaptains()` function
   - Removed captain/VC UI section
   - Removed captain/VC validation from submit
   - Added lineup reminder box (shows when 5+ players drafted)
   - Updated submit button validation

2. **Transfers Page** - Removed captain/VC tab
   - Removed "Captain Changes" tab
   - Removed captain/VC state and functions
   - Now only has "Player Transfers" and "Team Affiliation" tabs

3. **My Team Page** - Added lineup button
   - Added "⚽ Set Lineup" button (prominent position)
   - Updated captain/VC info to link to lineup page

4. **New Lineup Page** - Complete implementation
   - Select 5 starters from squad
   - Choose captain from starters (2x points)
   - Choose vice-captain from starters (1.5x points)
   - Visual separation of starters vs subs

5. **API Routes Updated**
   - `/api/fantasy/squad/set-lineup` - NEW: Sets lineup + captain + VC
   - `/api/fantasy/squad/set-captain` - UPDATED: Validates captain/VC are in starting lineup
   - `/api/fantasy/draft/submit` - No captain/VC validation needed
   - `/api/fantasy/calculate-points` - Already filters by `is_starting = true`

## Testing Checklist

### 1. Draft Flow (No Captain/VC Selection)
- [ ] Go to `/dashboard/team/fantasy/draft`
- [ ] Draft some players
- [ ] Verify NO captain/VC selection UI appears
- [ ] Verify lineup reminder box appears when 5+ players drafted
- [ ] Select a supported team
- [ ] Click "Submit Draft"
- [ ] Verify submission works WITHOUT captain/VC validation
- [ ] Verify confirmation message mentions setting lineup after submitting

### 2. Lineup Selection Flow (New Feature)
- [ ] Go to `/dashboard/team/fantasy/my-team`
- [ ] Click "⚽ Set Lineup" button
- [ ] Verify redirects to `/dashboard/team/fantasy/lineup`
- [ ] Verify all squad players are shown
- [ ] Click players to add to Starting 5
- [ ] Verify can only select 5 starters (6th click shows alert)
- [ ] Select captain from starters
- [ ] Select vice-captain from starters
- [ ] Try to save with invalid selections:
  - [ ] Less than 5 starters → Shows error
  - [ ] No captain → Shows error
  - [ ] No vice-captain → Shows error
  - [ ] Captain not in starters → Shows error
  - [ ] VC not in starters → Shows error
  - [ ] Captain = VC → Shows error
- [ ] Save valid lineup
- [ ] Verify success message
- [ ] Verify redirects back to my-team page

### 3. My Team Page Display
- [ ] Go to `/dashboard/team/fantasy/my-team`
- [ ] Verify "Set Lineup" button is visible
- [ ] Verify captain/VC info box shows current selections
- [ ] Click link in captain/VC box
- [ ] Verify goes to lineup page

### 4. Transfers Page (No Captain Tab)
- [ ] Go to `/dashboard/team/fantasy/transfers`
- [ ] Verify only 2 tabs: "Player Transfers" and "Team Affiliation"
- [ ] Verify NO "Captain Changes" tab
- [ ] Test player transfer functionality still works
- [ ] Test team affiliation change still works

### 5. Points Calculation
- [ ] Set lineup with 5 starters (rest as subs)
- [ ] Set captain and vice-captain
- [ ] Wait for a match to be played
- [ ] Run points calculation
- [ ] Verify:
  - [ ] Only starting players earn points
  - [ ] Substitutes earn 0 points
  - [ ] Captain gets 2x multiplier
  - [ ] Vice-captain gets 1.5x multiplier

### 6. Edge Cases

#### Case A: Team with < 5 players
- [ ] Draft only 3-4 players
- [ ] Try to set lineup
- [ ] Verify can select all players as starters
- [ ] Verify validation prevents saving (need exactly 5)

#### Case B: Changing Lineup Mid-Season
- [ ] Set initial lineup
- [ ] Make a transfer (add/remove player)
- [ ] Go to lineup page
- [ ] Verify can update lineup
- [ ] Verify new lineup takes effect for future matches

#### Case C: Old set-captain API (Deprecated but still works)
- [ ] Try calling `/api/fantasy/squad/set-captain` directly
- [ ] With captain NOT in starting lineup
- [ ] Verify returns error: "Captain must be in your starting lineup"
- [ ] Set lineup first, then call set-captain
- [ ] Verify works when captain IS in starting lineup

### 7. Database Validation
```sql
-- Check is_starting column exists
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'fantasy_squad' AND column_name = 'is_starting';

-- Check lineup data
SELECT 
  fs.team_id,
  fs.real_player_id,
  rp.player_name,
  fs.is_starting,
  fs.is_captain,
  fs.is_vice_captain
FROM fantasy_squad fs
JOIN realplayers rp ON fs.real_player_id = rp.player_id
WHERE fs.team_id = 'YOUR_TEAM_ID'
ORDER BY fs.is_starting DESC, fs.is_captain DESC, fs.is_vice_captain DESC;
```

## Expected Behavior

### Before Lineup Set
- All players have `is_starting = true` (default)
- Captain and VC can be anyone in squad
- All players earn points

### After Lineup Set
- Exactly 5 players have `is_starting = true`
- Rest have `is_starting = false`
- Captain must be in starting 5
- VC must be in starting 5
- Only starting players earn points

## Common Issues & Solutions

### Issue 1: "Captain must be in starting lineup" error
**Solution**: Go to lineup page and set your starting 5 first, then captain/VC will be set automatically.

### Issue 2: Can't submit draft without captain/VC
**Solution**: This should NOT happen anymore. If it does, the draft page still has old validation code.

### Issue 3: All players earning points (not just starters)
**Solution**: Check that points calculation query has `WHERE is_starting = true` filter.

### Issue 4: Lineup page shows wrong players
**Solution**: Check that `/api/fantasy/squad` endpoint returns correct squad data.

## API Endpoints Reference

### Set Lineup (NEW)
```
POST /api/fantasy/squad/set-lineup
Body: {
  starterIds: string[],      // Exactly 5 player IDs
  captainId: string,         // Must be in starterIds
  viceCaptainId: string      // Must be in starterIds
}
```

### Set Captain (DEPRECATED - Use set-lineup instead)
```
POST /api/fantasy/squad/set-captain
Body: {
  user_id: string,
  captain_player_id: string,      // Must have is_starting = true
  vice_captain_player_id: string  // Must have is_starting = true
}
```

### Get Squad
```
GET /api/fantasy/squad?user_id={uid}
Returns: {
  squad: [
    {
      id: string,
      real_player_id: string,
      player_name: string,
      is_starting: boolean,
      is_captain: boolean,
      is_vice_captain: boolean,
      ...
    }
  ]
}
```

## Migration Notes

- Existing teams: All players default to `is_starting = true`
- Teams need to set lineup manually after migration
- No automatic lineup selection based on draft order
- Captain/VC selections are preserved if they were set before

## User Flow Summary

1. **Draft Phase**: Draft 5-7 players, select supported team, submit draft
2. **Lineup Phase**: Go to My Team → Set Lineup → Choose 5 starters + captain + VC
3. **Match Phase**: Only starting players earn points, captain gets 2x, VC gets 1.5x
4. **Transfer Phase**: Make transfers, update lineup as needed

## Success Criteria

✅ Draft page has NO captain/VC selection
✅ Transfers page has NO captain tab
✅ Lineup page allows selecting 5 starters + captain + VC
✅ Only starting players earn points
✅ Captain/VC must be in starting lineup
✅ All validations work correctly
✅ No TypeScript errors
✅ Database schema updated correctly
