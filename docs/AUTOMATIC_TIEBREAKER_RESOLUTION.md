# Automatic Tiebreaker Resolution

## Overview
Tiebreakers now automatically resolve when the last team submits their bid. This eliminates the need for manual admin intervention and speeds up the auction process.

## How It Works

### 1. Initial Tie Detection
When a round is finalized and multiple teams have the same highest bid for a player:
- A tiebreaker is created with status `'active'`
- All tied teams are notified
- No time limit is set (teams can submit when ready)

### 2. Team Bid Submission
Teams submit their tiebreaker bids via the API:
```
POST /api/tiebreakers/[id]/submit
Body: { newBidAmount: number }
```

After each submission:
- The bid is validated (must be >= original tied amount)
- The bid is recorded in `team_tiebreakers` table
- **NEW:** System checks if all teams have now submitted

### 3. Automatic Resolution (NEW!)
When the last team submits their bid:
- System automatically calls `resolveTiebreaker(tiebreakerId, 'auto')`
- This happens immediately, no admin action needed

### 4. Resolution Outcomes

#### A. Clear Winner
If one team has the highest bid:
- Tiebreaker status → `'resolved'`
- Winner team ID and amount are recorded
- Round can now be finalized successfully

#### B. Another Tie
If multiple teams still have the same highest bid:
- Current tiebreaker status → `'tied_again'`
- **NEW tiebreaker is automatically created** with the new tied amount
- Tied teams must submit again for the new tiebreaker
- Process repeats until there's a clear winner

#### C. No Submissions / Exclude
If no teams submit or admin manually excludes:
- Tiebreaker status → `'excluded'`
- Player is not allocated in this round

## Database Schema

### Tiebreaker Statuses
- `'active'` - Waiting for team submissions
- `'resolved'` - Winner determined
- `'tied_again'` - New tie occurred, new tiebreaker created
- `'excluded'` - Removed from allocation

### Key Tables
```sql
-- Tiebreakers
CREATE TABLE tiebreakers (
  id UUID PRIMARY KEY,
  round_id UUID NOT NULL,
  player_id UUID NOT NULL,
  original_amount INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  winning_team_id UUID,
  winning_amount INTEGER,
  duration_minutes INTEGER, -- NULL for no time limit
  created_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP
);

-- Team Tiebreaker Bids
CREATE TABLE team_tiebreakers (
  id UUID PRIMARY KEY,
  tiebreaker_id UUID NOT NULL,
  team_id UUID NOT NULL,
  original_bid_id UUID NOT NULL,
  new_bid_amount INTEGER,
  submitted BOOLEAN DEFAULT false,
  submitted_at TIMESTAMP
);
```

## Admin Dashboard Changes

### Viewing Tiebreakers
The committee admin rounds page now fetches tiebreakers with multiple statuses:
```typescript
// Before: Only 'active'
/api/admin/tiebreakers?status=active

// After: Both 'active' and 'tied_again'
/api/admin/tiebreakers?status=active,tied_again
```

This ensures tiebreakers that resulted in new ties are still visible.

### Manual Resolution (Still Available)
Admins can still manually resolve tiebreakers if needed:
```
POST /api/tiebreakers/[id]/resolve
Body: { resolutionType: 'auto' | 'exclude' }
```

## API Response Format

### Successful Auto-Resolution
```json
{
  "success": true,
  "message": "Bid submitted and tiebreaker resolved automatically",
  "data": {
    "tiebreakerId": "uuid",
    "newBidAmount": 150000,
    "submittedAt": "2025-10-05T14:20:00Z",
    "autoResolved": true,
    "resolution": {
      "status": "resolved",
      "winningTeamId": "team-uuid",
      "winningAmount": 150000
    }
  }
}
```

### Another Tie Detected
```json
{
  "success": true,
  "message": "Bid submitted and tiebreaker resolved automatically",
  "data": {
    "tiebreakerId": "old-uuid",
    "newBidAmount": 150000,
    "submittedAt": "2025-10-05T14:20:00Z",
    "autoResolved": true,
    "resolution": {
      "status": "tied_again",
      "newTiebreakerId": "new-uuid"
    }
  }
}
```

## Workflow Example

### Scenario: Three teams bid £100,000 for Player A

1. **Round Finalization**
   - Admin clicks "Finalize Round"
   - System detects tie, creates Tiebreaker TB1
   - Teams A, B, C notified

2. **Tiebreaker Submissions**
   - Team A submits £120,000 → Response: `{ autoResolved: false }`
   - Team B submits £110,000 → Response: `{ autoResolved: false }`
   - Team C submits £120,000 → Response: `{ autoResolved: true, status: 'tied_again', newTiebreakerId: 'TB2' }`
   
   **Result:** TB1 status = 'tied_again', new Tiebreaker TB2 created for Teams A & C at £120,000

3. **Second Tiebreaker**
   - Team A submits £125,000 → Response: `{ autoResolved: false }`
   - Team C submits £130,000 → Response: `{ autoResolved: true, status: 'resolved', winningTeamId: 'C' }`
   
   **Result:** TB2 status = 'resolved', Team C wins Player A for £130,000

4. **Final Round Finalization**
   - Admin clicks "Finalize Round" again
   - System finds resolved TB2
   - Player A allocated to Team C for £130,000
   - Round status → 'completed'

## Benefits

✅ **Faster Resolution** - No waiting for admin to manually resolve  
✅ **Automatic Chaining** - Handles multiple tie rounds seamlessly  
✅ **Clear Feedback** - Teams know immediately if they won or need to bid again  
✅ **Reduced Admin Work** - Committee only finalizes rounds, not individual tiebreakers  

## Migration Notes

This is a **non-breaking change**:
- Existing manual resolution still works
- Old tiebreakers are unaffected
- No database migrations required
- Frontend code is forward-compatible

## Testing Checklist

- [ ] Single tiebreaker resolves correctly
- [ ] Repeated ties create new tiebreakers
- [ ] Budget validation still works
- [ ] Admin dashboard shows all tiebreaker statuses
- [ ] Round finalization uses resolved tiebreaker winners
- [ ] Proper logging throughout the flow
