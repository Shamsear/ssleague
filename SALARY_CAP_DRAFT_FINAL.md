# 💰 Salary Cap Draft System - Final Design

## System Overview

### **Core Features:**
1. ✅ **Admin-Defined Budget** - Admin sets total budget per team (e.g., €100M, €150M, etc.)
2. ✅ **Admin-Defined Player Prices** - Admin manually sets each player's price
3. ✅ **Team Affiliation** - Each fantasy team selects 1 real team for bonuses
4. ✅ **Roster Requirements** - Admin sets size and position limits
5. ✅ **Duplicate Players Allowed** - Multiple fantasy teams can own same player
6. ✅ **Diluted Scoring** - Points divided by ownership count

---

## 🎯 Draft Flow

```
1. Admin Setup
   ├─→ Create fantasy league
   ├─→ Set budget: €100M (or any amount)
   ├─→ Set roster requirements: 15 players (GK/DEF/MID/FWD limits)
   ├─→ Manually set price for each player (€1M - €20M)
   └─→ Open draft

2. Team Drafting
   ├─→ STEP 1: Select Real Team Affiliation
   │   └─→ Choose 1 real team from season
   │       └─→ Get team bonuses when they win/clean sheet
   │
   └─→ STEP 2: Build Player Squad
       ├─→ Browse 100+ players with prices
       ├─→ Add players within €100M budget
       ├─→ Meet position requirements (2 GK, 4 DEF, 4 MID, 3 FWD)
       └─→ Lock squad when complete

3. Draft Completion
   ├─→ Calculate ownership counts
   ├─→ Set point dilution multipliers
   └─→ Fantasy league starts
```

---

## 📊 Database Schema

### **1. Draft Settings (Admin Configured)**
```typescript
fantasy_draft_settings {
  id: "draft_settings_league_xyz"
  fantasy_league_id: "league_xyz"
  season_id: "season16"
  
  // Budget (Admin Defined)
  team_budget: 100000000              // €100M (admin can change)
  
  // Roster Requirements (Admin Defined)
  roster_size: 15
  min_players_per_position: {
    GK: 2,
    DEF: 4,
    MID: 4,
    FWD: 3
  }
  max_players_per_position: {
    GK: 3,
    DEF: 6,
    MID: 6,
    FWD: 5
  }
  
  // Team Affiliation
  require_team_affiliation: true      // Must pick real team
  
  // Draft Timeline
  draft_opens_at: Timestamp
  draft_closes_at: Timestamp
  status: "open" | "closed"
  
  // Scoring
  dilution_enabled: true              // Points ÷ ownership
  
  created_by: "admin_uid"
  created_at: Timestamp
  updated_at: Timestamp
}
```

### **2. Player Prices (Admin Sets Manually)**
```typescript
fantasy_player_prices {
  id: "price_ronaldo_league_xyz"
  fantasy_league_id: "league_xyz"
  
  // Player Reference
  player_id: "sspslpsl0001"           // realplayer ID
  player_name: "Ronaldo"
  real_team_id: "team_alpha"
  real_team_name: "Team Alpha"
  
  // Player Attributes (from realplayer)
  star_rating: 10
  category: "legend"
  position: "FWD"
  points: 450                         // Season points so far
  
  // Price (ADMIN SETS THIS)
  price: 15000000                     // €15M (admin manually entered)
  
  // Ownership Tracking
  current_ownership: 0                // How many teams own
  owned_by_teams: []                  // Array of fantasy_team_ids
  
  // Admin Notes
  price_notes: "Elite striker, high demand"
  
  created_at: Timestamp
  updated_at: Timestamp
}
```

### **3. Fantasy Team Draft State**
```typescript
fantasy_team_drafts {
  id: "draft_team_abc"
  fantasy_team_id: "team_abc"
  fantasy_league_id: "league_xyz"
  
  // Team Affiliation (NEW)
  affiliated_team_id: "team_alpha"    // Real team they support
  affiliated_team_name: "Team Alpha"  // For display
  affiliation_locked: true            // Can't change after locking
  
  // Budget Tracking
  total_budget: 100000000             // €100M
  budget_spent: 73000000              // €73M
  budget_remaining: 27000000          // €27M
  
  // Drafted Players
  players_drafted: [
    {
      player_id: "sspslpsl0001",
      player_name: "Ronaldo",
      price_paid: 15000000,
      position: "FWD",
      star_rating: 10,
      from_affiliated_team: false,    // Not from Team Alpha
      drafted_at: Timestamp
    },
    {
      player_id: "sspslpsl0023",
      player_name: "Silva",
      price_paid: 8000000,
      position: "MID",
      star_rating: 7,
      from_affiliated_team: true,     // From Team Alpha!
      drafted_at: Timestamp
    }
    // ... 13 more players
  ]
  
  // Position Counts
  position_counts: {
    GK: 2,
    DEF: 5,
    MID: 5,
    FWD: 3
  }
  
  // Status
  draft_complete: false
  locked: false
  locked_at: Timestamp | null
  
  created_at: Timestamp
  updated_at: Timestamp
}
```

### **4. Player Ownership (Auto-Calculated)**
```typescript
fantasy_player_ownership {
  id: "ownership_ronaldo_league_xyz"
  fantasy_league_id: "league_xyz"
  player_id: "sspslpsl0001"
  player_name: "Ronaldo"
  
  // Ownership
  owned_by_teams: ["team_abc", "team_def", "team_ghi"]
  ownership_count: 3
  
  // Dilution Factor
  points_multiplier: 0.333            // 1 ÷ 3
  
  updated_at: Timestamp
}
```

---

## 🎮 Admin Workflow

### **Admin Dashboard: Set Player Prices**

```
┌────────────────────────────────────────────────────────┐
│ SET PLAYER PRICES - Season 16 Fantasy                 │
├────────────────────────────────────────────────────────┤
│ Budget Per Team: [€100M ▼]  [Update]                 │
│ Roster Size: [15 ▼]                                   │
├────────────────────────────────────────────────────────┤
│ [Search: ____] [Position: All ▼] [Team: All ▼]       │
│                                                        │
│ PLAYER PRICES (120 players)                           │
│                                                        │
│ ⚽ Ronaldo • Team Alpha • FWD • 10★                    │
│ Price: [€15M] 💰  [Save] [Quick: €10M €15M €20M]     │
│ Ownership: 0 teams                                    │
│                                                        │
│ ⚽ Messi • Team Beta • FWD • 9★                        │
│ Price: [€12M] 💰  [Save] [Quick: €10M €12M €15M]     │
│ Ownership: 0 teams                                    │
│                                                        │
│ 🛡️ Van Dijk • Team Gamma • DEF • 8★                   │
│ Price: [€10M] 💰  [Save] [Quick: €8M €10M €12M]      │
│ Ownership: 0 teams                                    │
│                                                        │
│ ... (117 more players)                                │
│                                                        │
│ [💾 Save All Prices] [📋 Copy Prices from Last Season]│
│ [🎲 Auto-Set by Stars] [📊 Price Distribution Chart] │
└────────────────────────────────────────────────────────┘

Auto-Set Options:
• Linear: Price = Star Rating × €1M
• Exponential: Price = €1M × (Star ^ 1.5)
• Tiered: 9-10★ = €15M, 7-8★ = €10M, 5-6★ = €7M, 3-4★ = €4M
```

---

## 🏆 Team Manager Workflow

### **Step 1: Select Team Affiliation**

```
┌───────────────────────────────────────────────────────┐
│ STEP 1: SELECT YOUR TEAM                             │
├───────────────────────────────────────────────────────┤
│ Choose the real team you want to support.            │
│ You'll earn bonus points when they win or perform    │
│ well (from Phase 5 Team Bonuses system).            │
│                                                       │
│ AVAILABLE TEAMS:                                      │
│                                                       │
│ ⚽ Team Alpha                                          │
│ Current Standing: 1st • 24 points • 4 wins          │
│ Players in pool: 12 players available               │
│ [Select This Team →]                                 │
│                                                       │
│ ⚽ Team Beta                                           │
│ Current Standing: 3rd • 18 points • 3 wins          │
│ Players in pool: 10 players available               │
│ [Select This Team →]                                 │
│                                                       │
│ ⚽ Team Gamma                                          │
│ Current Standing: 5th • 12 points • 2 wins          │
│ Players in pool: 8 players available                │
│ [Select This Team →]                                 │
│                                                       │
│ ... (8 more teams)                                   │
│                                                       │
│ ⚠️ Note: You can draft players from ANY team,        │
│          not just your affiliated team!              │
└───────────────────────────────────────────────────────┘
```

**Strategic Considerations:**
- **Pick Best Team**: More likely to win → More team bonuses
- **Pick Your Actual Team**: Emotional investment, loyalty
- **Pick Underdog**: Differential (if they surprise, huge bonuses!)

---

### **Step 2: Build Player Squad**

```
┌───────────────────────────────────────────────────────────────┐
│ 💰 BUILD YOUR SQUAD                                           │
│ Affiliated Team: ⚽ Team Alpha                                │
│ Budget: €27M / €100M  |  Players: 11/15  |  [Lock Squad]    │
├───────────────────────────────────────────────────────────────┤
│ [Search: ____] [Position: All ▼] [Team: All ▼] [Price ▼]    │
│ [Show: All ▼] [Only Unique] [From My Team]                  │
│                                                               │
│ AVAILABLE PLAYERS (120 players)                              │
│                                                               │
│ ⚽ Ronaldo • Team Alpha • FWD • 10★                           │
│ Price: €15M • 450 pts • 👥 2 teams own • ⭐ YOUR TEAM       │
│ [Add to Squad →]                                              │
│                                                               │
│ ⚽ Messi • Team Beta • FWD • 9★                               │
│ Price: €12M • 420 pts • 👥 3 teams own                      │
│ [Add to Squad →]                                              │
│                                                               │
│ 🛡️ Silva • Team Alpha • MID • 7★                             │
│ Price: €8M • 280 pts • 👥 0 teams • ⭐ YOUR TEAM • UNIQUE!  │
│ [Add to Squad →]                                              │
│                                                               │
│ ... (scroll for more)                                        │
├───────────────────────────────────────────────────────────────┤
│ YOUR SQUAD:                                                   │
│ ✓ Ronaldo  €15M  FWD  10★  ⭐ Team Alpha  👥 Shared         │
│ ✓ Messi    €12M  FWD   9★  Team Beta      👥 Shared         │
│ ✓ Silva    €8M   MID   7★  ⭐ Team Alpha  👥 UNIQUE!        │
│ ✓ Ramos    €7M   DEF   7★  Team Gamma     👥 Shared         │
│ ... (7 more needed)                                          │
│                                                               │
│ Position Check:                                              │
│ ✓ GK: 1/2  ⚠️ DEF: 1/4  ⚠️ MID: 1/4  ✓ FWD: 2/3            │
│                                                               │
│ Players from your team: 2 (Silva, Ronaldo)                  │
│                                                               │
│ [💾 Save Progress] [🔒 Lock & Submit Squad]                  │
└───────────────────────────────────────────────────────────────┘
```

---

## ⚖️ Scoring System

### **Player Points (Diluted by Ownership)**
```
Match Result:
Ronaldo (Team Alpha) scores 2 goals + MOTM = 25 fantasy points

Ownership:
- Fantasy Team A owns Ronaldo
- Fantasy Team B owns Ronaldo
- Fantasy Team C owns Ronaldo
→ Ownership Count: 3

Distribution:
Team A: 25 ÷ 3 = 8.33 points
Team B: 25 ÷ 3 = 8.33 points
Team C: 25 ÷ 3 = 8.33 points

If Team D owns unique player "Silva" who scores 15 points:
Team D: 15 ÷ 1 = 15 points (FULL!)

Result: Unique pick > Popular pick
```

### **Team Affiliation Bonuses (From Phase 5)**
```
Team Alpha wins match 4-0 (clean sheet + high scoring)

Bonuses:
+5 Win
+3 Clean Sheet
+2 High Scoring (4+ goals)
= +10 bonus points

All fantasy teams affiliated with Team Alpha get +10 points!

Fantasy Team A (affiliated with Team Alpha):
Player points: 45 (from drafted players)
Team bonus: +10 (Team Alpha won)
Total: 55 points

Fantasy Team D (affiliated with Team Gamma - lost):
Player points: 52 (from drafted players)
Team bonus: 0 (Team Gamma lost)
Total: 52 points

Result: Team A wins despite lower player points!
```

---

## 🔧 APIs Needed

### **Admin APIs:**
```typescript
// Set player price
POST /api/fantasy/draft/admin/set-price
Body: {
  fantasy_league_id: "league_xyz",
  player_id: "sspslpsl0001",
  price: 15000000
}

// Bulk set prices (auto-calculate)
POST /api/fantasy/draft/admin/auto-price
Body: {
  fantasy_league_id: "league_xyz",
  pricing_model: "linear" | "exponential" | "tiered"
}

// Update budget
POST /api/fantasy/draft/admin/set-budget
Body: {
  fantasy_league_id: "league_xyz",
  team_budget: 150000000  // €150M
}
```

### **Team Manager APIs:**
```typescript
// Select team affiliation
POST /api/fantasy/draft/select-team
Body: {
  fantasy_team_id: "team_abc",
  real_team_id: "team_alpha"
}

// Add player to squad
POST /api/fantasy/draft/add-player
Body: {
  fantasy_team_id: "team_abc",
  player_id: "sspslpsl0001"
}

// Remove player from squad
POST /api/fantasy/draft/remove-player
Body: {
  fantasy_team_id: "team_abc",
  player_id: "sspslpsl0001"
}

// Lock squad
POST /api/fantasy/draft/lock-squad
Body: {
  fantasy_team_id: "team_abc"
}
```

---

## ✅ Validation Rules

```typescript
Team Affiliation:
✓ Must select 1 real team from season
✓ Cannot change after locking squad
✗ Cannot select team that doesn't exist

Add Player:
✓ Budget remaining >= player price
✓ Players count < roster_size
✓ Position count < max_per_position
✗ Squad is locked
✗ Draft is closed

Lock Squad:
✓ Team affiliation selected
✓ Players count = roster_size (15)
✓ All position minimums met (2 GK, 4 DEF, 4 MID, 3 FWD)
✓ Budget not exceeded
✗ Already locked
```

---

## 🎯 Strategic Depth

### **Team Affiliation Strategy:**
1. **Safe**: Pick best team (most likely to win → reliable bonuses)
2. **Differential**: Pick underdog (if they overperform, massive bonuses!)
3. **Emotional**: Pick your favorite team (fun, but might not win)

### **Player Selection Strategy:**
1. **Balanced**: Mix of elite + mid-tier + budget players
2. **Stars & Scrubs**: 3-4 elite stars + cheap fillers
3. **Differential**: All unique players (risky but high reward)
4. **Affiliation Stacking**: Draft players from your affiliated team (loyalty bonus)

### **Budget Management:**
```
Example Squads:

Squad A (Balanced):
- 3 elite (€15M ea) = €45M
- 5 good (€8M ea) = €40M
- 7 budget (€2M ea) = €14M
Total: €99M / €100M ✓

Squad B (Stars & Scrubs):
- 5 elite (€15M ea) = €75M
- 10 minimum (€2.5M ea) = €25M
Total: €100M ✓

Squad C (All Mid-Tier):
- 15 players (€6.67M ea) = €100M
Total: €100M ✓
```

---

## 📈 Summary

**Admin Control:**
- Sets budget (€100M, €150M, etc.)
- Sets player prices manually OR auto-calculate
- Defines roster requirements
- Opens/closes draft

**Team Manager Control:**
- Selects 1 real team affiliation
- Builds 15-player squad within budget
- Meets position requirements
- Locks squad when ready

**System Auto-Calculates:**
- Ownership counts
- Point dilution multipliers
- Team bonus distributions
- Leaderboard rankings

Should I start building this system?