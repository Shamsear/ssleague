# Tiebreaker API Testing Script

## Prerequisites

Before testing, ensure:
1. Database migration has been applied
2. You have valid admin and team tokens
3. A bulk round with ties has been finalized
4. Tiebreaker records exist in `bulk_tiebreakers` table

---

## Setup Test Data

### 1. Create Test Variables

```bash
# Set your tokens (get from browser cookies after login)
$ADMIN_TOKEN = "your_admin_token_here"
$TEAM1_TOKEN = "your_team1_token_here"
$TEAM2_TOKEN = "your_team2_token_here"
$TEAM3_TOKEN = "your_team3_token_here"

# API base URL
$BASE_URL = "http://localhost:3000"

# Tiebreaker ID (get from database or admin list API)
$TIEBREAKER_ID = "tiebreaker_uuid_here"
```

---

## Admin API Tests

### Test 1: List All Tiebreakers

```powershell
# List all tiebreakers
Invoke-WebRequest -Uri "$BASE_URL/api/admin/bulk-tiebreakers" `
  -Method GET `
  -Headers @{
    "Content-Type" = "application/json"
    "Cookie" = "token=$ADMIN_TOKEN"
  }
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "tiebreakers": [...],
    "count": {
      "total": 5,
      "pending": 2,
      "active": 1,
      "completed": 2
    }
  }
}
```

### Test 2: Filter Tiebreakers by Status

```powershell
# Get only active tiebreakers
Invoke-WebRequest -Uri "$BASE_URL/api/admin/bulk-tiebreakers?status=active" `
  -Method GET `
  -Headers @{
    "Content-Type" = "application/json"
    "Cookie" = "token=$ADMIN_TOKEN"
  }
```

### Test 3: View Tiebreaker Details (Admin)

```powershell
Invoke-WebRequest -Uri "$BASE_URL/api/admin/bulk-tiebreakers/$TIEBREAKER_ID" `
  -Method GET `
  -Headers @{
    "Content-Type" = "application/json"
    "Cookie" = "token=$ADMIN_TOKEN"
  }
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "tiebreaker": {
      "id": "uuid",
      "player_name": "Mohamed Salah",
      "status": "pending",
      "tie_amount": 100,
      "tied_team_count": 3
    },
    "participating_teams": [...],
    "statistics": {...}
  }
}
```

### Test 4: Start Tiebreaker

```powershell
Invoke-WebRequest -Uri "$BASE_URL/api/admin/bulk-tiebreakers/$TIEBREAKER_ID/start" `
  -Method POST `
  -Headers @{
    "Content-Type" = "application/json"
    "Cookie" = "token=$ADMIN_TOKEN"
  }
```

**Expected Response:**
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
      {"team_id": "...", "team_name": "Team A", "status": "active"},
      {"team_id": "...", "team_name": "Team B", "status": "active"},
      {"team_id": "...", "team_name": "Team C", "status": "active"}
    ],
    "start_time": "2024-01-15T10:00:00.000Z",
    "max_end_time": "2024-01-16T10:00:00.000Z"
  }
}
```

**Test Error Cases:**
```powershell
# Try to start already active tiebreaker (should fail)
Invoke-WebRequest -Uri "$BASE_URL/api/admin/bulk-tiebreakers/$TIEBREAKER_ID/start" `
  -Method POST `
  -Headers @{
    "Content-Type" = "application/json"
    "Cookie" = "token=$ADMIN_TOKEN"
  }
# Expected: 400 Bad Request - "Tiebreaker is not in pending status"
```

---

## Team API Tests

### Test 5: List My Tiebreakers (Team 1)

```powershell
Invoke-WebRequest -Uri "$BASE_URL/api/team/bulk-tiebreakers" `
  -Method GET `
  -Headers @{
    "Content-Type" = "application/json"
    "Cookie" = "token=$TEAM1_TOKEN"
  }
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "all": [...],
    "grouped": {
      "active": [...],
      "completed": [...],
      "pending": [...]
    },
    "count": {
      "total": 3,
      "active": 2,
      "completed": 1,
      "pending": 0
    }
  }
}
```

### Test 6: View Tiebreaker Details (Team 1)

```powershell
Invoke-WebRequest -Uri "$BASE_URL/api/team/bulk-tiebreakers/$TIEBREAKER_ID" `
  -Method GET `
  -Headers @{
    "Content-Type" = "application/json"
    "Cookie" = "token=$TEAM1_TOKEN"
  }
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "tiebreaker": {
      "player_name": "Mohamed Salah",
      "status": "active",
      "current_highest_bid": 101,
      "time_remaining": "23h 58m"
    },
    "my_status": {
      "status": "active",
      "current_bid": null,
      "you_are_highest": false,
      "can_bid": true,
      "can_withdraw": false
    },
    "statistics": {
      "active_teams": 3,
      "withdrawn_teams": 0,
      "total_bids": 1
    },
    "participating_teams": [...],
    "recent_bids": [...]
  }
}
```

### Test 7: Place First Bid (Team 1)

```powershell
$body = @{
  bid_amount = 110
} | ConvertTo-Json

Invoke-WebRequest -Uri "$BASE_URL/api/team/bulk-tiebreakers/$TIEBREAKER_ID/bid" `
  -Method POST `
  -Headers @{
    "Content-Type" = "application/json"
    "Cookie" = "token=$TEAM1_TOKEN"
  } `
  -Body $body
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "tiebreaker_id": "uuid",
    "player_name": "Mohamed Salah",
    "your_bid": 110,
    "current_highest_bid": 110,
    "you_are_highest": true,
    "teams_remaining": 3,
    "is_winner": false,
    "message": "Bid placed successfully! You are now the highest bidder at £110. You cannot withdraw while leading."
  }
}
```

### Test 8: Try to Bid Lower (Team 2) - Should Fail

```powershell
$body = @{
  bid_amount = 105
} | ConvertTo-Json

Invoke-WebRequest -Uri "$BASE_URL/api/team/bulk-tiebreakers/$TIEBREAKER_ID/bid" `
  -Method POST `
  -Headers @{
    "Content-Type" = "application/json"
    "Cookie" = "token=$TEAM2_TOKEN"
  } `
  -Body $body
```

**Expected Response:**
```json
{
  "success": false,
  "error": "Bid must be higher than current highest bid of £110"
}
```

### Test 9: Outbid Team 1 (Team 2)

```powershell
$body = @{
  bid_amount = 120
} | ConvertTo-Json

Invoke-WebRequest -Uri "$BASE_URL/api/team/bulk-tiebreakers/$TIEBREAKER_ID/bid" `
  -Method POST `
  -Headers @{
    "Content-Type" = "application/json"
    "Cookie" = "token=$TEAM2_TOKEN"
  } `
  -Body $body
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "your_bid": 120,
    "current_highest_bid": 120,
    "you_are_highest": true,
    "teams_remaining": 3,
    "is_winner": false,
    "message": "Bid placed successfully! You are now the highest bidder at £120. You cannot withdraw while leading."
  }
}
```

### Test 10: Try to Withdraw as Highest Bidder (Team 2) - Should Fail

```powershell
Invoke-WebRequest -Uri "$BASE_URL/api/team/bulk-tiebreakers/$TIEBREAKER_ID/withdraw" `
  -Method POST `
  -Headers @{
    "Content-Type" = "application/json"
    "Cookie" = "token=$TEAM2_TOKEN"
  }
```

**Expected Response:**
```json
{
  "success": false,
  "error": "You cannot withdraw! You are the current highest bidder at £120. Another team must outbid you first."
}
```

### Test 11: Withdraw as Non-Highest Bidder (Team 3)

```powershell
Invoke-WebRequest -Uri "$BASE_URL/api/team/bulk-tiebreakers/$TIEBREAKER_ID/withdraw" `
  -Method POST `
  -Headers @{
    "Content-Type" = "application/json"
    "Cookie" = "token=$TEAM3_TOKEN"
  }
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "tiebreaker_id": "uuid",
    "player_name": "Mohamed Salah",
    "withdrawn": true,
    "teams_remaining": 2,
    "is_winner_determined": false,
    "message": "You have successfully withdrawn from the tiebreaker for Mohamed Salah. 2 team(s) remaining."
  }
}
```

### Test 12: Team 1 Now Can Withdraw (After Team 3 Withdrew)

```powershell
Invoke-WebRequest -Uri "$BASE_URL/api/team/bulk-tiebreakers/$TIEBREAKER_ID/withdraw" `
  -Method POST `
  -Headers @{
    "Content-Type" = "application/json"
    "Cookie" = "token=$TEAM1_TOKEN"
  }
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "tiebreaker_id": "uuid",
    "player_name": "Mohamed Salah",
    "withdrawn": true,
    "teams_remaining": 1,
    "is_winner_determined": true,
    "message": "You have withdrawn. The tiebreaker is now over. Team [team2_id] wins Mohamed Salah!"
  }
}
```

**Note**: At this point, tiebreaker status should be set to `auto_finalize_pending`

### Test 13: Finalize Tiebreaker (Admin)

```powershell
Invoke-WebRequest -Uri "$BASE_URL/api/admin/bulk-tiebreakers/$TIEBREAKER_ID/finalize" `
  -Method POST `
  -Headers @{
    "Content-Type" = "application/json"
    "Cookie" = "token=$ADMIN_TOKEN"
  }
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "tiebreaker_id": "uuid",
    "status": "completed",
    "winner_team_id": "team2_id",
    "winner_team_name": "Team B",
    "final_bid": 120,
    "player_name": "Mohamed Salah",
    "message": "Tiebreaker finalized successfully. Team B wins Mohamed Salah for £120."
  }
}
```

---

## Edge Case Tests

### Test 14: Bid with Insufficient Balance

```powershell
$body = @{
  bid_amount = 9999
} | ConvertTo-Json

Invoke-WebRequest -Uri "$BASE_URL/api/team/bulk-tiebreakers/$TIEBREAKER_ID/bid" `
  -Method POST `
  -Headers @{
    "Content-Type" = "application/json"
    "Cookie" = "token=$TEAM1_TOKEN"
  } `
  -Body $body
```

**Expected Response:**
```json
{
  "success": false,
  "error": "Insufficient balance. Bid: £9999, Available: £1000"
}
```

### Test 15: Try to Withdraw Twice

```powershell
# First withdrawal (should succeed)
Invoke-WebRequest -Uri "$BASE_URL/api/team/bulk-tiebreakers/$TIEBREAKER_ID/withdraw" `
  -Method POST `
  -Headers @{"Cookie" = "token=$TEAM3_TOKEN"}

# Second withdrawal (should fail)
Invoke-WebRequest -Uri "$BASE_URL/api/team/bulk-tiebreakers/$TIEBREAKER_ID/withdraw" `
  -Method POST `
  -Headers @{"Cookie" = "token=$TEAM3_TOKEN"}
```

**Expected Response (2nd call):**
```json
{
  "success": false,
  "error": "You have already withdrawn from this tiebreaker"
}
```

### Test 16: Try to Bid on Completed Tiebreaker

```powershell
$body = @{
  bid_amount = 200
} | ConvertTo-Json

Invoke-WebRequest -Uri "$BASE_URL/api/team/bulk-tiebreakers/$TIEBREAKER_ID/bid" `
  -Method POST `
  -Headers @{
    "Content-Type" = "application/json"
    "Cookie" = "token=$TEAM1_TOKEN"
  } `
  -Body $body
```

**Expected Response:**
```json
{
  "success": false,
  "error": "Tiebreaker is not active. Current status: completed"
}
```

### Test 17: Non-Participating Team Tries to Bid

```powershell
# Use a team token that's not in the tiebreaker
$body = @{
  bid_amount = 150
} | ConvertTo-Json

Invoke-WebRequest -Uri "$BASE_URL/api/team/bulk-tiebreakers/$TIEBREAKER_ID/bid" `
  -Method POST `
  -Headers @{
    "Content-Type" = "application/json"
    "Cookie" = "token=$NON_PARTICIPATING_TEAM_TOKEN"
  } `
  -Body $body
```

**Expected Response:**
```json
{
  "success": false,
  "error": "You are not participating in this tiebreaker"
}
```

### Test 18: Team User Tries Admin Endpoint

```powershell
Invoke-WebRequest -Uri "$BASE_URL/api/admin/bulk-tiebreakers/$TIEBREAKER_ID/start" `
  -Method POST `
  -Headers @{
    "Content-Type" = "application/json"
    "Cookie" = "token=$TEAM1_TOKEN"
  }
```

**Expected Response:**
```json
{
  "success": false,
  "error": "Access denied. Committee admin only."
}
```

---

## Complete Test Scenario: Full Tiebreaker Flow

```powershell
# ===== ADMIN: START TIEBREAKER =====
Write-Host "1. Admin starts tiebreaker..." -ForegroundColor Yellow
Invoke-WebRequest -Uri "$BASE_URL/api/admin/bulk-tiebreakers/$TIEBREAKER_ID/start" `
  -Method POST -Headers @{"Cookie" = "token=$ADMIN_TOKEN"}

# ===== TEAM 1: PLACE FIRST BID =====
Write-Host "2. Team 1 bids £110..." -ForegroundColor Green
$body = @{bid_amount = 110} | ConvertTo-Json
Invoke-WebRequest -Uri "$BASE_URL/api/team/bulk-tiebreakers/$TIEBREAKER_ID/bid" `
  -Method POST -Headers @{"Content-Type"="application/json"; "Cookie"="token=$TEAM1_TOKEN"} `
  -Body $body

# ===== TEAM 2: OUTBID TEAM 1 =====
Write-Host "3. Team 2 bids £120..." -ForegroundColor Green
$body = @{bid_amount = 120} | ConvertTo-Json
Invoke-WebRequest -Uri "$BASE_URL/api/team/bulk-tiebreakers/$TIEBREAKER_ID/bid" `
  -Method POST -Headers @{"Content-Type"="application/json"; "Cookie"="token=$TEAM2_TOKEN"} `
  -Body $body

# ===== TEAM 1: WITHDRAW (Now allowed) =====
Write-Host "4. Team 1 withdraws..." -ForegroundColor Cyan
Invoke-WebRequest -Uri "$BASE_URL/api/team/bulk-tiebreakers/$TIEBREAKER_ID/withdraw" `
  -Method POST -Headers @{"Cookie" = "token=$TEAM1_TOKEN"}

# ===== TEAM 3: OUTBID TEAM 2 =====
Write-Host "5. Team 3 bids £130..." -ForegroundColor Green
$body = @{bid_amount = 130} | ConvertTo-Json
Invoke-WebRequest -Uri "$BASE_URL/api/team/bulk-tiebreakers/$TIEBREAKER_ID/bid" `
  -Method POST -Headers @{"Content-Type"="application/json"; "Cookie"="token=$TEAM3_TOKEN"} `
  -Body $body

# ===== TEAM 2: WITHDRAW (Last Person Standing) =====
Write-Host "6. Team 2 withdraws (Team 3 wins!)..." -ForegroundColor Cyan
Invoke-WebRequest -Uri "$BASE_URL/api/team/bulk-tiebreakers/$TIEBREAKER_ID/withdraw" `
  -Method POST -Headers @{"Cookie" = "token=$TEAM2_TOKEN"}

# ===== ADMIN: FINALIZE =====
Write-Host "7. Admin finalizes tiebreaker..." -ForegroundColor Yellow
Invoke-WebRequest -Uri "$BASE_URL/api/admin/bulk-tiebreakers/$TIEBREAKER_ID/finalize" `
  -Method POST -Headers @{"Cookie" = "token=$ADMIN_TOKEN"}

Write-Host "✅ Tiebreaker completed! Team 3 wins at £130" -ForegroundColor Magenta
```

---

## Verification Queries

After testing, verify in database:

```sql
-- Check tiebreaker status
SELECT id, player_name, status, current_highest_bid, current_highest_team_id
FROM bulk_tiebreakers
WHERE id = 'TIEBREAKER_ID';

-- Check participating teams
SELECT team_id, team_name, status, current_bid, withdrawn_at
FROM bulk_tiebreaker_teams
WHERE tiebreaker_id = 'TIEBREAKER_ID'
ORDER BY current_bid DESC NULLS LAST;

-- Check bid history
SELECT team_name, bid_amount, bid_time
FROM bulk_tiebreaker_bids
WHERE tiebreaker_id = 'TIEBREAKER_ID'
ORDER BY bid_time DESC;

-- Check if player was allocated
SELECT player_name, winning_team_id, final_amount
FROM bulk_team_bids
WHERE player_name = 'Mohamed Salah' AND round_id = 'ROUND_ID';

-- Check team balance deduction
SELECT team_id, balance
FROM team_seasons
WHERE team_id = 'WINNER_TEAM_ID' AND season_id = 'SEASON_ID';
```

---

## Troubleshooting

### Issue: 401 Unauthorized
- **Cause**: Invalid or expired token
- **Fix**: Re-login and get fresh token from browser cookies

### Issue: 404 Not Found
- **Cause**: Invalid tiebreaker ID
- **Fix**: Run `SELECT id FROM bulk_tiebreakers LIMIT 1;` to get valid ID

### Issue: 400 Bad Request - "Tiebreaker not found"
- **Cause**: Tiebreaker doesn't exist
- **Fix**: Create tiebreaker by finalizing a bulk round with ties

### Issue: 403 Forbidden - "You are not participating"
- **Cause**: Team is not in the tiebreaker
- **Fix**: Use token from a team that placed a tied bid

---

## Success Criteria

✅ All admin APIs work correctly  
✅ All team APIs work correctly  
✅ Highest bidder cannot withdraw (enforced)  
✅ Other teams can withdraw  
✅ Winner correctly determined (last team standing)  
✅ Player allocated to winner  
✅ Balance deducted from winner  
✅ Bid history recorded  
✅ Time remaining calculated  
✅ Status transitions: pending → active → completed  

---

## Next Steps After Testing

1. Fix any bugs discovered
2. Build frontend UI components
3. Add WebSocket for real-time updates
4. Implement notifications
5. Create cron job for auto-finalization
