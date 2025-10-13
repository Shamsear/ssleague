# Round Finalization with Tiebreakers - Detailed Flow

## Complete Example Scenario

Let's walk through a complete example with 3 teams bidding in a Goalkeeper (GK) round.

---

## STEP 1: Teams Place Bids

### Round Configuration:
- **Position:** GK
- **Max bids per team:** 5
- **Duration:** 2 hours
- **Status:** active

### Teams Place Their Bids:

**Team A** (Manchester United):
1. Player 1 (David De Gea) - £100
2. Player 2 (Alisson) - £90
3. Player 3 (Ederson) - £85
4. Player 4 (Courtois) - £80
5. Player 5 (Ter Stegen) - £75

**Team B** (Liverpool):
1. Player 1 (David De Gea) - £100 ← **TIE!**
2. Player 6 (Donnarumma) - £88
3. Player 7 (Maignan) - £82
4. Player 8 (Ramsdale) - £77
5. Player 9 (Martinez) - £70

**Team C** (Chelsea):
1. Player 10 (Mendy) - £95
2. Player 11 (Pickford) - £89
3. Player 12 (Lloris) - £84
4. Player 13 (Schmeichel) - £79
5. Player 14 (Leno) - £74

### Database State (bids table):
```sql
| id   | team_id | player_id | amount | status  | round_id |
|------|---------|-----------|--------|---------|----------|
| b1   | team-a  | player-1  | 100    | active  | round-1  |
| b2   | team-a  | player-2  | 90     | active  | round-1  |
| b3   | team-a  | player-3  | 85     | active  | round-1  |
| b4   | team-a  | player-4  | 80     | active  | round-1  |
| b5   | team-a  | player-5  | 75     | active  | round-1  |
| b6   | team-b  | player-1  | 100    | active  | round-1  | ← TIE
| b7   | team-b  | player-6  | 88     | active  | round-1  |
| b8   | team-b  | player-7  | 82     | active  | round-1  |
| b9   | team-b  | player-8  | 77     | active  | round-1  |
| b10  | team-b  | player-9  | 70     | active  | round-1  |
| b11  | team-c  | player-10 | 95     | active  | round-1  |
| b12  | team-c  | player-11 | 89     | active  | round-1  |
| b13  | team-c  | player-12 | 84     | active  | round-1  |
| b14  | team-c  | player-13 | 79     | active  | round-1  |
| b15  | team-c  | player-14 | 74     | active  | round-1  |
```

---

## STEP 2: Admin Clicks "Finalize Round"

### What Happens in `finalizeRound()`:

1. **Get round details** ✅
   ```javascript
   round = { id: 'round-1', position: 'GK', max_bids_per_team: 5 }
   ```

2. **Check for resolved tiebreakers** ✅
   ```sql
   SELECT * FROM tiebreakers WHERE round_id = 'round-1' AND status = 'resolved'
   ```
   **Result:** No resolved tiebreakers yet (empty array)

3. **Get all active bids** ✅
   ```javascript
   bids = [
     { id: 'b1', team_id: 'team-a', player_id: 'player-1', amount: 100 },
     { id: 'b6', team_id: 'team-b', player_id: 'player-1', amount: 100 },
     { id: 'b11', team_id: 'team-c', player_id: 'player-10', amount: 95 },
     { id: 'b2', team_id: 'team-a', player_id: 'player-2', amount: 90 },
     ... // sorted by amount descending
   ]
   ```

4. **Process bids in order** 🔄

   **First bid:** `player-1, £100`
   
   - Check: Does player-1 have a resolved tiebreaker? **NO**
   - Check: Are there other bids with same amount (£100)?
     ```javascript
     tiedBids = [
       { id: 'b1', team_id: 'team-a', player_id: 'player-1', amount: 100 },
       { id: 'b6', team_id: 'team-b', player_id: 'player-1', amount: 100 }
     ]
     ```
   - **TIE DETECTED! ⚠️**

5. **Create Tiebreaker** 🎯
   ```javascript
   createTiebreaker(
     roundId: 'round-1',
     playerId: 'player-1',
     tiedBids: [b1, b6]
   )
   ```

6. **Stop Finalization** ❌
   ```javascript
   return {
     success: false,
     tieDetected: true,
     tiebreakerId: 'tb-123',
     error: 'Tie detected between bids'
   }
   ```

### Database State After:

**tiebreakers table:**
```sql
| id     | round_id | player_id | original_amount | status | winning_team_id | winning_amount |
|--------|----------|-----------|-----------------|--------|-----------------|----------------|
| tb-123 | round-1  | player-1  | 100             | active | NULL            | NULL           |
```

**team_tiebreakers table:**
```sql
| id   | tiebreaker_id | team_id | original_bid_id | submitted | new_bid_amount |
|------|---------------|---------|-----------------|-----------|----------------|
| tt-1 | tb-123        | team-a  | b1              | false     | NULL           |
| tt-2 | tb-123        | team-b  | b6              | false     | NULL           |
```

**rounds table:**
```sql
| id      | status | ... |
|---------|--------|-----|
| round-1 | active | ... | ← Still active because finalization failed
```

---

## STEP 3: Teams Submit Tiebreaker Bids

### Team A's Action:
- Opens tiebreaker page: `/dashboard/team/tiebreaker/tb-123`
- Sees: "Your bid of £100 for Player 1 (David De Gea) is tied"
- Submits new bid: **£120**

**API Call:**
```http
POST /api/tiebreakers/tb-123/submit
Body: { "newBidAmount": 120 }
```

**Database Update:**
```sql
UPDATE team_tiebreakers
SET new_bid_amount = 120, submitted = true, submitted_at = NOW()
WHERE id = 'tt-1'
```

### Team B's Action:
- Opens tiebreaker page: `/dashboard/team/tiebreaker/tb-123`
- Sees: "Your bid of £100 for Player 1 (David De Gea) is tied"
- Submits new bid: **£110**

**API Call:**
```http
POST /api/tiebreakers/tb-123/submit
Body: { "newBidAmount": 110 }
```

**Database Update:**
```sql
UPDATE team_tiebreakers
SET new_bid_amount = 110, submitted = true, submitted_at = NOW()
WHERE id = 'tt-2'
```

### Database State After Both Submit:

**team_tiebreakers table:**
```sql
| id   | tiebreaker_id | team_id | original_bid_id | submitted | new_bid_amount |
|------|---------------|---------|-----------------|-----------|----------------|
| tt-1 | tb-123        | team-a  | b1              | TRUE      | 120            |
| tt-2 | tb-123        | team-b  | b6              | TRUE      | 110            |
```

**tiebreakers table** (still):
```sql
| id     | round_id | player_id | original_amount | status | winning_team_id | winning_amount |
|--------|----------|-----------|-----------------|--------|-----------------|----------------|
| tb-123 | round-1  | player-1  | 100             | active | NULL            | NULL           |
```

---

## STEP 4: Admin Resolves Tiebreaker

### Admin Actions:
1. Goes to: `/dashboard/committee/rounds` or `/dashboard/committee/tiebreakers`
2. Sees tiebreaker `tb-123` with 2/2 teams submitted
3. Clicks "Resolve Tiebreaker" (automatic resolution)

### What Happens in `resolveTiebreaker()`:

1. **Get tiebreaker details** ✅
2. **Get all submitted bids** ✅
   ```javascript
   teamBids = [
     { team_id: 'team-a', new_bid_amount: 120 },
     { team_id: 'team-b', new_bid_amount: 110 }
   ]
   ```

3. **Sort by amount (highest first)** ✅
   ```javascript
   sorted = [
     { team_id: 'team-a', new_bid_amount: 120 }, // Winner!
     { team_id: 'team-b', new_bid_amount: 110 }
   ]
   ```

4. **Check for another tie** ✅
   ```javascript
   tiedNewBids = teamBids.filter(bid => bid.new_bid_amount === 120)
   // Result: Only 1 bid (no tie)
   ```

5. **Mark as resolved** ✅
   ```sql
   UPDATE tiebreakers
   SET 
     status = 'resolved',
     winning_team_id = 'team-a',
     winning_amount = 120,
     resolved_at = NOW()
   WHERE id = 'tb-123'
   ```

### Database State After Resolution:

**tiebreakers table:**
```sql
| id     | round_id | player_id | original_amount | status   | winning_team_id | winning_amount |
|--------|----------|-----------|-----------------|----------|-----------------|----------------|
| tb-123 | round-1  | player-1  | 100             | resolved | team-a          | 120            |
```

---

## STEP 5: Admin Clicks "Finalize Round" Again

### What Happens in `finalizeRound()` (UPDATED CODE):

1. **Get round details** ✅

2. **Check for resolved tiebreakers** ✅ **← NEW!**
   ```sql
   SELECT * FROM tiebreakers WHERE round_id = 'round-1' AND status = 'resolved'
   ```
   **Result:**
   ```javascript
   resolvedTiebreakers = [
     {
       id: 'tb-123',
       player_id: 'player-1',
       winning_team_id: 'team-a',
       winning_amount: 120
     }
   ]
   ```

3. **Create tiebreaker winners map** ✅ **← NEW!**
   ```javascript
   tiebreakerWinners = Map {
     'player-1' => { team_id: 'team-a', amount: 120 }
   }
   ```

4. **Get all active bids** ✅

5. **Process bids in order** 🔄

   **First bid:** `player-1, £100`
   
   - **Check: Does player-1 have a resolved tiebreaker?** ✅ **YES!** **← NEW!**
     ```javascript
     tiebreakerWinner = { team_id: 'team-a', amount: 120 }
     ```
   
   - **Use tiebreaker winner!** 🏆
     ```javascript
     allocations.push({
       team_id: 'team-a',
       team_name: 'Manchester United',
       player_id: 'player-1',
       player_name: 'David De Gea',
       amount: 120, // ← Tiebreaker winning amount
       bid_id: 'b1',
       phase: 'regular'
     })
     ```
   
   - **Mark as allocated** ✅
     ```javascript
     allocatedPlayers.add('player-1')
     allocatedTeams.add('team-a')
     ```
   
   - **Remove bids for this player and team** ✅
   - **Continue with next bid** → **NO TIE DETECTION!** ✅

   **Second bid:** `player-10, £95` (Team C)
   
   - Check: Does player-10 have a resolved tiebreaker? **NO**
   - Check: Are there other bids with same amount? **NO**
   - **Allocate normally:**
     ```javascript
     allocations.push({
       team_id: 'team-c',
       player_id: 'player-10',
       amount: 95
     })
     ```

   **Continue processing all bids...**

6. **Final allocations:**
   ```javascript
   allocations = [
     { team_id: 'team-a', player_id: 'player-1', amount: 120 }, // ← From tiebreaker
     { team_id: 'team-c', player_id: 'player-10', amount: 95 },
     { team_id: 'team-a', player_id: 'player-2', amount: 90 },
     { team_id: 'team-c', player_id: 'player-11', amount: 89 },
     { team_id: 'team-b', player_id: 'player-6', amount: 88 }
     // ... etc
   ]
   ```

7. **Apply finalization results** ✅
   - Update bids status: 'won' or 'lost'
   - Create team_players records
   - Deduct budget from team_seasons
   - Update round status to 'completed'

8. **Return success** ✅
   ```javascript
   return {
     success: true,
     allocations: allocations,
     tieDetected: false
   }
   ```

---

## Final Database State

**bids table:**
```sql
| id  | team_id | player_id  | amount | status | round_id |
|-----|---------|------------|--------|--------|----------|
| b1  | team-a  | player-1   | 100    | won    | round-1  | ← Won via tiebreaker!
| b6  | team-b  | player-1   | 100    | lost   | round-1  | ← Lost tiebreaker
| b11 | team-c  | player-10  | 95     | won    | round-1  |
| b2  | team-a  | player-2   | 90     | won    | round-1  |
| ... | ...     | ...        | ...    | ...    | ...      |
```

**team_players table:**
```sql
| id  | team_id | player_id  | purchase_price |
|-----|---------|------------|----------------|
| tp1 | team-a  | player-1   | 120            | ← Paid £120 (tiebreaker)
| tp2 | team-c  | player-10  | 95             |
| tp3 | team-a  | player-2   | 90             |
| ... | ...     | ...        | ...            |
```

**team_seasons table (budget updated):**
```sql
| id                  | team_id | season_id | budget  |
|---------------------|---------|-----------|---------|
| team-a_season-2024  | team-a  | season-24 | 14790   | ← 15000 - 120 - 90 = 14790
| team-b_season-2024  | team-b  | season-24 | 14912   | ← Paid £88
| team-c_season-2024  | team-c  | season-24 | 14816   | ← 15000 - 95 - 89 = 14816
```

**rounds table:**
```sql
| id      | status    |
|---------|-----------|
| round-1 | completed | ← Round finished!
```

---

## Summary of Key Points

1. **First finalization:** Detects tie, creates tiebreaker, STOPS
2. **Teams submit tiebreaker bids:** Updates team_tiebreakers table
3. **Admin resolves tiebreaker:** Updates tiebreakers table with winner
4. **Second finalization:** 
   - ✅ Checks for resolved tiebreakers FIRST
   - ✅ Uses tiebreaker winner instead of checking for ties
   - ✅ Continues with normal allocation
   - ✅ Round completes successfully

---

## Possible Issues to Check

If finalization is still not working, check:

1. **Is tiebreaker status 'resolved'?**
   ```sql
   SELECT status, winning_team_id, winning_amount FROM tiebreakers WHERE id = 'tb-123'
   ```
   Should be: `status = 'resolved'`, winning_team_id and winning_amount NOT NULL

2. **Are you clicking "Finalize Round" again after resolving?**
   You must click "Finalize Round" a second time after tiebreakers are resolved

3. **Check console logs:**
   Look for: `"✅ Found X resolved tiebreakers"` and `"🏆 Using tiebreaker winner"`

4. **Is round still 'active'?**
   ```sql
   SELECT status FROM rounds WHERE id = 'round-1'
   ```
   Should still be 'active' after first finalization attempt

---

## Date
2025-10-05

## Status
✅ Code updated to handle resolved tiebreakers
