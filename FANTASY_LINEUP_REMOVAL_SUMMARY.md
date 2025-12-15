# Fantasy Lineup System Removal Summary

## Overview
Removed the separate lineup selection page and moved captain/vice-captain selection to the draft and transfer pages for a simpler user experience.

## What Was Removed

### Pages Deleted
1. ✅ `app/dashboard/team/fantasy/lineup/page.tsx` - Team lineup selection page
2. ✅ `app/dashboard/committee/fantasy/[leagueId]/lineups/page.tsx` - Committee lineups management page

### API Routes Deleted
1. ✅ `app/api/fantasy/squad/set-lineup/route.ts` - Set lineup API (5 starters + captain/VC)
2. ✅ `app/api/admin/fantasy/lineups/route.ts` - Admin view all lineups API

### References Updated

#### Team Side
**`app/dashboard/team/fantasy/my-team/page.tsx`**
- ❌ Removed "Set Lineup" button
- ✅ Changed "Draft Players" to "Draft Players & Set Captain"
- ✅ Changed "Change lineup, captain & vice-captain" link to "Change captain & vice-captain" (points to draft page)

**`app/dashboard/team/fantasy/draft/page.tsx`**
- ❌ Removed "Ready to Set Your Lineup!" reminder box
- ✅ Added "Don't Forget Captain & Vice-Captain!" reminder (only shows if not set)
- ✅ Captain/VC selection integrated into squad display

## What Remains

### Captain/Vice-Captain Selection
Now available in TWO places:

1. **Draft Page** (`app/dashboard/team/fantasy/draft/page.tsx`)
   - Select captain/VC while drafting players
   - Buttons on each player card in "My Squad"
   - "Save Captain & Vice-Captain" button at bottom

2. **Transfers Page** (`app/dashboard/team/fantasy/transfers/page.tsx`)
   - Dedicated "Captain & Vice-Captain" section
   - Shows all squad players with captain/VC buttons
   - "Save Captain & Vice-Captain" button

### API Routes Kept
- ✅ `app/api/fantasy/squad/set-captain/route.ts` - Set captain & vice-captain only
- ✅ `app/api/admin/fantasy/lineup-lock/route.ts` - Lineup lock feature (kept for future use)

### Database Columns Kept
- ✅ `fantasy_squad.is_captain` - Captain flag
- ✅ `fantasy_squad.is_vice_captain` - Vice-captain flag
- ❌ `fantasy_squad.is_starting` - Will be removed in migration

## New User Flow

### During Draft
1. User drafts players
2. User selects captain (2x points) and vice-captain (1.5x points) from squad
3. User clicks "Save Captain & Vice-Captain"
4. User submits draft

### During Transfer Window
1. User makes transfers
2. User can update captain/VC selection in dedicated section
3. User clicks "Save Captain & Vice-Captain"

### Points Calculation
- All players in squad automatically earn points
- Captain gets 2x multiplier
- Vice-captain gets 1.5x multiplier
- No need to select "starting 5" - everyone plays!

## Benefits

✅ **Simpler UX**: No separate lineup page to navigate to
✅ **Less Confusion**: Captain/VC selection in same place as squad management
✅ **Fewer Steps**: One less page in the user journey
✅ **Cleaner Code**: Removed unused pages and APIs
✅ **Better Flow**: Draft → Set Captain → Submit (all in one place)

## Migration Notes

When applying `migrations/add_fantasy_round_tracking_simple.sql`:
- Removes `is_starting` column from `fantasy_squad`
- Keeps `is_captain` and `is_vice_captain` columns
- All existing captain/VC selections will be preserved

## Testing Checklist

- [ ] Draft page shows captain/VC buttons on each player
- [ ] Save captain/VC button works in draft page
- [ ] Transfers page shows captain/VC section
- [ ] Save captain/VC button works in transfers page
- [ ] My Team page shows updated buttons (no "Set Lineup")
- [ ] Captain/VC reminder shows in draft page when not set
- [ ] No broken links to `/fantasy/lineup`
- [ ] Points calculation uses captain/VC multipliers correctly
