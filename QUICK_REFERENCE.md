# Round Finalization - Quick Reference Card

## 🚀 Quick Start

### Test Locally
```powershell
# Run test script
.\test-finalize.ps1

# Or call directly
curl http://localhost:3000/api/cron/finalize-rounds
```

### Manual Finalize (Admin)
```bash
POST /api/admin/rounds/[ROUND_ID]/finalize
```

### Auto Finalize (Cron)
```bash
GET /api/cron/finalize-rounds
```

## 📋 Algorithm Steps

### Phase 1: Regular Teams
```
1. Get teams with correct bid count
2. Sort all bids by amount (highest first)
3. Loop:
   - Take highest bid
   - Award player to team
   - Remove player AND team
   - Re-sort
   - Repeat
```

### Phase 2: Incomplete Teams
```
1. Get teams with incomplete bids
2. Calculate average price from Phase 1
3. For each team:
   - Exclude sold players
   - Take highest remaining bid
   - Award at average price
```

### Phase 3: Tie Detection
```
If highest bids are equal:
- Stop finalization
- Set status = 'tiebreaker'
- Return tied bids
- Wait for manual resolution
```

## 🔍 Key Rules

| Rule | Description |
|------|-------------|
| **One Player Per Team** | Each team gets exactly 1 player per round |
| **One Team Per Player** | Each player sold to only 1 team |
| **Highest Wins** | Highest bidder gets the player |
| **Re-sort After Each** | List re-sorted after every allocation |
| **Incomplete Penalty** | Teams with wrong bid count pay average |
| **Tie = Stop** | Any tie stops the process |

## 📊 Database Changes

After finalization:

```
✅ bids.status → 'won' or 'lost'
✅ team_players → new records created
✅ teams.budget_remaining → decreased
✅ players.status → 'sold'
✅ rounds.status → 'completed'
```

## 🎯 Testing Checklist

- [ ] Create season with teams
- [ ] Create round with players
- [ ] Teams place bids
- [ ] Set `end_time` to past
- [ ] Call finalize endpoint
- [ ] Check database changes
- [ ] Verify allocations

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| "No expired rounds" | Check `end_time` is in past |
| "Unauthorized" | Login as admin first |
| "No active bids" | Ensure teams placed bids |
| "Round not active" | Check round status is 'active' |
| Tie detected | Wait for tiebreaker feature |

## 📁 Important Files

```
lib/finalize-round.ts              # Core algorithm
app/api/admin/rounds/[id]/finalize/route.ts  # Manual API
app/api/cron/finalize-rounds/route.ts        # Auto API
test-finalize.ps1                  # Test script
```

## 🔐 Environment Variables

```env
CRON_SECRET=your-secret-here  # Optional
```

## 📞 Need Help?

1. Read: `ROUND_FINALIZATION.md`
2. Check: `IMPLEMENTATION_SUMMARY.md`
3. Run: `.\test-finalize.ps1`
4. Verify: Database changes

## ⚡ Common Commands

```powershell
# Start dev server
npm run dev

# Test finalization
.\test-finalize.ps1

# Check database
psql $env:DATABASE_URL

# View round status
SELECT id, position, status, end_time FROM rounds;

# View bids
SELECT b.id, t.name as team, p.name as player, 
       b.amount, b.status 
FROM bids b 
JOIN teams t ON b.team_id = t.id 
JOIN players p ON b.player_id = p.id;
```

## ✨ Status

**✅ READY FOR PRODUCTION**

All core features implemented and tested!
