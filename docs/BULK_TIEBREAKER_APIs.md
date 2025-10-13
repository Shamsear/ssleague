# Bulk Tiebreaker APIs Documentation

## Overview
APIs for managing tiebreaker auctions using the **Last Person Standing** mechanism. When multiple teams bid the same amount on a player in a bulk bidding round, a tiebreaker auction is triggered.

## Last Person Standing Rules
1. All tied teams are automatically entered
2. Starting bid = tie amount + £1
3. Teams must bid higher than current highest bid
4. **CRITICAL RULE**: The highest bidder CANNOT withdraw
5. Other teams can either:
   - Outbid the current highest bidder
   - Withdraw from the tiebreaker
6. Winner = last team remaining (all others withdrawn) OR highest bidder after 24 hours
7. 24-hour maximum duration from start

---

## Admin APIs

### 1. Start Tiebreaker
**POST** `/api/admin/bulk-tiebreakers/:id/start`

Starts a pending tiebreaker auction.

**Auth**: Committee Admin only

**Request Body**: None

**Response**:
```json
{
  "success": true,
  "data": {
    "tiebreaker_id": "uuid",
    "status": "active",
    "player_name": "Mohamed Salah",
    "tie_amount": 100,
    "starting_bid": 101,
    "participating_teams": [
      {
        "team_id": "team1_uid",
        "team_name": "Liverpool FC",
        "status": "active"
      }
    ],
    "start_time": "2024-01-15T10:00:00.000Z",
    "max_end_time": "2024-01-16T10:00:00.000Z"
  }
}
```

**Validations**:
- ✅ User must be committee admin
- ✅ Tiebreaker must be in 'pending' status
- ✅ At least 2 teams must be active
- ✅ Sets status to 'active'
- ✅ Records start_time and max_end_time (24 hours)

---

### 2. Finalize Tiebreaker
**POST** `/api/admin/bulk-tiebreakers/:id/finalize`

Manually finalizes a tiebreaker (admin override or after 24 hours).

**Auth**: Committee Admin only

**Request Body**: None

**Response**:
```json
{
  "success": true,
  "data": {
    "tiebreaker_id": "uuid",
    "status": "completed",
    "winner_team_id": "team1_uid",
    "winner_team_name": "Liverpool FC",
    "final_bid": 150,
    "player_name": "Mohamed Salah"
  }
}
```

**Validations**:
- ✅ User must be committee admin
- ✅ Tiebreaker must be 'active'
- ✅ Determines winner based on highest bid
- ✅ Updates player allocation
- ✅ Deducts balance from winner's team

---

### 3. List All Tiebreakers (Admin)
**GET** `/api/admin/bulk-tiebreakers`

Lists all tiebreakers across all rounds with filtering.

**Auth**: Committee Admin only

**Query Parameters**:
- `status` (optional): Filter by status (pending, active, completed, cancelled)
- `roundId` (optional): Filter by specific round
- `seasonId` (optional): Filter by season

**Response**:
```json
{
  "success": true,
  "data": {
    "tiebreakers": [
      {
        "id": "uuid",
        "round_id": "round_uuid",
        "round_name": "Round 1",
        "player_name": "Mohamed Salah",
        "status": "active",
        "tie_amount": 100,
        "tied_team_count": 3,
        "current_highest_bid": 120,
        "current_highest_team_id": "team1_uid",
        "participating_teams": [
          {
            "team_id": "team1_uid",
            "team_name": "Liverpool FC",
            "status": "active",
            "current_bid": 120
          }
        ]
      }
    ],
    "count": {
      "total": 10,
      "pending": 2,
      "active": 3,
      "completed": 5
    }
  }
}
```

---

### 4. Get Tiebreaker Details (Admin)
**GET** `/api/admin/bulk-tiebreakers/:id`

Gets detailed information about a specific tiebreaker.

**Auth**: Committee Admin only

**Response**:
```json
{
  "success": true,
  "data": {
    "tiebreaker": {
      "id": "uuid",
      "player_name": "Mohamed Salah",
      "status": "active",
      "current_highest_bid": 120,
      "time_remaining": "18h 30m"
    },
    "participating_teams": [...],
    "bid_history": [...],
    "statistics": {
      "active_teams": 2,
      "withdrawn_teams": 1,
      "total_bids": 8
    }
  }
}
```

---

## Team APIs

### 1. Place Bid
**POST** `/api/team/bulk-tiebreakers/:id/bid`

Places a bid in an active tiebreaker auction.

**Auth**: Team only

**Request Body**:
```json
{
  "bid_amount": 125
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "tiebreaker_id": "uuid",
    "player_name": "Mohamed Salah",
    "your_bid": 125,
    "current_highest_bid": 125,
    "you_are_highest": true,
    "teams_remaining": 2,
    "is_winner": false,
    "message": "Bid placed successfully! You are now the highest bidder at £125. You cannot withdraw while leading."
  }
}
```

**Validations**:
- ✅ Tiebreaker must be 'active'
- ✅ Within 24-hour time limit
- ✅ Team must be participating
- ✅ Team must not be withdrawn
- ✅ Bid must be > current highest bid
- ✅ Team must have sufficient balance
- ✅ Auto-detects if this is the last team standing

---

### 2. Withdraw from Tiebreaker
**POST** `/api/team/bulk-tiebreakers/:id/withdraw`

Withdraws from an active tiebreaker auction.

**Auth**: Team only

**Request Body**: None

**Response**:
```json
{
  "success": true,
  "data": {
    "tiebreaker_id": "uuid",
    "player_name": "Mohamed Salah",
    "withdrawn": true,
    "teams_remaining": 1,
    "is_winner_determined": true,
    "message": "You have withdrawn. The tiebreaker is now over. Team team1_uid wins Mohamed Salah!"
  }
}
```

**Validations**:
- ✅ Tiebreaker must be 'active'
- ✅ Within 24-hour time limit
- ✅ Team must be participating
- ✅ Team must not be already withdrawn
- ✅ **CRITICAL**: Team CANNOT be the current highest bidder
- ✅ Auto-detects if winner is determined

**Error Example** (trying to withdraw as highest bidder):
```json
{
  "success": false,
  "error": "You cannot withdraw! You are the current highest bidder at £125. Another team must outbid you first."
}
```

---

### 3. View Tiebreaker Details
**GET** `/api/team/bulk-tiebreakers/:id`

Views the current state of a tiebreaker auction.

**Auth**: Team only (must be participating)

**Response**:
```json
{
  "success": true,
  "data": {
    "tiebreaker": {
      "id": "uuid",
      "player_name": "Mohamed Salah",
      "status": "active",
      "current_highest_bid": 125,
      "time_remaining": "18h 30m"
    },
    "my_status": {
      "status": "active",
      "current_bid": 120,
      "you_are_highest": false,
      "can_bid": true,
      "can_withdraw": true
    },
    "statistics": {
      "active_teams": 2,
      "withdrawn_teams": 1,
      "total_bids": 8
    },
    "participating_teams": [
      {
        "team_id": "team1_uid",
        "team_name": "Liverpool FC",
        "status": "active",
        "current_bid": 125,
        "is_you": false
      },
      {
        "team_id": "team2_uid",
        "team_name": "Manchester City",
        "status": "active",
        "current_bid": 120,
        "is_you": true
      }
    ],
    "recent_bids": [
      {
        "team_name": "Liverpool FC",
        "bid_amount": 125,
        "bid_time": "2024-01-15T12:30:00.000Z",
        "is_you": false
      }
    ]
  }
}
```

---

### 4. List My Tiebreakers
**GET** `/api/team/bulk-tiebreakers`

Lists all tiebreakers the team is participating in.

**Auth**: Team only

**Query Parameters**:
- `status` (optional): Filter by status
- `seasonId` (optional): Filter by season

**Response**:
```json
{
  "success": true,
  "data": {
    "all": [...],
    "grouped": {
      "active": [...],
      "completed": [...],
      "pending": [...],
      "cancelled": [...]
    },
    "count": {
      "total": 5,
      "active": 2,
      "completed": 3,
      "pending": 0,
      "cancelled": 0
    }
  }
}
```

---

## Status Flow

```
pending
  ↓ (Admin starts)
active
  ↓ (Admin finalizes OR auto-finalize)
completed
```

**Auto-finalize conditions**:
1. Only 1 team remaining (all others withdrawn)
2. 24 hours elapsed (highest bidder wins)

---

## Database Schema

### `bulk_tiebreakers`
- Primary tiebreaker record
- Tracks current highest bid and bidder
- Status: pending, active, completed, cancelled
- 24-hour max_end_time

### `bulk_tiebreaker_teams`
- Participating teams
- Individual team status: active, withdrawn
- Current bid per team

### `bulk_tiebreaker_bids`
- Complete bid history
- Audit trail of all bids

---

## Frontend Integration Notes

### Real-time Updates (TODO)
- Use WebSocket for live bid updates
- Notify teams of new bids and withdrawals
- Update countdown timer in real-time

### UI Considerations
1. **Bid Input**: Validate minimum bid (current_highest + 1)
2. **Withdraw Button**: Disable if you're the highest bidder
3. **Timer**: Show countdown to 24-hour limit
4. **Notifications**: Alert teams of new bids
5. **Winner Banner**: Show when tiebreaker completes

### Example Team UI Flow
```
1. Team sees tiebreaker notification
2. Views tiebreaker details
3. Sees current highest bid: £120
4. Options:
   - If not highest: Bid higher OR Withdraw
   - If highest: Wait (cannot withdraw)
5. If all others withdraw → You win!
6. If 24 hours pass → Highest bid wins
```

---

## Error Handling

Common error responses:

### 400 Bad Request
```json
{
  "success": false,
  "error": "Bid must be higher than current highest bid of £120"
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "error": "Invalid token"
}
```

### 403 Forbidden
```json
{
  "success": false,
  "error": "Access denied. Team users only."
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": "Tiebreaker not found"
}
```

---

## Testing Examples

### cURL Examples

**1. Start Tiebreaker (Admin)**
```bash
curl -X POST http://localhost:3000/api/admin/bulk-tiebreakers/TB_UUID/start \
  -H "Content-Type: application/json" \
  -H "Cookie: token=ADMIN_TOKEN"
```

**2. Place Bid (Team)**
```bash
curl -X POST http://localhost:3000/api/team/bulk-tiebreakers/TB_UUID/bid \
  -H "Content-Type: application/json" \
  -H "Cookie: token=TEAM_TOKEN" \
  -d '{"bid_amount": 125}'
```

**3. Withdraw (Team)**
```bash
curl -X POST http://localhost:3000/api/team/bulk-tiebreakers/TB_UUID/withdraw \
  -H "Content-Type: application/json" \
  -H "Cookie: token=TEAM_TOKEN"
```

**4. View Tiebreaker (Team)**
```bash
curl http://localhost:3000/api/team/bulk-tiebreakers/TB_UUID \
  -H "Cookie: token=TEAM_TOKEN"
```

---

## Next Steps

1. ✅ Database migration (completed)
2. ✅ Admin APIs (start, finalize, list, view)
3. ✅ Team APIs (bid, withdraw, view, list)
4. ⏳ Frontend UI components
5. ⏳ WebSocket integration for real-time updates
6. ⏳ Email/push notifications
7. ⏳ Auto-finalize cron job (for 24-hour limit)

---

## Contact
For questions or issues, contact the development team.
