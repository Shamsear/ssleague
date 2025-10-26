# 🔄 Transfer System - Dynamic Values & Player Releases

## Overview

Teams can **release players** and **select new ones** throughout the season. Player prices and team values are **dynamic** - they change based on performance.

---

## 🎯 Core Concepts

### **1. Player Value Changes**
```
Player's star rating increases → Price increases
Player's star rating decreases → Price decreases

Example:
Player A bought at 3★ for €3M
Player A performs well → Now 4★
Player A's new price: €4M (+€1M)

If you release Player A, you get €4M back (new value)
```

### **2. Team Value Changes**
```
All teams start with SAME base value: €10M

Team performance affects value:
- Win: +€0.5M
- Draw: +€0.1M
- Loss: -€0.2M
- Clean Sheet: +€0.3M
- High Scoring (4+ goals): +€0.3M

Example:
Team Alpha: Starts at €10M
After 5 wins, 2 draws: €10M + (5×€0.5M) + (2×€0.1M) = €12.7M

Team Beta: Starts at €10M
After 2 wins, 3 losses: €10M + (2×€0.5M) - (3×€0.2M) = €10.4M
```

### **3. Transfer Rules**
```
Teams can make transfers:
- 2 FREE transfers per matchday
- Additional transfers cost €2M each
- Release player → Get current market value back
- Sign player → Pay current market value
- Budget adjusts automatically
```

---

## 📊 Database Schema Updates

### **1. Player Prices (Dynamic)**
```typescript
fantasy_player_prices {
  id: "price_ronaldo_league_xyz"
  fantasy_league_id: "league_xyz"
  player_id: "sspslpsl0001"
  player_name: "Ronaldo"
  
  // Current Market Value
  current_price: 15000000          // €15M (changes dynamically)
  original_price: 15000000         // €15M (admin set initially)
  
  // Price History
  price_changes: [
    {
      from_price: 15000000,
      to_price: 16000000,
      reason: "star_rating_increased",
      from_stars: 9,
      to_stars: 10,
      changed_at: Timestamp
    },
    {
      from_price: 16000000,
      to_price: 15500000,
      reason: "star_rating_decreased",
      from_stars: 10,
      to_stars: 9,
      changed_at: Timestamp
    }
  ]
  
  // Current Stats
  star_rating: 10                  // From realplayer
  category: "legend"
  position: "FWD"
  points: 450
  
  // Ownership
  current_ownership: 3
  owned_by_teams: ["team_a", "team_b", "team_c"]
  
  updated_at: Timestamp
}
```

### **2. Team Values (Dynamic)**
```typescript
fantasy_team_values {
  id: "value_team_alpha_league_xyz"
  fantasy_league_id: "league_xyz"
  real_team_id: "team_alpha"
  real_team_name: "Team Alpha"
  
  // Current Market Value
  current_value: 12700000          // €12.7M (dynamic)
  base_value: 10000000             // €10M (all teams start equal)
  
  // Performance Tracking
  performance_stats: {
    wins: 5,
    draws: 2,
    losses: 1,
    clean_sheets: 3,
    high_scoring_matches: 2
  }
  
  // Value Changes
  value_changes: [
    {
      from_value: 10000000,
      to_value: 10500000,
      reason: "win",
      match_id: "match_123",
      changed_at: Timestamp
    },
    {
      from_value: 10500000,
      to_value: 10800000,
      reason: "clean_sheet",
      match_id: "match_123",
      changed_at: Timestamp
    }
    // ... more changes
  ]
  
  // Affiliation Count
  affiliated_fantasy_teams: 2      // How many fantasy teams support this team
  
  updated_at: Timestamp
}
```

### **3. Team Draft State (Updated)**
```typescript
fantasy_team_drafts {
  id: "draft_team_abc"
  fantasy_team_id: "team_abc"
  fantasy_league_id: "league_xyz"
  
  // Team Affiliation (Can Change)
  affiliated_team_id: "team_alpha"
  affiliated_team_name: "Team Alpha"
  affiliation_cost: 12700000        // Current value €12.7M
  affiliation_locked: false         // Can change if not locked
  
  // Budget Tracking (Dynamic)
  total_budget: 100000000           // €100M (admin set)
  budget_spent: 75200000            // €75.2M (includes team + players)
  budget_remaining: 24800000        // €24.8M
  
  // Budget Breakdown
  player_budget_spent: 62500000     // €62.5M on players
  team_affiliation_spent: 12700000  // €12.7M on team
  
  // Transfer Tracking
  free_transfers_remaining: 2       // Per matchday
  paid_transfers_made: 0            // Cost €2M each
  total_transfer_cost: 0            // €0M
  
  // Drafted Players
  players_drafted: [
    {
      player_id: "sspslpsl0001",
      player_name: "Ronaldo",
      purchase_price: 15000000,      // What you paid
      current_value: 16000000,       // Current market value
      profit_loss: 1000000,          // €1M profit if released
      position: "FWD",
      star_rating: 10,
      drafted_at: Timestamp
    }
    // ... 14 more players
  ]
  
  // Position Counts
  position_counts: { GK: 2, DEF: 5, MID: 5, FWD: 3 }
  
  // Status
  locked: false
  
  created_at: Timestamp
  updated_at: Timestamp
}
```

### **4. Transfer History**
```typescript
fantasy_transfers {
  id: "transfer_001"
  fantasy_team_id: "team_abc"
  fantasy_league_id: "league_xyz"
  matchday: 5
  
  // Transfer Type
  type: "player_release" | "player_sign" | "team_change"
  
  // Player Transfer
  player_id: "sspslpsl0001"
  player_name: "Ronaldo"
  purchase_price: 15000000
  sale_price: 16000000
  profit_loss: 1000000              // +€1M profit
  
  // OR Team Transfer
  old_team_id: "team_alpha"
  new_team_id: "team_beta"
  old_team_value: 12700000
  new_team_value: 10400000
  
  // Cost
  was_free_transfer: true
  transfer_fee: 0                   // €0 (free) or €2M (paid)
  
  created_at: Timestamp
}
```

---

## 🔄 Dynamic Value Updates

### **Player Value Update (Automatic)**

**Trigger:** When realplayer's `star_rating` changes

```typescript
// Pseudo-code
ON realplayer.star_rating CHANGE:
  
  old_stars = previous_value
  new_stars = current_value
  
  // Calculate new price
  old_price = star_rating_to_price(old_stars)
  new_price = star_rating_to_price(new_stars)
  
  // Update fantasy_player_prices
  UPDATE fantasy_player_prices
  SET current_price = new_price
  ADD TO price_changes {
    from_price: old_price,
    to_price: new_price,
    reason: "star_rating_changed",
    from_stars: old_stars,
    to_stars: new_stars,
    changed_at: NOW()
  }
  
  // Notify all teams that own this player
  NOTIFY teams in owned_by_teams:
    "Player {name} value changed: {old_price} → {new_price}"
```

**Price Formula:**
```typescript
function star_rating_to_price(stars: number): number {
  // Option 1: Linear
  return stars * 1000000; // €1M per star
  
  // Option 2: Tiered (Recommended)
  if (stars >= 9) return 15000000;      // €15M
  if (stars >= 7) return 10000000;      // €10M
  if (stars >= 5) return 7000000;       // €7M
  if (stars >= 3) return 4000000;       // €4M
  return 2000000;                       // €2M
}
```

---

### **Team Value Update (Automatic)**

**Trigger:** After each match result

```typescript
// Pseudo-code
AFTER match_result_entered FOR team_id:
  
  // Get match result
  result = "win" | "draw" | "loss"
  clean_sheet = goals_conceded === 0
  high_scoring = goals_scored >= 4
  
  // Calculate value change
  value_change = 0
  
  if (result === "win"):
    value_change += 500000          // +€0.5M
  else if (result === "draw"):
    value_change += 100000          // +€0.1M
  else if (result === "loss"):
    value_change -= 200000          // -€0.2M
  
  if (clean_sheet):
    value_change += 300000          // +€0.3M
  
  if (high_scoring):
    value_change += 300000          // +€0.3M
  
  // Update fantasy_team_values
  old_value = current_value
  new_value = current_value + value_change
  
  UPDATE fantasy_team_values
  SET current_value = new_value
  ADD TO value_changes {
    from_value: old_value,
    to_value: new_value,
    reason: result,
    match_id: match_id,
    changed_at: NOW()
  }
  
  // Update all fantasy teams with this affiliation
  UPDATE fantasy_team_drafts
  WHERE affiliated_team_id = team_id
  SET affiliation_cost = new_value
  RECALCULATE budget_spent
```

---

## 🎮 Transfer Workflows

### **1. Release Player & Sign New One**

```
TEAM MANAGER FLOW:

1. View Squad
   ├─→ See current players with values
   ├─→ Ronaldo: Bought €15M → Now €16M (+€1M)
   └─→ Silva: Bought €8M → Now €7M (-€1M)

2. Release Player
   ├─→ Click "Release Ronaldo"
   ├─→ Confirm: "Release Ronaldo? Get €16M back"
   └─→ Budget updates: +€16M

3. Sign New Player
   ├─→ Browse available players
   ├─→ Messi: Current price €14M
   ├─→ Click "Sign Messi"
   └─→ Budget updates: -€14M

4. Result
   ├─→ Net change: -€15M (original) +€16M (release) -€14M (sign) = -€13M
   └─→ Transfer recorded (1 free transfer used)
```

### **2. Change Team Affiliation**

```
TEAM MANAGER FLOW:

1. View Current Affiliation
   ├─→ Team Alpha: €12.7M
   └─→ Performance: 5W-2D-1L (Good!)

2. Release Team
   ├─→ Click "Change Team"
   ├─→ Confirm: "Release Team Alpha? Get €12.7M back"
   └─→ Budget updates: +€12.7M

3. Select New Team
   ├─→ Browse available teams with values
   ├─→ Team Beta: €10.4M (Cheaper, but weaker)
   ├─→ Team Gamma: €13.2M (Expensive, but strong)
   ├─→ Click "Select Team Beta"
   └─→ Budget updates: -€10.4M

4. Result
   ├─→ Net change: -€12.7M +€12.7M -€10.4M = -€10.4M
   ├─→ Gained €2.3M by switching to cheaper team
   └─→ Transfer recorded (1 free transfer used)
```

---

## 🖥️ User Interface

### **Transfer Page:**

```
┌───────────────────────────────────────────────────────────────┐
│ 🔄 TRANSFERS                                                  │
│ Matchday 5 • Free Transfers: 2 remaining                     │
├───────────────────────────────────────────────────────────────┤
│ YOUR TEAM AFFILIATION:                                        │
│ ⚽ Team Alpha • €12.7M                                         │
│ Performance: 5W-2D-1L • Value: €10M → €12.7M (+€2.7M)       │
│ [Change Team] (Uses 1 transfer)                              │
├───────────────────────────────────────────────────────────────┤
│ YOUR SQUAD (15 players • €62.5M total value):                │
│                                                               │
│ ⚽ Ronaldo • FWD • 10★                                         │
│ Bought: €15M → Now: €16M (↗️ +€1M)                           │
│ [Release & Get €16M] (Uses 1 transfer)                       │
│                                                               │
│ ⚽ Messi • FWD • 9★                                            │
│ Bought: €12M → Now: €12M (→ €0)                              │
│ [Release & Get €12M] (Uses 1 transfer)                       │
│                                                               │
│ 🛡️ Silva • MID • 7★                                           │
│ Bought: €8M → Now: €7M (↘️ -€1M)                             │
│ [Release & Get €7M] (Uses 1 transfer)                        │
│                                                               │
│ ... (12 more players)                                        │
│                                                               │
│ Total Squad Value: €62.5M (Purchase: €61M, Profit: +€1.5M)  │
├───────────────────────────────────────────────────────────────┤
│ BUDGET SUMMARY:                                               │
│ Total Budget: €100M                                          │
│ Spent: €75.2M (Team: €12.7M + Players: €62.5M)              │
│ Available: €24.8M                                            │
├───────────────────────────────────────────────────────────────┤
│ TRANSFER OPTIONS:                                             │
│ • 2 free transfers remaining this matchday                   │
│ • Extra transfers cost €2M each                              │
│ • Release player → Get current market value                  │
│ • Sign player → Pay current market value                     │
│                                                               │
│ [Browse Players to Sign] [View Team Values]                  │
└───────────────────────────────────────────────────────────────┘
```

---

### **Browse Available Players (with Current Values):**

```
┌───────────────────────────────────────────────────────────────┐
│ AVAILABLE PLAYERS FOR TRANSFER                                │
│ Budget Available: €24.8M                                      │
├───────────────────────────────────────────────────────────────┤
│ [Search: ____] [Position: All ▼] [Price ▼] [Value Change ▼] │
│                                                               │
│ ⚽ Kane • FWD • 8★                                             │
│ Current Price: €11M (Was €10M, ↗️ +€1M)                      │
│ Ownership: 1 team • Points: 380                              │
│ [Sign for €11M] (Uses 1 transfer)                            │
│                                                               │
│ ⚽ De Bruyne • MID • 9★                                        │
│ Current Price: €13M (Was €15M, ↘️ -€2M) • VALUE!            │
│ Ownership: 2 teams • Points: 410                             │
│ [Sign for €13M] (Uses 1 transfer)                            │
│                                                               │
│ 🛡️ Ramos • DEF • 7★                                           │
│ Current Price: €7M (Unchanged)                               │
│ Ownership: UNIQUE! • Points: 280                             │
│ [Sign for €7M] (Uses 1 transfer)                             │
│                                                               │
│ ... (scroll for more)                                        │
└───────────────────────────────────────────────────────────────┘
```

---

### **Browse Teams (with Current Values):**

```
┌───────────────────────────────────────────────────────────────┐
│ AVAILABLE TEAMS FOR AFFILIATION                               │
│ Budget Available: €24.8M                                      │
│ Current Affiliation: Team Alpha (€12.7M)                     │
├───────────────────────────────────────────────────────────────┤
│ ⚽ Team Alpha • €12.7M (Currently Your Team)                  │
│ Standing: 1st • 5W-2D-1L • Value: ↗️ +€2.7M                  │
│ [Keep This Team]                                              │
│                                                               │
│ ⚽ Team Beta • €10.4M (Cheaper!)                              │
│ Standing: 5th • 2W-2D-3L • Value: ↗️ +€0.4M                  │
│ [Switch to Team Beta] Net: +€2.3M gain                       │
│                                                               │
│ ⚽ Team Gamma • €13.2M (More Expensive)                       │
│ Standing: 2nd • 4W-3D-0L • Value: ↗️ +€3.2M                  │
│ [Switch to Team Gamma] Net: -€0.5M cost                      │
│                                                               │
│ ⚽ Team Delta • €9.8M (Budget Option)                         │
│ Standing: 8th • 1W-2D-4L • Value: ↘️ -€0.2M                  │
│ [Switch to Team Delta] Net: +€2.9M gain (Risk!)             │
│                                                               │
│ ... (8 more teams)                                           │
└───────────────────────────────────────────────────────────────┘
```

---

## 🔧 APIs Needed

### **Transfer APIs:**
```typescript
// Release player
POST /api/fantasy/transfers/release-player
Body: {
  fantasy_team_id: "team_abc",
  player_id: "sspslpsl0001"
}
Response: {
  success: true,
  refund_amount: 16000000,  // Current market value
  budget_remaining: 40800000
}

// Sign player
POST /api/fantasy/transfers/sign-player
Body: {
  fantasy_team_id: "team_abc",
  player_id: "sspslpsl0045"
}
Response: {
  success: true,
  cost: 14000000,
  budget_remaining: 26800000,
  free_transfers_remaining: 1
}

// Change team affiliation
POST /api/fantasy/transfers/change-team
Body: {
  fantasy_team_id: "team_abc",
  new_team_id: "team_beta"
}
Response: {
  success: true,
  old_team_refund: 12700000,
  new_team_cost: 10400000,
  net_change: 2300000,
  budget_remaining: 29100000
}

// Get transfer status
GET /api/fantasy/transfers/status?team_id=team_abc
Response: {
  free_transfers_remaining: 2,
  paid_transfers_made: 0,
  transfer_window_open: true,
  current_matchday: 5
}
```

---

## ✅ Validation Rules

```typescript
Release Player:
✓ Player must be in your squad
✓ Refund = current market value (not purchase price)
✓ Uses 1 free transfer (or €2M if no free transfers)

Sign Player:
✓ Budget remaining >= current market value
✓ Position limits not exceeded
✓ Squad size < roster_size
✓ Uses 1 free transfer (or €2M if no free transfers)

Change Team:
✓ Must have budget for new team
✓ Refund old team at current value
✓ Pay new team at current value
✓ Uses 1 free transfer (or €2M if no free transfers)

Transfer Limits:
✓ 2 free transfers per matchday
✓ Additional transfers cost €2M each
✓ Unlimited paid transfers allowed
```

---

## 🎯 Strategic Implications

### **Player Value Trading:**
```
Buy Low, Sell High Strategy:
1. Buy undervalued 3★ players early (€3M each)
2. Wait for them to perform well → Upgrade to 4★
3. Sell at new value (€4M each) → €1M profit per player
4. Use profits to buy better players

Risk: Player might drop stars instead!
```

### **Team Value Speculation:**
```
Underdog Strategy:
1. Buy weak team early (€9.5M)
2. They surprisingly win 3 matches → Value rises to €11M
3. Switch to stronger team later, pocketing the difference

Safe Strategy:
1. Buy best team (€13M)
2. Hold all season for consistent bonuses
3. Value likely stays high or increases
```

### **Transfer Timing:**
```
Early Season: Lock in good players before they rise
Mid Season: Sell overperformers, buy underperformers
Late Season: Hold strong team for playoff bonuses
```

---

## 📈 Summary

**Dynamic Player Values:**
- Prices change with star_rating
- Sell for current value (not purchase price)
- Can profit from good picks

**Dynamic Team Values:**
- All start at €10M
- Increase with wins/clean sheets
- Decrease with losses
- Trade teams based on value

**Transfer System:**
- 2 free per matchday
- Extra = €2M each
- Release → Refund at current value
- Sign → Pay current value

**Strategic Depth:**
- Value trading opportunities
- Risk/reward decisions
- Budget management critical
- Timing matters

Should I build this transfer system?