# Fantasy Lineup Selection Feature - Implementation Complete

## Overview
Implemented a lineup selection system where fantasy teams choose 5 starting players from their squad (5-7 players), with the rest as substitutes. Only starting players earn points.

## Changes Made

### 1. Database Migration ✅
- **File**: `migrations/add_is_starting_to_fantasy_squad.sql`
- Added `is_starting` BOOLEAN column to `fantasy_squad` table
- Default value: `true` (all existing players start as starters)
- Added index for performance: `idx_fantasy_squad_starting`

### 2. API Endpoint ✅
- **File**: `app/api/fantasy/squad/set-lineup/route.ts`
- New endpoint: `POST /api/fantasy/squad/set-lineup`
- Accepts:
  - `starterIds`: Array of 5 player IDs to set as starters
  - `captainId`: Player ID for captain (2x points)
  - `viceCaptainId`: Player ID for vice-captain (1.5x points)
- Validates:
  - Exactly 5 starters selected
  - Captain and VC are in starting lineup
  - Captain and VC are different players
  - All players belong to the user's squad

### 3. Points Calculation Update ✅
- **File**: `app/api/fantasy/calculate-points/route.ts` (line 265)
- Updated query to only calculate points for starting players:
  ```sql
  WHERE is_starting = true
  ```
- Substitutes no longer earn points

### 4. New Lineup Page ✅
- **File**: `app/dashboard/team/fantasy/lineup/page.tsx`
- Features:
  - Visual separation of Starting 5 and Substitutes
  - Click to add/remove players from starting lineup
  - Select captain (⭐ 2x points) from starters
  - Select vice-captain (🥈 1.5x points) from starters
  - Validation before saving
  - Clean, intuitive UI with color coding

### 5. My Team Page Updates ✅
- **File**: `app/dashboard/team/fantasy/my-team/page.tsx`
- Added "⚽ Set Lineup" button (prominent red/pink gradient)
- Updated captain/VC info section to link to lineup page
- Changed text from "Change captain/VC during transfer window" to "Change lineup, captain & vice-captain"

### 6. Transfers Page Cleanup ✅
- **File**: `app/dashboard/team/fantasy/transfers/page.tsx`
- Removed "Captain Changes" tab completely
- Removed captain/VC state variables
- Removed `saveCaptains()` function
- Removed Crown and Star icon imports
- Now only has 2 tabs: "Player Transfers" and "Team Affiliation"

## User Flow

1. **View Squad**: User goes to "My Team" page
2. **Set Lineup**: Click "⚽ Set Lineup" button
3. **Select Starters**: Choose 5 players from squad to be starters
4. **Choose Captain**: Select captain from the 5 starters (2x points)
5. **Choose Vice-Captain**: Select vice-captain from the 5 starters (1.5x points)
6. **Save**: Click "Save Lineup" - validates and saves all selections
7. **Points Calculation**: Only starting players earn points in matches

## Validation Rules

- Must select exactly 5 starting players
- Captain must be selected from starting 5
- Vice-captain must be selected from starting 5
- Captain and vice-captain must be different players
- All selections saved atomically (all or nothing)

## Database Schema

```sql
fantasy_squad:
  - is_starting BOOLEAN DEFAULT true
  - is_captain BOOLEAN DEFAULT false
  - is_vice_captain BOOLEAN DEFAULT false
```

## API Endpoints

### Set Lineup
```
POST /api/fantasy/squad/set-lineup
Body: {
  starterIds: string[],      // Array of 5 player IDs
  captainId: string,         // Must be in starterIds
  viceCaptainId: string      // Must be in starterIds
}
```

## Testing Checklist

- [x] Database migration runs successfully
- [x] Lineup page loads and displays squad
- [x] Can select/deselect starters (max 5)
- [x] Can select captain from starters
- [x] Can select vice-captain from starters
- [x] Validation prevents invalid selections
- [x] Save updates database correctly
- [x] Points calculation only counts starting players
- [x] Captain gets 2x multiplier
- [x] Vice-captain gets 1.5x multiplier
- [x] Transfers page no longer has captain tab
- [x] My Team page links to lineup page

## Notes

- All existing players default to `is_starting = true` after migration
- Teams with fewer than 5 players will need to draft more before using lineup feature
- Lineup changes take effect immediately for future matches
- Captain/VC selection is now part of lineup management, not transfer management
