# Tiebreaker System - Quick Reference

## 🚀 Quick Start

### For Developers

1. **Setup Database**:
   ```bash
   npx tsx scripts/create-tiebreaker-tables.ts
   ```

2. **Test Endpoints**:
   - GET `/api/admin/tiebreakers` - List all tiebreakers
   - GET `/api/team/tiebreakers` - Team's tiebreakers
   - POST `/api/tiebreakers/[id]/submit` - Submit bid
   - POST `/api/tiebreakers/[id]/resolve` - Resolve tiebreaker

### For Committee Admins

1. **Access Tiebreaker Management**:
   - Navigate to: `/dashboard/committee/tiebreakers`
   - View all tiebreakers with real-time updates

2. **Resolve a Tiebreaker**:
   - Click "Resolve" → Selects highest bid as winner
   - Click "Exclude" → No team gets the player

### For Teams

1. **When You Have a Tiebreaker**:
   - Alert will show on your dashboard
   - Click to view tiebreaker details
   - Submit a higher bid before time expires
   - Monitor status in real-time

## 📊 Database Quick Reference

### Key Tables

```sql
-- Main tiebreaker record
tiebreakers (
  id, round_id, player_id, original_amount,
  status, winning_team_id, winning_amount,
  duration_minutes, created_at, resolved_at
)

-- Team participation in tiebreaker
team_tiebreakers (
  id, tiebreaker_id, team_id, original_bid_id,
  new_bid_amount, submitted, submitted_at
)
```

### Status Values
- `active` - Tiebreaker is open for bids
- `resolved` - Winner selected
- `excluded` - No winner (player not allocated)

## 🔌 API Endpoints Summary

| Method | Endpoint | Access | Purpose |
|--------|----------|--------|---------|
| GET | `/api/tiebreakers/[id]` | Team/Admin | View tiebreaker details |
| POST | `/api/tiebreakers/[id]/submit` | Team | Submit new bid |
| POST | `/api/tiebreakers/[id]/resolve` | Admin | Resolve tiebreaker |
| GET | `/api/admin/tiebreakers` | Admin | List all tiebreakers |
| GET | `/api/team/tiebreakers` | Team | Team's tiebreakers |

## 🎯 Key Functions

```typescript
// Create tiebreaker
createTiebreaker(roundId, playerId, tiedBids)

// Check status
isTiebreakerExpired(tiebreakerId)
allTeamsSubmitted(tiebreakerId)
shouldAutoResolve(tiebreakerId)

// Resolve
resolveTiebreaker(tiebreakerId, 'auto' | 'exclude')
```

## 🔄 Workflow States

```
1. TIE DETECTED
   ↓
2. TIEBREAKER CREATED (status: 'active')
   ↓
3. TEAMS SUBMIT BIDS
   ↓
4. ALL SUBMITTED OR EXPIRED
   ↓
5. RESOLUTION
   ├─→ AUTO: Winner = Highest bid
   └─→ EXCLUDE: No winner
   ↓
6. STATUS UPDATED ('resolved' or 'excluded')
```

## 🎨 UI Routes

- **Committee**: `/dashboard/committee/tiebreakers`
- **Team Detail**: `/dashboard/team/tiebreaker/[id]`

## ⚡ Important Notes

### For Developers
- Always validate bid amounts against team budget
- Check tiebreaker status before accepting submissions
- Handle duplicate submission attempts gracefully
- Auto-refresh is critical for real-time experience

### For Admins
- Tiebreakers halt round finalization
- Must be resolved before completing round
- Can manually exclude if needed
- Monitor for expired tiebreakers

### For Teams
- You have 2 minutes by default
- New bid must be higher than original
- Cannot exceed your budget
- One submission per tiebreaker

## 🐛 Troubleshooting

### Tiebreaker Not Created
- Check `lib/finalize-round.ts` logs
- Verify tie detection logic
- Ensure database tables exist

### Cannot Submit Bid
- Check team budget
- Verify tiebreaker is still active
- Ensure team is part of tiebreaker
- Check for previous submission

### Resolution Fails
- Verify all teams have valid data
- Check for database constraints
- Look for tied new bids

## 📝 Testing Tips

1. **Create Test Tiebreaker**:
   ```sql
   INSERT INTO tiebreakers (round_id, player_id, original_amount, status)
   VALUES ('test-round', 'test-player', 1000, 'active');
   ```

2. **Test API**:
   ```bash
   # Get tiebreaker
   curl -H "Authorization: Bearer $TOKEN" \
        http://localhost:3000/api/tiebreakers/[id]

   # Submit bid
   curl -X POST -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d '{"newBidAmount": 1100}' \
        http://localhost:3000/api/tiebreakers/[id]/submit
   ```

3. **Check Database**:
   ```sql
   -- View active tiebreakers
   SELECT * FROM tiebreakers WHERE status = 'active';

   -- View team submissions
   SELECT * FROM team_tiebreakers WHERE tiebreaker_id = 'xxx';
   ```

## 🔍 Monitoring Queries

```sql
-- Active tiebreakers
SELECT t.*, p.name as player_name 
FROM tiebreakers t
JOIN footballplayers p ON t.player_id = p.id
WHERE t.status = 'active';

-- Expired but unresolved
SELECT * FROM tiebreakers 
WHERE status = 'active' 
AND created_at + (duration_minutes * INTERVAL '1 minute') < NOW();

-- Team submission status
SELECT 
  t.id,
  COUNT(*) as total_teams,
  COUNT(*) FILTER (WHERE tt.submitted = true) as submitted
FROM tiebreakers t
JOIN team_tiebreakers tt ON t.id = tt.tiebreaker_id
WHERE t.status = 'active'
GROUP BY t.id;
```

## 🎓 Best Practices

1. **Always check tiebreaker status** before operations
2. **Validate budgets** before accepting bids
3. **Use transactions** for critical operations
4. **Log all tiebreaker events** for auditing
5. **Auto-refresh UI** for real-time updates
6. **Handle edge cases**: no submissions, new ties
7. **Provide clear feedback** to users
8. **Monitor performance** of tiebreaker queries

## 📚 Related Documentation

- Full Implementation: `TIEBREAKER_IMPLEMENTATION_SUMMARY.md`
- Database Schema: `scripts/create-tiebreaker-tables.ts`
- Core Logic: `lib/tiebreaker.ts`
- Finalization: `lib/finalize-round.ts`

## 💡 Quick Tips

- **Committee**: Use filters to quickly find active tiebreakers
- **Teams**: Quick bid button adds £10 to original amount
- **Developers**: Use console logs for debugging tie detection
- **Testing**: Create manual tiebreakers to test UI flow
