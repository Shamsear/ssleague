# Substitution Player Name Fix ✅

## Issue
When substituting a player, the home player name wasn't getting updated. The substitution would save but the new player's name wouldn't show.

## Root Cause
The code was using `newPlayer.name` but the player object from the API has the property `player_name` instead.

```typescript
// ❌ WRONG - property doesn't exist
newMatchups[subMatchupIndex].home_player_name = newPlayer.name;

// ✅ CORRECT - using the right property
newMatchups[subMatchupIndex].home_player_name = newPlayer.player_name;
```

## Fix Applied
Updated `app/dashboard/team/fixture/[fixtureId]/page.tsx` in the `handleSubstitution` function:
- Changed `newPlayer.name` to `newPlayer.player_name` for both home and away substitutions
- Also fixed the success message to use the correct property

## Files Changed
- `app/dashboard/team/fixture/[fixtureId]/page.tsx` (lines ~1119 and ~1127)

## Test It
1. Go to your fixture page
2. Click "Substitute" on any player
3. Select a replacement player
4. The new player's name should now save and display correctly!

The substitution feature is now fully working! 🎉
