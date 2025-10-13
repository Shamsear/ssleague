# Bulk Bidding - Requirements Summary

## ✅ Confirmed Requirements

### 1. Tiebreaker Duration
- **NO TIMER**: Auction runs until only 1 team remains
- **Inactivity Timeout**: 3 hours of no activity → Admin can force-finalize
- **Maximum Duration**: 24 hours (safety limit)
- **Admin Controls**: Can force-finalize at any time

### 2. Tiebreaker Start Sequence
- **One at a time** (not batch)
- **Reason**: Same teams may be in multiple tiebreakers
- **Admin controls**: Which tiebreaker to start next

### 3. Payment Logic (CRITICAL)

#### During Bulk Round:
```
Team selects 5 players at £10 each
→ Balance check: £50 available? ✓
→ NO MONEY DEDUCTED YET (just reservation)
→ Bids recorded in database
```

#### After Round Finalization:
```
Player A: 1 bidder (Team X)
→ Assign immediately to Team X
→ Deduct £10 from Team X
→ Status: SOLD

Player B: 3 bidders (Teams X, Y, Z)
→ Create tiebreaker
→ NO DEDUCTIONS YET
→ Teams X, Y, Z enter open auction
```

#### After Tiebreaker:
```
Winner (Team Y) bid: £35
→ Deduct £35 from Team Y (NOT £10)
→ Assign player to Team Y
→ Status: SOLD

Losers (Teams X, Z):
→ NO DEDUCTIONS (they never paid)
→ Reservation released
→ Can use budget elsewhere
```

### 4. Squad Limit Validation
- **Max squad size**: 25 players
- **Validation**: Check before accepting bids
```typescript
current_squad_count = 20
available_slots = 25 - 20 = 5
team_tries_to_bid_on = 7 players
→ REJECT (exceeds available slots)
```

### 5. Immediate Assignment
- Players with **single bidder** = assigned immediately
- Players with **multiple bidders** = go to tiebreaker
- **NO waiting** for tiebreakers to resolve before assigning singles

### 6. Real-time Updates (WebSocket)
- **Technology**: WebSocket (not polling)
- **Use case**: Live auction bidding
- **Updates**:
  - New bid placed
  - Current highest bid
  - Time remaining
  - Auction ended

### 7. Bid Increment
- **No minimum increment**
- Any amount higher than current bid is valid
```
Current bid: £15
Valid bids: £16, £17, £20, £100, etc.
Invalid: £15, £14, £10
```

### 7.5 Withdrawal Rules (CRITICAL)
- **Only non-highest bidders can withdraw**
- **Highest bidder is LOCKED IN** (cannot withdraw)
- **Withdrawal is immediate and permanent**
- **If you were highest, then someone outbids you → You CAN NOW withdraw**
```
Example:
Team A bids £20 (highest) → CANNOT withdraw
Team B bids £25 (new highest) → CANNOT withdraw
Team A is no longer highest → CAN NOW withdraw
```

### 8. Tiebreaker Flow (Last Person Standing)
```
1. Admin clicks "Start Tiebreaker #1"
2. All involved teams see auction (NO TIMER)
3. Teams can:
   - Raise bid (must be higher than current highest)
   - Withdraw (ONLY if they're NOT the highest bidder)
4. Current highest bidder CANNOT withdraw
5. When team withdraws → Removed immediately
6. Auction continues until only 1 team remains
7. Last team standing = WINNER (pays their bid)
8. Safety: If 3 hours no activity → Admin notified
9. Safety: Max 24 hours → Admin must force-finalize
10. Admin clicks "Finalize" or system auto-finalizes
11. Repeat for Tiebreaker #2, #3, etc.
```

---

## 🗄️ Database Changes Needed

### New Tables
```sql
-- Bulk Tiebreakers (Last Person Standing)
CREATE TABLE bulk_tiebreakers (
    id SERIAL PRIMARY KEY,
    round_id INTEGER,
    player_id VARCHAR(255),
    player_name VARCHAR(255),
    position VARCHAR(50),
    base_price INTEGER DEFAULT 10,
    status VARCHAR(20) DEFAULT 'pending', -- pending, active, resolved, cancelled
    current_highest_bid INTEGER DEFAULT 10,
    current_highest_team_id VARCHAR(255),
    teams_remaining INTEGER, -- Count of active teams
    start_time TIMESTAMP,
    last_activity_time TIMESTAMP, -- For 3-hour inactivity check
    max_end_time TIMESTAMP, -- Start + 24 hours (safety limit)
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Tiebreaker Bids
CREATE TABLE bulk_tiebreaker_bids (
    id SERIAL PRIMARY KEY,
    tiebreaker_id INTEGER,
    team_id VARCHAR(255),
    team_name VARCHAR(255),
    bid_amount INTEGER,
    bid_time TIMESTAMP DEFAULT NOW()
);

-- Team Participation in Tiebreaker
CREATE TABLE bulk_tiebreaker_teams (
    id SERIAL PRIMARY KEY,
    tiebreaker_id INTEGER,
    team_id VARCHAR(255),
    team_name VARCHAR(255),
    status VARCHAR(20) DEFAULT 'active', -- active, withdrawn
    withdrawn_at TIMESTAMP,
    joined_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🔌 API Endpoints Summary

### Admin APIs (8 endpoints)
1. `POST /api/admin/bulk-rounds` - Create bulk round with ALL players
2. `POST /api/admin/bulk-rounds/:id/start` - Start round
3. `POST /api/admin/bulk-rounds/:id/finalize` - Detect conflicts, create tiebreakers
4. `GET /api/admin/bulk-tiebreakers` - List all tiebreakers
5. `POST /api/admin/bulk-tiebreakers/:id/start` - Start one tiebreaker
6. `POST /api/admin/bulk-tiebreakers/:id/force-finalize` - Force end (after inactivity/24hr)
7. `POST /api/admin/bulk-rounds/:id/complete` - Complete entire round
8. `GET /api/admin/bulk-rounds/:id` - View round details

### Team APIs (4 endpoints)
1. `GET /api/team/bulk-rounds/:id` - View available players
2. `POST /api/team/bulk-rounds/:id/bids` - Submit multiple bids at once
3. `POST /api/team/bulk-tiebreakers/:id/bid` - Place higher bid
4. `POST /api/team/bulk-tiebreakers/:id/withdraw` - Withdraw (only if not highest)

### WebSocket
- `ws://server/tiebreaker/:id` - Real-time auction updates

---

## 💰 Money Flow Examples

### Example 1: No Conflict
```
Team Balance: £1000
Bids on: Player A (£10)
Result: Single bidder
→ Player assigned immediately
→ New Balance: £990
```

### Example 2: Conflict - Winner
```
Team Balance: £1000
Bids on: Player B (£10)
Result: 3 teams bid (tiebreaker)
Auction: Team wins at £45
→ Player assigned after auction
→ New Balance: £955
```

### Example 3: Conflict - Loser
```
Team Balance: £1000
Bids on: Player C (£10)
Result: 3 teams bid (tiebreaker)
Auction: Team loses (bid £30, someone bid £35)
→ Player NOT assigned
→ New Balance: £1000 (no deduction)
```

### Example 4: Multiple Bids Mixed
```
Team Balance: £1000
Bids on: 
  - Player A (£10) - single bidder → WIN
  - Player B (£10) - conflict → LOSE at auction
  - Player C (£10) - conflict → WIN at £25

Result:
→ Got Player A for £10
→ Got Player C for £25
→ Lost Player B (no cost)
→ New Balance: £1000 - £10 - £25 = £965
```

### Example 5: Last Person Standing (Detailed)
```
Tiebreaker for Player X:
3 teams: A, B, C (all bid £10 in bulk round)

[Start]
Team A: Active at £10
Team B: Active at £10  
Team C: Active at £10
No highest bidder yet

[Minute 5]
Team A bids £20
Team A: Active at £20 (HIGHEST - cannot withdraw)
Team B: Active at £10 (can bid or withdraw)
Team C: Active at £10 (can bid or withdraw)

[Minute 10]
Team B withdraws
Team A: Active at £20 (HIGHEST)
Team B: WITHDRAWN
Team C: Active at £10 (can bid or withdraw)

[Minute 15]
Team C bids £30
Team A: Active at £20 (no longer highest - CAN NOW withdraw)
Team B: WITHDRAWN  
Team C: Active at £30 (HIGHEST - cannot withdraw)

[Minute 20]
Team A withdraws
Team A: WITHDRAWN
Team B: WITHDRAWN
Team C: Active at £30 (ONLY ONE LEFT)

→ AUCTION AUTO-ENDS
→ Team C WINS Player X for £30
→ Team C pays £30
→ Teams A and B pay nothing
```

---

## 📋 Implementation Checklist

### Phase 1: Database (Day 1 - Morning)
- [ ] Create `bulk_tiebreakers` table
- [ ] Create `bulk_tiebreaker_bids` table
- [ ] Test schema with sample data

### Phase 2: Bulk Round APIs (Day 1 - Afternoon)
- [ ] Create bulk round (auto-add ALL players)
- [ ] Start bulk round
- [ ] Team submit bids (with squad limit check)
- [ ] Finalize round (detect conflicts)

### Phase 3: Tiebreaker APIs (Day 2 - Morning)
- [ ] List tiebreakers
- [ ] Start single tiebreaker
- [ ] Extend tiebreaker time (admin)
- [ ] Team place bid
- [ ] Finalize tiebreaker (assign winner)

### Phase 4: WebSocket (Day 2 - Afternoon)
- [ ] WebSocket server setup
- [ ] Client connection logic
- [ ] Broadcast bid updates
- [ ] Handle disconnections

### Phase 5: Payment Logic (Day 3 - Morning)
- [ ] Immediate assignment (single bidder)
- [ ] Deduct base price (£10) for singles
- [ ] Deduct final bid for tiebreaker winners
- [ ] Squad count updates

### Phase 6: UI Updates (Day 3 - Afternoon)
- [ ] Team: Bulk round bidding interface
- [ ] Team: Tiebreaker auction interface
- [ ] Admin: Tiebreaker management
- [ ] Real-time UI updates

### Phase 7: Testing (Day 4)
- [ ] End-to-end test
- [ ] Multiple teams scenario
- [ ] Edge cases (timer expiry, disconnects)
- [ ] Payment calculations

**Estimated Total: 3-4 days**

---

## 🎯 Critical Success Factors

1. **Payment accuracy**: No money lost or duplicated
2. **Squad limit**: Never exceed 25 players
3. **WebSocket stability**: Handle disconnects gracefully
4. **One tiebreaker at a time**: Prevent conflicts
5. **Immediate assignment**: Don't make teams wait unnecessarily

---

## ⚠️ Edge Cases to Handle

1. **Team disconnects during auction**: 
   - Preserve their last bid and active status
   - They can reconnect and continue
   - If they were highest → Still cannot withdraw

2. **Highest bidder tries to withdraw**: 
   - API rejects with error: "Cannot withdraw while highest bidder"
   - UI disables withdraw button

3. **Team tries to bid more than balance**: 
   - Reject with error message
   - Show available balance in UI

4. **Two bids at exact same millisecond**: 
   - First timestamp (microseconds) wins
   - Other bid rejected as "not higher than current"

5. **Team already at 25 players**: 
   - Reject all bulk bids
   - Show squad limit warning

6. **All teams but one withdraw immediately**: 
   - Last team wins at their current bid (£10 if no bids placed)
   - Auto-finalize instantly

7. **3 hours inactivity timeout**: 
   - System sends notification to admin
   - Admin dashboard shows "Stalled" status
   - Admin can force-finalize to current highest bidder

8. **24 hour maximum duration reached**: 
   - System auto-flags for admin
   - Admin MUST force-finalize
   - Winner = current highest bidder at 24hr mark

9. **Highest bidder disconnects and never returns**: 
   - After 3 hours inactivity → Admin notified
   - Admin can force-finalize to that team
   - They pay their bid amount (they were committed)

10. **Team withdraws then tries to rejoin**: 
    - API rejects: "Already withdrawn"
    - Withdrawal is permanent

11. **Admin force-finalizes before auto-end**: 
    - Winner = current highest bidder
    - All active teams notified
    - Payment processed normally

---

## 🚀 Ready to Implement?

Review this document, and when ready, we'll proceed with:
1. Database migration SQL file
2. API implementation (one phase at a time)
3. WebSocket setup
4. UI integration
5. Testing

**Next Step**: Create database migration → Start Phase 1
