# Bulk Bidding Round - Implementation Plan

## Overview
Implement a complete Bulk Bidding Round system where:
- **ALL football players** are available in one round
- Teams bid **£10 (fixed base price)** on as many players as they want
- **Conflicts resolved** via open auction tiebreaker
- **Efficient player distribution** to all teams

---

## ⚡ Key Requirements (Confirmed)

1. **Tiebreaker Duration**: 3 hours default (10800 seconds)
2. **Timer Extension**: No automatic extension. Admin can manually extend if needed
3. **Tiebreaker Start**: One at a time (same teams may be in multiple tiebreakers)
4. **Payment Logic**: 
   - During bulk round: Teams DON'T pay £10 yet (just reserve)
   - After tiebreaker: Winner pays their FINAL bid amount (not £10)
   - Losers: Nothing deducted (reservation released)
5. **Squad Limit**: Teams can only bid up to 25 players total (or remaining slots)
6. **Immediate Assignment**: Players with single bidder assigned immediately (no wait)
7. **Real-time Updates**: WebSocket for live auction updates
8. **Bid Increment**: No minimum increment - any amount higher than current bid

---

## Current Status

### ✅ Already Implemented
1. Committee bulk rounds management page (`/dashboard/committee/bulk-rounds/page.tsx`)
2. Database schema for `auction_rounds` with `round_type: 'bulk'`
3. Team bulk round bidding page (`/dashboard/team/bulk-round/[id]/page.tsx`)
4. Basic tiebreaker structure

### ❌ Missing / Needs Fixing
1. **Backend API** for creating bulk rounds with ALL players
2. **Bulk bid submission** API 
3. **Tiebreaker detection** when multiple teams bid same player
4. **Open auction tiebreaker** implementation
5. **Finalization logic** for bulk rounds
6. Database tables for bulk-specific data

---

## Database Schema Required

### 1. Use Existing `auction_rounds` table
```sql
-- Already exists, just use round_type = 'bulk'
INSERT INTO auction_rounds (
  season_id,
  round_number,
  round_type,
  base_price,
  status,
  duration_seconds
) VALUES (
  'season_id_here',
  1,
  'bulk',  -- Key difference
  10,
  'draft',
  300
);
```

### 2. Use Existing `round_players` table
```sql
-- Auto-populate with ALL players when bulk round created
INSERT INTO round_players (round_id, player_id, player_name, position, base_price)
SELECT 
  :round_id,
  id,
  name,
  position,
  10  -- Fixed base price
FROM footballplayers
WHERE is_auction_eligible = true
  AND is_sold = false
  AND season_id = :season_id;
```

### 3. Use Existing `round_bids` table
```sql
-- Teams place multiple bids at once
INSERT INTO round_bids (round_id, player_id, team_id, bid_amount)
VALUES 
  (:round_id, 'player1', 'team1', 10),
  (:round_id, 'player2', 'team1', 10),
  (:round_id, 'player3', 'team1', 10);
```

### 4. Create `bulk_tiebreakers` table (NEW)
```sql
CREATE TABLE IF NOT EXISTS bulk_tiebreakers (
    id SERIAL PRIMARY KEY,
    round_id INTEGER REFERENCES auction_rounds(id) ON DELETE CASCADE,
    player_id VARCHAR(255) NOT NULL,
    player_name VARCHAR(255),
    position VARCHAR(50),
    base_price INTEGER DEFAULT 10,
    status VARCHAR(20) DEFAULT 'pending', -- pending, active, resolved
    current_highest_bid INTEGER,
    current_highest_team_id VARCHAR(255),
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    duration_seconds INTEGER DEFAULT 10800, -- 3 hour open auction (can be extended by admin)
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(round_id, player_id)
);

-- Track bids in open auction
CREATE TABLE IF NOT EXISTS bulk_tiebreaker_bids (
    id SERIAL PRIMARY KEY,
    tiebreaker_id INTEGER REFERENCES bulk_tiebreakers(id) ON DELETE CASCADE,
    team_id VARCHAR(255) NOT NULL,
    team_name VARCHAR(255),
    bid_amount INTEGER NOT NULL,
    bid_time TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_bulk_tiebreakers_round ON bulk_tiebreakers(round_id);
CREATE INDEX idx_bulk_tiebreakers_status ON bulk_tiebreakers(status);
CREATE INDEX idx_bulk_tiebreaker_bids_tiebreaker ON bulk_tiebreaker_bids(tiebreaker_id);
```

---

## API Endpoints Needed

### 1. Create Bulk Round
**Endpoint:** `POST /api/admin/bulk-rounds`

**Request:**
```json
{
  "season_id": "season123",
  "base_price": 10,
  "duration_seconds": 300
}
```

**Logic:**
1. Create round in `auction_rounds` with `round_type='bulk'`
2. Fetch ALL eligible players from `footballplayers`
3. Insert all players into `round_players`
4. Return round details

**Response:**
```json
{
  "success": true,
  "data": {
    "round_id": 42,
    "player_count": 250,
    "base_price": 10
  }
}
```

---

### 2. Start Bulk Round
**Endpoint:** `POST /api/admin/bulk-rounds/:id/start`

**Logic:**
1. Set `status='active'`
2. Set `start_time=NOW()`
3. Set `end_time=NOW() + duration_seconds`
4. Notify all teams

---

### 3. Submit Bulk Bids (Team Side)
**Endpoint:** `POST /api/team/bulk-rounds/:id/bids`

**Request:**
```json
{
  "player_ids": ["player1", "player2", "player3"],
  "team_id": "team123"
}
```

**Logic:**
1. Get team's current squad count
2. Calculate available slots (25 - current_squad_count)
3. Validate: requested bids <= available_slots
4. Validate team balance (count * 10) - just for reservation check
5. Insert bids into `round_bids`
6. Return confirmation

**Response:**
```json
{
  "success": true,
  "data": {
    "bids_placed": 3,
    "total_cost": 30,
    "remaining_balance": 970
  }
}
```

---

### 4. Finalize Bulk Round (Committee)
**Endpoint:** `POST /api/admin/bulk-rounds/:id/finalize`

**Logic:**
1. Check if round time expired or manual finalize
2. **Analyze conflicts:**
   ```sql
   SELECT player_id, COUNT(DISTINCT team_id) as team_count
   FROM round_bids
   WHERE round_id = :round_id
   GROUP BY player_id
   HAVING COUNT(DISTINCT team_id) > 1;
   ```

3. **For each conflict:**
   - Create entry in `bulk_tiebreakers`
   - Set `status='pending'`
   - List all teams involved

4. **For non-conflicts (single bidder):**
   - Immediately assign player
   - Update `round_players.winning_team_id`
   - Update `round_players.winning_bid=10`
   - Update `round_players.status='sold'`
   - Deduct £10 from team balance (no conflict = pay base price)
   - Update team's current squad count

5. **For conflicts:**
   - DON'T deduct money yet (just track reservation)
   - Teams only pay after tiebreaker resolves

6. Set round `status='pending_tiebreakers'`

**Response:**
```json
{
  "success": true,
  "data": {
    "immediately_assigned": 180,
    "conflicts": 70,
    "tiebreakers_created": 70
  }
}
```

---

### 5. Start Tiebreaker Auction
**Endpoint:** `POST /api/admin/bulk-tiebreakers/:id/start`

**Logic:**
1. Set `status='active'`
2. Set `start_time=NOW()`
3. Set `end_time=NOW() + duration_seconds` (e.g., 3 minutes)
4. Set `current_highest_bid=10`
5. Notify involved teams

---

### 6. Place Tiebreaker Bid (Team Side)
**Endpoint:** `POST /api/team/bulk-tiebreakers/:id/bid`

**Request:**
```json
{
  "bid_amount": 15,
  "team_id": "team123"
}
```

**Logic:**
1. Validate bid > current_highest_bid
2. Validate team balance
3. Insert into `bulk_tiebreaker_bids`
4. Update `bulk_tiebreakers.current_highest_bid`
5. Update `bulk_tiebreakers.current_highest_team_id`
6. Notify other teams via WebSocket (real-time)
7. Update all connected clients instantly

**Response:**
```json
{
  "success": true,
  "data": {
    "new_highest_bid": 15,
    "you_are_winning": true,
    "time_remaining": 120
  }
}
```

---

### 7. Finalize Tiebreaker
**Endpoint:** `POST /api/admin/bulk-tiebreakers/:id/finalize`

**Logic:**
1. Check if auction ended
2. Assign player to `current_highest_team_id`
3. Update `round_players.winning_team_id`
4. Update `round_players.winning_bid=current_highest_bid`
5. Deduct FINAL bid amount from winning team (not £10)
6. Update winning team's squad count
7. Release reservations for losing teams (nothing to refund - they never paid)
8. Set tiebreaker `status='resolved'`

---

### 8. Extend Tiebreaker Time (Admin)
**Endpoint:** `POST /api/admin/bulk-tiebreakers/:id/extend`

**Request:**
```json
{
  "additional_seconds": 3600
}
```

**Logic:**
1. Verify admin permissions
2. Add time to `end_time`
3. Notify all participants

---

### 9. Complete Bulk Round
**Endpoint:** `POST /api/admin/bulk-rounds/:id/complete`

**Logic:**
1. Check all tiebreakers resolved
2. Update unsold players (no bids) status
3. Set round `status='completed'`
4. Update player ownership in `footballplayers` table

---

## UI Flow

### Committee Admin Flow
1. **Create Bulk Round** → Select season, set base price, duration
2. **Review Round** → See all 250+ players added automatically
3. **Start Round** → Activates bidding for all teams
4. **Monitor Progress** → See live bid counts, team participation
5. **Finalize Round** → System detects conflicts, creates tiebreakers
6. **Manage Tiebreakers** → Start auctions one by one or in batches
7. **Complete Round** → All players assigned

### Team Flow
1. **See Active Bulk Round** → Dashboard alert "Bulk Round Active!"
2. **Browse Players** → Search, filter by position
3. **Select Players** → Multi-select, see total cost
4. **Submit Bids** → One-click submit all
5. **Wait for Results** → See which players won immediately
6. **Enter Tiebreakers** → If conflict, join open auction
7. **Place Bids** → Real-time bidding like eBay
8. **Win or Lose** → Get player or refund

---

## File Structure

```
/app/api/admin/bulk-rounds/
  - route.ts (GET, POST - list & create)
  - [id]/
    - route.ts (GET, PATCH - details & update)
    - start/route.ts (POST)
    - finalize/route.ts (POST)
    - complete/route.ts (POST)

/app/api/admin/bulk-tiebreakers/
  - route.ts (GET - list all)
  - [id]/
    - route.ts (GET)
    - start/route.ts (POST)
    - extend/route.ts (POST - admin extend time)
    - finalize/route.ts (POST)

/app/api/team/bulk-rounds/
  - [id]/
    - route.ts (GET - view round)
    - bids/route.ts (POST - submit bids)

/app/api/team/bulk-tiebreakers/
  - [id]/
    - route.ts (GET - view tiebreaker)
    - bid/route.ts (POST - place bid)

/app/dashboard/committee/bulk-rounds/
  - page.tsx (list all bulk rounds)
  - [id]/
    - page.tsx (manage specific round)
    - tiebreakers/page.tsx (manage tiebreakers)

/app/dashboard/team/bulk-round/
  - [id]/
    - page.tsx (team bidding interface)

/app/dashboard/team/bulk-tiebreaker/
  - [id]/
    - page.tsx (open auction interface)
```

---

## WebSocket Infrastructure

### Setup Required
```typescript
// /lib/websocket/tiebreaker-socket.ts
// Real-time updates for open auction tiebreakers

interface TiebreakerUpdate {
  type: 'BID_PLACED' | 'TIME_EXTENDED' | 'AUCTION_ENDING' | 'AUCTION_ENDED';
  tiebreaker_id: number;
  current_highest_bid?: number;
  current_highest_team_id?: string;
  time_remaining?: number;
  new_bid?: {
    team_name: string;
    amount: number;
    timestamp: string;
  };
}
```

### Client Connection
```typescript
// Connect when entering tiebreaker page
const ws = new WebSocket(`ws://your-server/tiebreaker/${tiebreakerId}`);

ws.onmessage = (event) => {
  const update: TiebreakerUpdate = JSON.parse(event.data);
  // Update UI immediately
};
```

### Server Broadcasting
```typescript
// When bid placed, broadcast to all connected teams
broadcastToTiebreaker(tiebreakerId, {
  type: 'BID_PLACED',
  current_highest_bid: 25,
  new_bid: { team_name: 'Team Alpha', amount: 25 }
});
```

---

## Implementation Steps

### Phase 1: Database Setup (30 min)
- [ ] Create `bulk_tiebreakers` table
- [ ] Create `bulk_tiebreaker_bids` table
- [ ] Test tables with sample data

### Phase 2: Bulk Round Creation (1 hour)
- [ ] API: `POST /api/admin/bulk-rounds`
- [ ] Auto-populate all players
- [ ] API: `POST /api/admin/bulk-rounds/:id/start`

### Phase 3: Team Bidding (1 hour)
- [ ] API: `POST /api/team/bulk-rounds/:id/bids`
- [ ] UI: Multi-select player interface
- [ ] Validation: Balance check

### Phase 4: Conflict Detection (1 hour)
- [ ] API: `POST /api/admin/bulk-rounds/:id/finalize`
- [ ] SQL: Detect conflicts
- [ ] Create tiebreaker records
- [ ] Assign non-conflict players immediately

### Phase 5: Open Auction Tiebreaker (2 hours)
- [ ] API: `POST /api/admin/bulk-tiebreakers/:id/start`
- [ ] API: `POST /api/team/bulk-tiebreakers/:id/bid`
- [ ] UI: Real-time auction interface
- [ ] Timer with auto-finalize

### Phase 6: Finalization (1 hour)
- [ ] API: `POST /api/admin/bulk-tiebreakers/:id/finalize`
- [ ] API: `POST /api/admin/bulk-rounds/:id/complete`
- [ ] Update player ownership
- [ ] Refund logic

### Phase 7: Testing (1 hour)
- [ ] End-to-end test with mock teams
- [ ] Test conflict scenarios
- [ ] Test timing edge cases

**Total Estimated Time: 7-8 hours**

---

## Key Features

### Real-time Updates
Use polling or WebSocket for:
- Current highest bid in tiebreaker
- Time remaining
- Other team activity

### Admin Timer Extension
Admin can manually extend auction time if needed via API endpoint

### Notifications
- Email/Push when tiebreaker starts
- Email/Push when you're outbid
- Email/Push when you win/lose

### Analytics
- Most contested players
- Average tiebreaker price
- Team participation rates

---

## Security Considerations

1. **Validate team balance** before accepting bids
2. **Atomic transactions** for bid placement
3. **Rate limiting** on bid API to prevent spam
4. **Authorization checks** on all endpoints
5. **Encrypted bid data** until round ends (optional)

---

## Next Steps

1. Review this plan
2. Create database migration SQL
3. Start with Phase 1 (Database Setup)
4. Implement APIs sequentially
5. Test after each phase

Would you like me to start implementing this now?
