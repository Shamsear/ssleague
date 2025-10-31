# Player Transfer/Release/Swap System

## 🎯 Overview

Complete system for committee admins to manage player movements between teams with automatic financial calculations and transaction tracking.

## ✅ Features Implemented

### 1. **Release Player to Free Agent**
- Player released from team
- Team receives 70% refund of remaining contract value
- Player marked as free agent
- Transaction logged

### 2. **Transfer Player Between Teams**
- Player moves from Team A to Team B
- Team A receives release refund (70% of remaining value)
- Team B pays new contract value (80% of original by default)
- Both team balances updated automatically
- Transaction logged

### 3. **Swap Players Between Teams**
- Player A and Player B swap teams
- Optional fee paid by either team
- Both team balances adjusted
- Transaction logged

---

## 📁 Files Created

### Core Library
- **`lib/player-transfers.ts`** - Main transfer logic with calculations

### API Routes
- **`app/api/players/release/route.ts`** - Release player endpoint
- **`app/api/players/transfer/route.ts`** - Transfer player endpoint
- **`app/api/players/swap/route.ts`** - Swap players endpoint

---

## 🔧 API Documentation

### 1. Release Player

**Endpoint:** `POST /api/players/release`

**Body:**
```json
{
  "player_id": "player123",
  "season_id": "SSPSLS16",
  "released_by": "user_uid",
  "released_by_name": "Committee Admin"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Player released successfully. Team refunded $350",
  "refund_amount": 350,
  "player_name": "John Doe",
  "previous_team_id": "team123"
}
```

**Refund Calculation:**
- Formula: `(auction_value × remaining_contract_percentage) × 0.7`
- 70% refund of remaining contract value
- Example: $500 contract, 1 season remaining of 2 total = $500 × 0.5 × 0.7 = $175

---

### 2. Transfer Player

**Endpoint:** `POST /api/players/transfer`

**Body:**
```json
{
  "player_id": "player123",
  "new_team_id": "team456",
  "new_contract_value": 400,
  "season_id": "SSPSLS16",
  "transferred_by": "user_uid",
  "transferred_by_name": "Committee Admin"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Transfer completed. Old team refunded $350, New team paid $400",
  "old_team_id": "team123",
  "new_team_id": "team456",
  "old_team_refund": 350,
  "new_team_cost": 400,
  "player_name": "John Doe"
}
```

**Financial Flow:**
- Old Team: Receives release refund (70% of remaining)
- New Team: Pays new contract value (configurable)
- Budgets updated automatically

---

### 3. Swap Players

**Endpoint:** `POST /api/players/swap`

**Body:**
```json
{
  "player_a_id": "player123",
  "player_b_id": "player456",
  "fee_amount": 100,
  "season_id": "SSPSLS16",
  "swapped_by": "user_uid",
  "swapped_by_name": "Committee Admin"
}
```

**Fee Amount:**
- **Positive** (e.g., 100): Team A pays $100 to Team B
- **Negative** (e.g., -100): Team B pays $100 to Team A
- **Zero** (0): No fee, straight swap

**Response:**
```json
{
  "success": true,
  "message": "Swap completed successfully. Team A paid $100 to Team B",
  "player_a": {
    "name": "John Doe",
    "from_team": "team123",
    "to_team": "team456"
  },
  "player_b": {
    "name": "Jane Smith",
    "from_team": "team456",
    "to_team": "team123"
  },
  "fee": {
    "amount": 100,
    "paid_to": "team456"
  }
}
```

---

## 💾 Database Changes

### Player Document Updates

**On Release:**
```javascript
{
  team_id: null,
  status: 'free_agent',
  released_at: timestamp,
  released_by: user_uid,
  released_by_name: admin_name,
  release_refund: amount,
  previous_team_id: old_team_id
}
```

**On Transfer:**
```javascript
{
  team_id: new_team_id,
  auction_value: new_contract_value,
  previous_team_id: old_team_id,
  transferred_at: timestamp,
  transferred_by: user_uid,
  transferred_by_name: admin_name,
  status: 'active'
}
```

**On Swap:**
```javascript
{
  team_id: new_team_id,
  previous_team_id: old_team_id,
  swapped_at: timestamp,
  swapped_by: user_uid,
  swapped_by_name: admin_name,
  status: 'active'
}
```

### Team Balance Updates

All operations update `team_seasons` document:
```javascript
{
  dollar_balance: updated_balance,
  updated_at: timestamp
}
```

### Transaction Log

All operations create a record in `player_transactions` collection:

**Release Transaction:**
```javascript
{
  transaction_type: 'release',
  player_id: string,
  player_name: string,
  team_id: string,
  season_id: string,
  refund_amount: number,
  auction_value: number,
  processed_by: string,
  processed_by_name: string,
  created_at: timestamp
}
```

**Transfer Transaction:**
```javascript
{
  transaction_type: 'transfer',
  player_id: string,
  player_name: string,
  old_team_id: string,
  new_team_id: string,
  season_id: string,
  refund_to_old_team: number,
  cost_to_new_team: number,
  new_contract_value: number,
  processed_by: string,
  processed_by_name: string,
  created_at: timestamp
}
```

**Swap Transaction:**
```javascript
{
  transaction_type: 'swap',
  player_a_id: string,
  player_a_name: string,
  player_b_id: string,
  player_b_name: string,
  team_a_id: string,
  team_b_id: string,
  season_id: string,
  fee_amount: number,
  fee_paid_by: string | null,
  fee_paid_to: string | undefined,
  processed_by: string,
  processed_by_name: string,
  created_at: timestamp
}
```

---

## 🧮 Calculation Examples

### Example 1: Release Player
- **Original Contract:** $500 (2 seasons)
- **Contract Progress:** 1 season completed, 1 remaining
- **Remaining Percentage:** 1/2 = 50%
- **Refund:** $500 × 0.50 × 0.70 = **$175**

### Example 2: Transfer Player
- **Old Team:** Receives $175 refund (from Example 1)
- **New Team:** Pays $400 (new contract value set by admin)
- **Net Effect:**
  - Old Team: +$175 balance
  - New Team: -$400 balance

### Example 3: Swap with Fee
- **Player A** ($500 value) swaps with **Player B** ($300 value)
- **Fee:** Team A pays $100 to Team B (to balance values)
- **Net Effect:**
  - Team A: -$100 balance, gains Player B
  - Team B: +$100 balance, gains Player A

---

## 🚀 Next Steps: Build Committee UI

### Recommended Pages to Build:

1. **`/dashboard/committee/players/transfers`** - Main transfer management page
   - Three tabs: Release, Transfer, Swap
   - Player selection dropdowns
   - Financial preview before confirmation
   - Transaction history

2. **`/dashboard/committee/players/free-agents`** - Free agents list
   - View all released players
   - Re-auction capabilities

3. **`/dashboard/committee/transactions`** - Transaction audit log
   - All releases, transfers, swaps
   - Financial tracking
   - Export capabilities

---

## ✅ Testing Checklist

### Release Testing
- [ ] Release player with partial contract
- [ ] Release player with full contract remaining
- [ ] Verify refund calculation
- [ ] Check team balance update
- [ ] Verify player status = 'free_agent'
- [ ] Check transaction log created

### Transfer Testing
- [ ] Transfer player between teams
- [ ] Verify old team refund
- [ ] Verify new team charge
- [ ] Check budget constraints
- [ ] Verify player team_id update
- [ ] Check transaction log

### Swap Testing
- [ ] Swap with no fee
- [ ] Swap with Team A paying fee
- [ ] Swap with Team B paying fee
- [ ] Verify budget constraints
- [ ] Check both players updated
- [ ] Verify fee calculation
- [ ] Check transaction log

---

## 📊 System Benefits

✅ **Automated Calculations** - No manual math required
✅ **Budget Safety** - Validates team budgets before transactions
✅ **Audit Trail** - Complete transaction history
✅ **Flexible** - Three operation types cover all scenarios
✅ **Fair Refunds** - 70% of remaining contract value
✅ **Real-time Updates** - Immediate balance adjustments

---

## 🔒 Security Notes

- All operations require committee admin authentication
- Budget validation prevents overdrafts
- Transaction logs provide accountability
- Player status checks prevent invalid operations
- Team existence validation before operations

---

## 🎓 Usage Tips

1. **Release before Transfer** - If unsure about new team, release first then let them re-bid
2. **Use Swap for Fair Trades** - Swap + fee balances unequal player values
3. **Check Budget First** - Preview calculations before confirming
4. **Review Transaction Log** - Audit trail for league transparency

---

## 📝 Future Enhancements (Optional)

- [ ] Email notifications to team owners
- [ ] Multi-player trades (3+ teams)
- [ ] Trade deadline enforcement
- [ ] Trade approval workflow
- [ ] Free agent re-auction system
- [ ] Transfer market analytics
- [ ] Historical transfer trends

---

**System Status:** ✅ **BACKEND COMPLETE**
**Next Step:** Build Committee Admin UI Pages
