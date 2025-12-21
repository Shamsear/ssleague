# Fantasy Flexible Transfer System

## Overview
Users have full flexibility in managing their fantasy squad with three transfer types:
1. **Release-only**: Release players without signing replacements (if above minimum squad size)
2. **Sign-only**: Buy new players without releasing anyone (if below maximum squad size and budget allows)
3. **Swap**: Release and sign simultaneously (original behavior)

## Changes Made

### Frontend (`app/dashboard/team/fantasy/transfers/page.tsx`)

1. **Updated TeamInfo Interface**
   - Added `min_squad_size` field to track minimum squad requirements

2. **Enhanced Transfer Validation**
   - `canExecuteTransfer()` now supports three transfer types:
     - **Release-only**: Can release if squad size > minimum
     - **Sign-only**: Can sign if squad size < maximum and budget allows
     - **Swap**: Release and sign simultaneously

3. **Improved UI**
   - Squad size display now shows range: "11-15 allowed"
   - Transfer summary shows "Release only" when no player is being signed
   - Button text changes based on transfer type:
     - "Release Player" (release-only)
     - "Sign Player" (sign-only)
     - "Execute Transfer" (swap)
   - Error messages now include minimum squad size warnings

4. **Updated Transfer Execution**
   - Allows transfers with only `player_out_id` or only `player_in_id`
   - Dynamic success messages based on transfer type

### Backend (`app/api/fantasy/transfers/execute/route.ts`)

1. **Flexible Transfer Validation**
   - Accepts transfers with either `player_out_id` or `player_in_id` (or both)
   - Validates minimum squad size for release-only transfers
   - Validates maximum squad size for sign-only transfers

2. **Squad Size Enforcement**
   - Release-only: Prevents if `newSquadSize < minSquadSize`
   - Sign-only: Prevents if `newSquadSize > maxSquadSize`
   - Swap: No size change, only budget validation

3. **Conditional Player Operations**
   - Only queries and updates `fantasy_players` if signing a new player
   - Only updates player availability if relevant to the transfer type

## Transfer Types Supported

### 1. Release-Only Transfer
- **Requirement**: Squad size must be > minimum (default: 11)
- **Effect**: 
  - Player removed from squad
  - Budget increased by purchase price
  - Transfer count incremented
  - Points deducted (if configured)

### 2. Sign-Only Transfer
- **Requirement**: Squad size must be < maximum (default: 15)
- **Effect**:
  - Player added to squad
  - Budget decreased by player price
  - Transfer count incremented
  - Points deducted (if configured)

### 3. Swap Transfer (Original Behavior)
- **Requirement**: Budget must cover price difference
- **Effect**:
  - Old player removed, new player added
  - Budget adjusted by net difference
  - Transfer count incremented
  - Points deducted (if configured)

## Validation Rules

### Frontend Validation
- At least one player must be selected (release or sign)
- Transfer window must be active
- Transfers remaining must be > 0
- Release-only: Squad size > minimum
- Sign-only: Budget sufficient and squad size < maximum
- Swap: Budget sufficient for net cost

### Backend Validation
- User must have an active fantasy team
- Transfer window must be open
- Maximum transfers per window not exceeded
- Release-only: `currentSquadSize - 1 >= minSquadSize`
- Sign-only: `currentSquadSize + 1 <= maxSquadSize`
- Budget validation for any signing operation

## Error Messages

- **Release blocked**: "Cannot release - minimum squad size is {min}"
- **Sign blocked**: "Squad full - release a player first"
- **Budget insufficient**: "Insufficient budget"
- **No transfers left**: "No transfers remaining"

## Testing Scenarios

### Release-Only
1. **Release player when at minimum squad size (11)** → Should fail with error
2. **Release player when above minimum (12+)** → Should succeed, budget increases

### Sign-Only
3. **Sign player when at maximum squad size (15)** → Should fail with error
4. **Sign player when below maximum (14 or less)** → Should succeed if budget allows
5. **Sign player with insufficient budget** → Should fail with budget error

### Swap
6. **Swap players with sufficient budget** → Should work as before
7. **Swap players with insufficient budget** → Should fail with budget error

### Edge Cases
8. **Try to execute with no selection** → Should fail
9. **Try to execute with window closed** → Should fail
10. **Try to execute with no transfers remaining** → Should fail

## Database Schema
No schema changes required. Uses existing:
- `fantasy_leagues.min_squad_size` (default: 11)
- `fantasy_leagues.max_squad_size` (default: 15)
- `fantasy_squad` table
- `fantasy_transfers` table

## Benefits
- More flexible squad management
- Users can trim oversized squads
- Better budget management by releasing expensive players
- Maintains squad size integrity with validation
