# Simplified Round Finalization Logic

## Overview
The round finalization process has been completely simplified to be more straightforward and easier to understand.

## New Logic Flow

### Step 1: Prepare Bids
1. Fetch all active bids for the round
2. **If tiebreaker was resolved**: Replace the bid amounts with tiebreaker winning amounts
3. Sort all bids by amount (highest first)
4. Separate teams into:
   - **Complete teams**: Teams with exactly required number of bids
   - **Incomplete teams**: Teams with fewer than required bids

### Step 2: Allocate to Complete Teams
```
WHILE (there are bids left AND not all complete teams have players):
  1. Sort remaining bids by amount (DESC)
  2. Get the highest bid
  3. Check if multiple teams bid same amount for same player
  
  IF TIE:
    - Stop finalization
    - Create tiebreaker
    - Return "tie detected"
  
  ELSE:
    - Allocate player to team
    - Remove that player from list
    - Remove that team from list
    - Continue
```

### Step 3: Handle Incomplete Teams
- Calculate average of all winning bids from Step 2
- For each incomplete team:
  - Get their highest bid player that's not sold
  - Allocate player to team at **average amount** (not their bid)

### Step 4: Apply to Database
- Update winning bids as 'won'
- Update losing bids as 'lost'
- Create team_players records
- Update team budgets
- Mark players as sold
- Mark round as 'completed'

## Tiebreaker Resolution Flow

### When Tie is Detected:
1. Finalization stops immediately
2. Tiebreaker created with all tied teams
3. Round status stays 'active'
4. Teams submit new bids

### When Teams Submit Tiebreaker Bids:
1. Last team submits → **Auto-resolves immediately**
2. If still tied → Creates new tiebreaker automatically
3. If clear winner → Marks tiebreaker as 'resolved'

### When Last Team Submits Tiebreaker Bid:
1. **Automatically resolves tiebreaker**
2. **Automatically triggers round finalization**
3. System loads bids and **replaces amounts** with tiebreaker winners
   - Example: Team A originally bid £100k, won tiebreaker at £120k
   - System uses £120k as Team A's bid amount
4. Re-runs allocation from Step 1
5. If tie resolved → round completes automatically
6. If another tie → new tiebreaker created, repeat process

## Key Simplifications

### ❌ Removed:
- Complex two-phase allocation system
- Separate handling of "regular" vs "incomplete" during main loop
- Manual tiebreaker winner lookup during allocation

### ✅ Added:
- Tiebreaker amounts **replace original bids** before allocation starts
- Single-pass allocation (one loop, simpler logic)
- Automatic tiebreaker resolution on last team submission

## Example Workflow

### Scenario: 3 teams bid £100k for Player A

**First Finalization Attempt:**
```
1. Admin clicks "Finalize Round"
2. System sorts bids:
   - Team A: £100k for Player A
   - Team B: £100k for Player A  
   - Team C: £100k for Player A
3. Detects tie → Creates Tiebreaker TB1
4. Returns: "Tie detected - resolve tiebreaker"
5. Round stays 'active'
```

**Tiebreaker Resolution:**
```
1. Team A submits £120k
2. Team B submits £110k
3. Team C submits £120k → Auto-resolves!
4. Result: Another tie detected
5. System marks TB1 as 'tied_again'
6. Creates new Tiebreaker TB2 for Teams A & C
```

**Second Tiebreaker:**
```
1. Team A submits £125k
2. Team C submits £130k → Auto-resolves!
3. Result: Team C wins
4. TB2 marked as 'resolved'
   - winning_team_id: Team C
   - winning_amount: £130k
```

**Automatic Finalization (No Admin Click!):**
```
1. When Team C submits £130k → TRIGGERS AUTO-FINALIZATION
2. System loads resolved tiebreakers:
   - TB2: Player A → Team C won at £130k
3. Replaces bid amounts:
   - Team A: £100k → (original, no change)
   - Team B: £100k → (original, no change)
   - Team C: £100k → £130k (REPLACED)
4. Re-sorts bids:
   - Team C: £130k for Player A ← HIGHEST
   - Team A: £120k for Player B
   - ...
5. Allocates:
   - Player A → Team C for £130k
   - Player B → Team A for £120k
   - ...
6. Round marked 'completed' automatically! ✅
7. Admin sees: "Round finalized successfully"
```

## Database Impact

### Tiebreakers Table:
```sql
-- When tie detected
INSERT INTO tiebreakers (round_id, player_id, original_amount, status)
VALUES ('round-1', 'player-a', 100000, 'active');

-- When resolved
UPDATE tiebreakers
SET status = 'resolved',
    winning_team_id = 'team-c',
    winning_amount = 130000,
    resolved_at = NOW()
WHERE id = 'tb-2';
```

### Bids Table:
- Original bid amounts stay unchanged
- Tiebreaker winner stored separately in tiebreakers table
- When allocating, system uses tiebreaker amount if exists

### Benefits of This Approach:
✅ **Audit trail preserved** - original bids never modified  
✅ **Idempotent** - can re-finalize multiple times safely  
✅ **Simple logic** - one allocation pass, clear flow  
✅ **Automatic** - no manual admin work for tiebreakers  

## Code Changes Summary

### `lib/finalize-round.ts`:
1. **Load resolved tiebreakers** → create replacement map
2. **When decrypting bids** → replace amounts if tiebreaker resolved
3. **Single allocation loop** → no more two-phase system
4. **Simpler tie detection** → check at top bid only

### `app/api/tiebreakers/[id]/submit/route.ts`:
1. After each submission → check if all teams submitted
2. If yes → auto-call `resolveTiebreaker()`
3. Return resolution status to frontend

### `app/dashboard/committee/rounds/page.tsx`:
1. Fetch tiebreakers with statuses: `'active'` and `'tied_again'`
2. Display them under active rounds

## Migration Notes

- **No database changes required**
- Existing tiebreakers work as-is
- Old finalization logic completely replaced
- All features backward-compatible
