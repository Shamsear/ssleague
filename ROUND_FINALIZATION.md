# Round Finalization System

This document explains how the round finalization system works in the auction platform.

## Overview

When a round ends (either by timer expiration or manual admin trigger), the system automatically allocates players to teams based on their bids using a sophisticated 3-phase algorithm.

## Finalization Algorithm

### Phase 1: Regular Teams (Correct Number of Bids)

1. **Filter Teams**: Only teams that placed exactly the required number of bids are considered
2. **Sort Bids**: All bids are sorted by amount (highest first)
3. **Iterative Allocation**:
   - Take the highest bid
   - Award the player to that team for the bid amount
   - **Remove both the player AND the team** from the remaining pool
   - Re-sort the remaining bids
   - Repeat until all eligible teams receive one player

### Phase 2: Incomplete Teams (Fewer Bids)

4. **After Phase 1**, handle teams with incomplete bids:
   - Filter out players already allocated in Phase 1
   - Sort each team's remaining bids by amount
   - Award the highest available player to the team
   - **Penalty**: Price = Average of all winning bids from Phase 1

### Phase 3: Tie Detection

5. **If tied bids are detected**:
   - Finalization stops at the tie point
   - Round status is set to `tiebreaker`
   - Admin must initiate tiebreaker system
   - Teams submit new bids
   - Finalization continues after tiebreaker resolution

## Database Updates

After successful finalization, the following updates occur:

1. **Bids Table**: 
   - Winning bids marked as `status = 'won'`
   - Losing bids marked as `status = 'lost'`

2. **Team Players Table**:
   - New records created linking teams to acquired players
   - Purchase price recorded

3. **Teams Table**:
   - `budget_remaining` decreased by purchase price

4. **Players Table**:
   - Player status changed to `'sold'`

5. **Rounds Table**:
   - Round status changed to `'completed'` (or `'tiebreaker'` if tie detected)

## API Endpoints

### 1. Manual Finalization (Admin Only)

```
POST /api/admin/rounds/[id]/finalize
```

**Authentication**: Admin JWT token required

**Response on Success**:
```json
{
  "success": true,
  "message": "Round finalized successfully",
  "allocations": [
    {
      "team_name": "Team A",
      "player_name": "Player 1",
      "amount": 5000,
      "phase": "regular"
    }
  ]
}
```

**Response on Tie**:
```json
{
  "success": false,
  "tieDetected": true,
  "tiedBids": [...],
  "message": "Tie detected. Tiebreaker required."
}
```

### 2. Automatic Finalization (Cron)

```
GET /api/cron/finalize-rounds
POST /api/cron/finalize-rounds
```

**Authentication**: Optional `CRON_SECRET` in Authorization header

**What it does**:
- Finds all active rounds where `end_time < NOW()`
- Attempts to finalize each expired round
- Returns summary of results

**Response**:
```json
{
  "success": true,
  "message": "Processed 3 expired rounds",
  "finalized": [
    {
      "round_id": "uuid",
      "position": "Goalkeeper",
      "allocations_count": 5,
      "allocations": [...]
    }
  ],
  "summary": {
    "total_expired": 3,
    "successfully_finalized": 2,
    "failed_or_tied": 1
  }
}
```

## Cron Job Setup

### Option 1: Vercel Cron (Recommended for Production)

The `vercel.json` file is configured to run the cron every minute:

```json
{
  "crons": [
    {
      "path": "/api/cron/finalize-rounds",
      "schedule": "* * * * *"
    }
  ]
}
```

**Note**: Vercel Cron is only available on Pro and Enterprise plans.

### Option 2: External Cron Service

Use services like:
- **EasyCron**: https://www.easycron.com/
- **cron-job.org**: https://cron-job.org/
- **GitHub Actions**: Create a scheduled workflow

Example configuration:
- **URL**: `https://your-domain.com/api/cron/finalize-rounds`
- **Method**: GET or POST
- **Schedule**: Every minute (`* * * * *`)
- **Header**: `Authorization: Bearer YOUR_CRON_SECRET`

### Option 3: Windows Task Scheduler (Local Development)

1. Create a PowerShell script `finalize-rounds.ps1`:
```powershell
$url = "http://localhost:3000/api/cron/finalize-rounds"
$headers = @{
    "Authorization" = "Bearer your-cron-secret"
}
Invoke-RestMethod -Uri $url -Method Get -Headers $headers
```

2. Schedule with Task Scheduler:
   - Open Task Scheduler
   - Create Basic Task
   - Trigger: Every 1 minute
   - Action: Start a program
   - Program: `powershell.exe`
   - Arguments: `-File "C:\path\to\finalize-rounds.ps1"`

### Option 4: Linux/Mac Crontab

Add to crontab (`crontab -e`):
```bash
* * * * * curl -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3000/api/cron/finalize-rounds
```

## Environment Variables

Add to your `.env` file:

```env
# Optional: Secret for protecting cron endpoint
CRON_SECRET=your-secure-random-string-here
```

## Round Status Flow

```
pending → active → completed
              ↓
         tiebreaker → (manual resolution) → completed
```

## Example Scenarios

### Scenario 1: Normal Round (All Teams Bid Correctly)

**Setup**:
- 3 teams: A, B, C
- Required bids: 3
- All teams place 3 bids each

**Bids**:
- Team A: Player 1 ($5000), Player 2 ($4000), Player 3 ($3000)
- Team B: Player 1 ($4500), Player 2 ($4200), Player 4 ($3500)
- Team C: Player 1 ($4800), Player 3 ($3800), Player 5 ($3200)

**Allocation**:
1. Team A gets Player 1 for $5000 (highest bid)
2. Team B gets Player 2 for $4200 (highest remaining after A removed)
3. Team C gets Player 3 for $3800 (highest remaining after A, B removed)

### Scenario 2: Team with Incomplete Bids

**Setup**:
- 3 teams: A, B, C
- Required bids: 3
- Team C only places 2 bids (incomplete)

**Phase 1**: Teams A and B get their players normally

**Phase 2**: 
- Average winning price from Phase 1 = $4500
- Team C's remaining bids: Player 4 ($3000), Player 5 ($2500)
- Player 1, 2, 3 already sold
- Team C gets Player 4 for **$4500** (average price, not $3000)

### Scenario 3: Tie Detected

**Setup**:
- Team A bids $5000 on Player 1
- Team B bids $5000 on Player 1

**Result**:
- Finalization stops
- Round status → `tiebreaker`
- Admin initiates tiebreaker
- Teams A and B submit new bids
- Finalization resumes

## Testing

### Manual Test (Admin)

1. Create a round with `end_time` in the past or present
2. Call: `POST /api/admin/rounds/[id]/finalize`
3. Check database for:
   - Bid statuses updated
   - Team players created
   - Team budgets decreased
   - Player statuses changed to 'sold'
   - Round status changed to 'completed'

### Automatic Test (Cron)

1. Create a round with `end_time` in the past
2. Call: `GET /api/cron/finalize-rounds`
3. Verify same database changes as above

### Test with Incomplete Bids

1. Create round with `max_bids_per_team = 3`
2. Team A places 3 bids
3. Team B places 3 bids
4. Team C places only 1 bid
5. Finalize round
6. Verify Team C gets average price penalty

## Error Handling

The system handles:
- ✅ No active bids in round
- ✅ Tie detection
- ✅ Database transaction failures
- ✅ Multiple expired rounds simultaneously
- ✅ Teams with no valid bids
- ✅ Already completed rounds

## Future Enhancements

- [ ] Tiebreaker UI implementation
- [ ] Email notifications to teams when round finalizes
- [ ] Detailed finalization history/logs
- [ ] Admin dashboard showing finalization statistics
- [ ] Rollback functionality for finalization errors

## Support

For issues or questions, contact the development team.
