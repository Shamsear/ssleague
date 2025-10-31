# Player Transfer System - Quick Start Guide

## 🚀 Getting Started

### Prerequisites
- Committee Admin access
- Active season with registered players
- Teams with sufficient balance

---

## 📍 Access the System

Navigate to:
```
/dashboard/committee/players/transfers
```

---

## 🎯 Three Operations

### 1. Release Player (70% Refund)
```typescript
// Steps:
1. Select player type (Real/Football)
2. Choose player from dropdown
3. Review refund preview
4. Click "Release to Free Agency"

// Result:
✅ Player status → free_agent
✅ Team balance + refund
✅ News entry created
```

### 2. Transfer Player
```typescript
// Steps:
1. Select player type
2. Choose player to transfer
3. Select target team
4. Set new contract value
5. Choose contract duration (0.5, 1, 1.5, 2 seasons)
6. Review preview
7. Click "Execute Transfer"

// Result:
✅ Old team + refund (70%)
✅ New team - cost
✅ Player moves to new team
✅ Contract updated
```

### 3. Swap Players
```typescript
// Steps:
1. Select player type
2. Choose Player A
3. Choose Player B (different team)
4. Optional: Set fee
   - None (straight swap)
   - A pays B
   - B pays A
5. Review preview
6. Click "Execute Swap"

// Result:
✅ Players swap teams
✅ Fee transferred (if any)
✅ News entry created
```

---

## 💡 Tips

### Release Best Practices
- Check contract remaining value before release
- Consider timing (mid-season vs end)
- Review team balance after refund

### Transfer Guidelines
- New contract can be different from old
- Fractional seasons allow flexible contracts
- Both teams must have active season records

### Swap Strategies
- Use fee to balance unequal player values
- Can't swap players on same team
- Both players must have active status

---

## ⚠️ Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| "Player not found" | Invalid player_id | Check season data |
| "Insufficient funds" | Low team balance | Increase balance or reduce cost |
| "Already free agent" | Player has no team | Use different player |
| "Same team" | Swap with same team | Choose players from different teams |

---

## 🧪 Testing Checklist

Before going live:
- [ ] Test release with real player
- [ ] Test release with football player
- [ ] Test transfer between teams
- [ ] Test swap with no fee
- [ ] Test swap with fee
- [ ] Verify balances update
- [ ] Check news entries created
- [ ] Confirm transaction records

---

## 📊 Quick Reference

### Refund Formula
```
Refund = Original Value × (Remaining Seasons / Total Seasons) × 0.7
```

### Contract Durations
- `0.5` = Half season
- `1.0` = Full season
- `1.5` = One and a half seasons
- `2.0` = Two seasons

### Player Status Flow
```
active → (release) → free_agent
active → (transfer) → active (new team)
active (Team A) ↔ (swap) ↔ active (Team B)
```

---

## 🔗 API Endpoints

For programmatic access:
```
POST /api/players/release
POST /api/players/transfer
POST /api/players/swap
GET  /api/stats/players (real players)
GET  /api/football-players (football players)
```

---

## 📞 Support

Need help? Check:
1. Full documentation: `docs/PLAYER_TRANSFER_SYSTEM.md`
2. System test: `node scripts/test-transfer-system.js`
3. Schema check: `node scripts/check-footballplayers-schema.js`

---

## ✅ Ready to Use!

The system is fully operational. Head to the transfers page and start managing your team roster!
