# Round Finalization - 3 Phase Process

## Overview
When a round is finalized, the system allocates players to teams using a 3-phase approach to ensure all teams get at least one player, even if they didn't properly submit their bids.

## Phase 1: Regular Auction (Submitted Teams Only)

**Who:** Teams that clicked the "Submit" button  
**How:** Highest bid wins, 1 player per team maximum  
**Price:** Actual bid amount

### Process:
1. Filter bids to only include submitted teams
2. Sort all bids by amount (highest first)
3. Allocate top bid to that team
4. Remove that player AND that team from the pool
5. Repeat until all submitted teams have 1 player or no bids remain

### Tiebreaker Detection:
If multiple teams bid the same amount for the same player:
- Create a tiebreaker round
- Set round status to `tiebreaker_pending`
- Wait for teams to submit new bids
- Re-run finalization after tiebreaker resolves

---

## Phase 2: Random from Team's Bid List (Non-Submitted Teams)

**Who:** Teams that didn't click "Submit" but placed bids  
**How:** Randomly pick from their remaining unallocated bids  
**Price:** Average price from Phase 1  

### Process:
1. Calculate average price: `sum(Phase 1 allocations) / count(Phase 1 allocations)`
2. For each non-submitted team:
   - Get their bids, excluding already-allocated players
   - **Randomly select** one bid from remaining list
   - Allocate that player at average price
   - Mark as `phase: 'incomplete'`

### Example:
```
Team A didn't submit but bid on:
- Player 1: £8,000 ✅ (available)
- Player 2: £7,000 ❌ (allocated in Phase 1)
- Player 3: £6,000 ✅ (available)
- Player 4: £5,000 ✅ (available)

Remaining bids: [Player 1, Player 3, Player 4]
System randomly picks: Player 3
Allocated at: £5,500 (average from Phase 1)
```

---

## Phase 3: Random from Position Pool (Teams Without Players)

**Who:** Teams that still don't have a player after Phase 2  
**Cases:**
- Team didn't submit and all their bids were on allocated players
- Team didn't bid at all

**How:** Randomly pick from entire unsold player pool for that position  
**Price:** Average price from Phase 1

### Process:
1. Query database for unallocated players:
   ```sql
   SELECT id, name, position, position_group
   FROM footballplayers
   WHERE is_auction_eligible = true
     AND is_sold = false
     AND (position = 'CB1' OR position_group = 'CB1')
   ```
2. Filter out players allocated in Phase 1 & 2
3. For each team without a player:
   - Randomly pick from remaining pool
   - Create synthetic bid ID: `synthetic_{teamId}_{playerId}_{timestamp}`
   - Allocate at average price
   - Mark as `phase: 'incomplete'`
   - Remove player from pool

### Position Groups:
- If round position is "CB1", it will also match "CB2" players (same position_group)
- Ensures broader player pool for random allocation

### Example:
```
Team B didn't submit, bid only on Players X, Y, Z
All 3 were allocated in Phase 1

Remaining players in position "CB":
- Player A (CB1)
- Player B (CB2)  
- Player C (CB1)
- Player D (CB2)

System randomly picks: Player B
Allocated at: £5,500 (average from Phase 1)
Synthetic bid ID: synthetic_TEAM001_PLAYER_B_1699999999999
```

---

## Database Updates (All Phases)

### Bid Status Updates:
- **Winning bids:** `status = 'won'`
- **Phase 1 winners:** `phase = 'regular'`
- **Phase 2/3 winners:** `phase = 'incomplete'`
- **Synthetic bids:** No database record (skip bid update)
- **Losing bids:** `status = 'lost'`

### Player Assignment:
```sql
INSERT INTO team_players (team_id, player_id, season_id, round_id, purchase_price, acquired_at) 
VALUES (...)
ON CONFLICT (player_id, season_id) 
DO UPDATE SET team_id = ..., purchase_price = ...
```

### Team Budget Updates:
```sql
UPDATE teams SET 
  football_spent = football_spent + amount, 
  football_budget = football_budget - amount,
  football_players_count = football_players_count + 1
```

### Player Ownership:
```sql
UPDATE footballplayers SET 
  is_sold = true, 
  team_id = ..., 
  acquisition_value = ...,
  contract_id = ...,
  status = 'active'
```

### Round Completion:
```sql
UPDATE rounds SET status = 'completed'
```

---

## Edge Cases Handled

### 1. No teams submitted
- All teams go through Phase 2/3
- Average price defaults to £1,000

### 2. Team with no remaining bids
- Skips Phase 2
- Gets random player in Phase 3

### 3. Not enough players in position pool
- Teams processed in order
- If pool runs out, remaining teams get nothing
- Logged as warning: `⚠️ No more players available for team {teamId}`

### 4. Tiebreaker exists
- Finalization stops immediately
- Round status set to `tiebreaker_pending`
- Must resolve tiebreaker before re-running finalization

---

## Notifications

After successful finalization, notifications sent to:
- **Winners:** "🎉 Player Won! You won {player} for ${amount}"
- **Losers:** "❌ Bid Lost. You lost the bid for {player}"

## Firebase Realtime DB Broadcast

```javascript
{
  type: 'round_finalized',
  status: 'completed',
  round_id: '...',
  allocations_count: 10
}
```

---

## Logging Examples

```
🎯 Starting finalization for round ROUND_001
📊 5 teams submitted bids, 5 teams didn't submit

Phase 1: Regular Auction
✅ Player A → Team 1 (£8,000)
✅ Player B → Team 2 (£7,500)
✅ Player C → Team 3 (£7,000)
✅ Player D → Team 4 (£6,500)
✅ Player E → Team 5 (£6,000)

💰 Average price for non-submitted teams: £7,000

Phase 2: Random from Bid List
🔄 Phase 2: Random allocation Player G → Team 6 (£7,000) - Team didn't submit
🔄 Phase 2: Random allocation Player H → Team 7 (£7,000) - Team didn't submit

Phase 3: Random from Position Pool
🎲 Phase 3: 3 teams need random allocation from position pool
📦 Found 15 unallocated players in position CB
🎲 Phase 3: Random allocation Player X → Team 8 (£7,000) - No bids available
🎲 Phase 3: Random allocation Player Y → Team 9 (£7,000) - No bids available
🎲 Phase 3: Random allocation Player Z → Team 10 (£7,000) - No bids available

💾 Applying finalization results for round ROUND_001
✅ Round finalized successfully
```
