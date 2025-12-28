# Awards System Fix - Summary

## Problem
The awards system was allowing the same players/teams to be awarded multiple times in the same round or week. Once an award was given, it could be updated repeatedly, and candidates were still showing up in the selection list even after an award had been given.

## Root Causes
1. **API allowed updates**: The POST `/api/awards` endpoint was updating existing awards instead of preventing duplicates
2. **Candidates not filtered**: The `/api/awards/eligible` endpoint was returning all eligible candidates regardless of whether an award had already been given
3. **UI showed locked state but data was still available**: The frontend showed a warning but still displayed all candidates

## Changes Made

### 1. `/app/api/awards/route.ts` - Prevent Duplicate Awards
**Changed**: POST endpoint now returns a 409 Conflict error when trying to create an award that already exists for a specific round/week/tournament/season combination.

**Before**: 
- Checked if award exists
- If exists, UPDATE the existing award
- If not, INSERT new award

**After**:
- Checks if award exists
- If exists, returns error with message: "An award has already been given for this round/week"
- If not, INSERT new award
- Only way to change is to DELETE the existing award first

### 2. `/app/api/awards/eligible/route.ts` - Filter Out Already Awarded
**Changed**: All award types (POTD, POTW, TOD, TOW) now check if an award has been given before returning candidates.

**Added checks for**:
- **POTD** (Player of the Day): Checks if award exists for the round before showing MOTM players
- **POTW** (Player of the Week): Checks if award exists for the week before aggregating player stats
- **TOD** (Team of the Day): Checks if award exists for the round before showing teams
- **TOW** (Team of the Week): Checks if award exists for the week before showing teams

**Behavior**: When an award already exists, returns empty candidates array with message "Award already given for this round/week"

### 3. `/app/dashboard/committee/awards/page.tsx` - Better UI Messaging
**Changed**: Updated the header to show the winner's name when an award has been given.

**Before**: "Award Already Given"
**After**: "Winner: [Player/Team Name]"

### 4. Fixed TypeScript Lint Error
**Changed**: Refactored the GET endpoint in `/app/api/awards/route.ts` to use tagged template syntax instead of `sql.unsafe()` to resolve TypeScript lint warnings.

## How It Works Now

### Workflow:
1. **Committee member navigates to awards page**
2. **Selects tournament, award type, and round/week**
3. **System checks if award already exists**:
   - If YES: Shows current winner, locks candidate selection, displays message to delete first
   - If NO: Shows eligible candidates based on performance
4. **Committee member selects a candidate and clicks "Select Award"**
5. **System creates the award** (one-time only)
6. **To change the award**: Must delete the existing award first, then select a new winner

### Key Rules Enforced:
✅ One award per round/week per tournament
✅ Cannot update existing awards (must delete first)
✅ Candidates only shown when no award exists
✅ Clear messaging about award status
✅ Deletion required to change winner

## Testing Recommendations
1. Try to give POTD award for Round 1 - should work
2. Try to give POTD award for Round 1 again - should show error/locked state
3. Delete the Round 1 POTD award
4. Try to give POTD award for Round 1 to different player - should work
5. Repeat for POTW, TOD, TOW award types
6. Check that different rounds/weeks can have their own awards independently
