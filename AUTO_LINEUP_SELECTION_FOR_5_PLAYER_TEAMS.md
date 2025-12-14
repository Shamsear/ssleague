# Auto Lineup Selection for 5-Player Teams

## Problem
Teams with exactly 5 players (minimum requirement) have no substitutes to select, so their lineup should be automatically selected and submitted. Teams with 6-7 players need to manually choose which 5 start and which are substitutes.

## Solution Implemented

### 1. Frontend Auto-Selection (`components/LineupSubmission.tsx`)
- **Auto-detect**: When a team has exactly 5 active players
- **Auto-select**: All 5 players are automatically added to starting XI
- **Auto-submit**: Lineup is automatically submitted after 500ms delay
- **Visual feedback**: Blue info box shows "Your team has exactly 5 players. All players have been automatically selected as starters."

### 2. Backend Auto-Lock with Smart Defaults (`app/api/lineups/auto-lock/route.ts`)
When lineup deadline passes and a team hasn't submitted:
- **Check roster**: Fetches team's active players
- **If exactly 5 players**: Auto-creates lineup with all 5 as starters, 0 substitutes
- **If not 5 players**: Creates empty locked lineup (existing behavior)
- **Lock reason**: Shows "Auto-lock (5 Players)" vs "Auto-lock (No Submission)"

### 3. Committee Manual Lock Process (`app/api/lineups/process-locks/route.ts`)
Same logic as auto-lock for committee-triggered locks:
- Checks team roster when no lineup submitted
- Auto-fills lineup if exactly 5 players
- Creates empty lineup otherwise

## How It Works

### For Teams with Exactly 5 Players:
1. **Before Deadline**: 
   - Team visits lineup page
   - System detects 5 players
   - All 5 auto-selected as starters
   - Lineup auto-submitted immediately
   - Team sees confirmation

2. **After Deadline (if not visited)**:
   - Auto-lock system runs
   - Fetches team roster
   - Detects 5 players
   - Creates locked lineup with all 5 as starters
   - No manual intervention needed

### For Teams with 6-7 Players:
1. **Manual or Auto-Select**:
   - **Option A**: Manually choose 5 starters + 0-2 substitutes
   - **Option B**: Click "Auto-Select Lineup" button to instantly fill:
     - First 5 players as starters (respects category requirements if enabled)
     - Remaining players as substitutes (max 2)
   - Can use "Clear" button to reset and start over
   - Submit lineup before deadline

2. **If deadline passes without submission**:
   - Empty locked lineup created
   - Team forfeits match

## Technical Details

### Auto-Submit Logic
```typescript
// In fetchRoster() - components/LineupSubmission.tsx
if (activePlayers.length === 5 && !existingLineup) {
  const allPlayerIds = activePlayers.map(p => p.player_id);
  setStartingXI(allPlayerIds);
  setSubstitutes([]);
  
  setTimeout(() => {
    autoSubmitLineup(allPlayerIds, []);
  }, 500);
}
```

### Auto-Lock Logic
```typescript
// In auto-lock/route.ts and process-locks/route.ts
const rosterResponse = await fetch(`/api/team/${team_id}/roster?season_id=${season_id}`);
const rosterData = await rosterResponse.json();

let starters: string[] = [];
if (rosterData.success && rosterData.players) {
  const activePlayers = rosterData.players.filter((p: any) => p.is_active);
  if (activePlayers.length === 5) {
    starters = activePlayers.map((p: any) => p.player_id);
  }
}

await lineupRef.set({
  starters,
  substitutes: [],
  locked_by_name: starters.length === 5 ? 'Auto-lock (5 Players)' : 'Auto-lock (No Submission)'
});
```

## Benefits

1. **User Experience**: Teams with 5 players don't need to manually submit (no choice to make)
2. **Quick Selection**: Teams with 6-7 players can use auto-select button for instant lineup
3. **Fair Play**: Teams with minimum players still get to play with full lineup
4. **Automation**: Reduces manual work for both teams and committee
5. **Flexibility**: Teams can auto-select then adjust, or manually select from scratch
6. **Transparency**: Clear lock reasons show why lineup was auto-created

## Files Modified

1. `components/LineupSubmission.tsx` - Added:
   - Auto-submit for 5-player teams
   - "Auto-Select Lineup" button for quick selection
   - "Clear" button to reset selection
   - Smart auto-select logic respecting category requirements
2. `app/api/lineups/auto-lock/route.ts` - Added smart auto-fill on deadline
3. `app/api/lineups/process-locks/route.ts` - Added smart auto-fill for manual locks

## Testing Checklist

- [ ] Team with 5 players visits lineup page → Auto-submits
- [ ] Team with 6 players visits lineup page → Can manually select or use auto-select button
- [ ] Auto-select button fills first 5 as starters, rest as subs
- [ ] Auto-select respects category requirements when enabled
- [ ] Clear button resets all selections
- [ ] Team with 5 players doesn't visit → Auto-lock creates full lineup
- [ ] Team with 6 players doesn't visit → Auto-lock creates empty lineup
- [ ] Visual indicators show for both 5-player and 6-7 player teams
- [ ] Lock reason correctly shows "Auto-lock (5 Players)" vs "Auto-lock (No Submission)"
- [ ] Auto-select button disabled when lineup is locked
- [ ] Clear button disabled when no players selected
