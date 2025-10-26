# 💰 Salary Cap Draft System - Complete Design

## Based on Your RealPlayer Schema

Your system has:
- `star_rating` (3-10 stars) - Player quality
- `points` - Performance points from matches
- `category` - 'legend' or 'classic'

---

## 🎯 How It Works

### **Core Concept:**
- **Budget Per Team**: €100M (or $100,000)
- **Player Prices**: Based on star_rating
- **Roster Size**: Admin-defined (e.g., 15 players)
- **Manager Selection**: Each team picks 1 manager (themselves or another person)
- **Team Affiliation**: Each team picks 1 real team to support
- **Duplicate Players Allowed**: Yes, multiple teams can draft the same player
- **Scoring Twist**: Points diluted by ownership count

---

## 💵 Player Pricing Formula

### **Option 1: Star Rating × Base Price**
```typescript
Base Price = €1M per star

Player with 10 stars = €10M
Player with 8 stars = €8M
Player with 5 stars = €5M
Player with 3 stars = €3M

Total budget: €100M
Average squad of 15 players: €6.67M each
```

### **Option 2: Exponential Pricing (More Realistic)**
```typescript
Price Formula: €1M × (star_rating ^ 1.5)

10 stars = €1M × (10^1.5) = €31.6M
9 stars = €1M × (9^1.5) = €27M
8 stars = €1M × (8^1.5) = €22.6M
7 stars = €1M × (7^1.5) = €18.5M
6 stars = €1M × (6^1.5) = €14.7M
5 stars = €1M × (5^1.5) = €11.2M
4 stars = €1M × (4^1.5) = €8M
3 stars = €1M × (3^1.5) = €5.2M

This makes elite players very expensive
Can only afford 3-4 top stars + budget players
```

### **Option 3: Category-Based Pricing (Recommended)**
```typescript
Legend Players (top performers):
- 10 stars = €15M
- 9 stars = €12M
- 8 stars = €10M

Classic Players (regular):
- 7 stars = €7M
- 6 stars = €5M
- 5 stars = €4M
- 4 stars = €3M
- 3 stars = €2M

Total budget: €100M for 15 players
Forces strategic mix of legends + classics
```

---

## 📊 Draft Configuration (Admin Settings)

### **League Settings Document:**
```typescript
fantasy_draft_settings {
  id: "draft_config_league_xyz"
  fantasy_league_id: "league_xyz"
  
  // Roster Requirements
  roster_size: 15                 // Total players per team
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
  
  // Budget Settings
  team_budget: 100000000          // €100M
  pricing_model: "category"       // "linear" | "exponential" | "category"
  
  // Manager & Team Selection
  require_manager: true           // Must select manager
  require_team_affiliation: true  // Must select team
  
  // Draft Timeline
  draft_opens_at: Timestamp
  draft_closes_at: Timestamp
  
  // Scoring Rules
  dilution_enabled: true          // Points ÷ ownership_count
  min_unique_players: 5           // Force some uniqueness
  
  created_at: Timestamp
  updated_at: Timestamp
}
```

---

## 🗃️ Database Schema

### **1. Player Prices (Generated from realplayer)**
```typescript
fantasy_player_prices {
  id: "price_ronaldo_league_xyz"
  fantasy_league_id: "league_xyz"
  player_id: "sspslpsl0001"       // realplayer ID
  player_name: "Ronaldo"
  star_rating: 10
  category: "legend"
  base_price: 15000000             // €15M
  current_ownership: 0             // How many teams own him
  
  // Player info from realplayer
  team_id: "team_abc"
  position: "FWD"
  points: 450                      // Season points
  
  created_at: Timestamp
}
```

### **2. Team Draft State**
```typescript
fantasy_team_drafts {
  id: "draft_team_abc"
  fantasy_team_id: "team_abc"
  fantasy_league_id: "league_xyz"
  
  // Manager & Team Selection (NEW)
  manager_id: "user_123"           // User ID of selected manager
  manager_name: "John Doe"         // Manager's name
  affiliated_team_id: "team_xyz"   // Real team ID
  affiliated_team_name: "Real Madrid" // Real team name
  
  // Budget Tracking
  total_budget: 100000000          // €100M
  budget_spent: 73000000           // €73M
  budget_remaining: 27000000       // €27M
  
  // Roster
  players_drafted: [
    {
      player_id: "sspslpsl0001",
      player_name: "Ronaldo",
      price_paid: 15000000,          // €15M
      position: "FWD",
      star_rating: 10,
      drafted_at: Timestamp
    },
    {
      player_id: "sspslpsl0045",
      player_name: "Messi",
      price_paid: 14000000,          // €14M
      position: "FWD",
      star_rating: 9,
      drafted_at: Timestamp
    }
    ... (13 more players)
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
  
  created_at: Timestamp
  updated_at: Timestamp
}
```

### **3. Player Ownership Tracking**
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
  points_multiplier: 0.333         // 1 ÷ ownership_count
  
  updated_at: Timestamp
}
```

---

## 🎮 Draft Process (Step-by-Step)

### **Phase 1: Admin Setup**
```
1. Admin creates fantasy league
2. Admin configures draft settings:
   - Roster size: 15
   - Budget: €100M
   - Position requirements
   - Draft deadline: March 15, 8 PM
3. System generates player prices from realplayer collection:
   FOR EACH realplayer in season:
     - Get star_rating
     - Calculate price based on category
     - Create fantasy_player_prices document
4. Draft opens → Teams can start building squads
```

### **Phase 2: Team Drafting (Self-Service)**
```
Team Manager Flow:
1. Navigate to /dashboard/team/fantasy/draft

2. STEP 1: Select Manager
   - Choose yourself OR another person
   - Enter manager name
   - This person will manage the fantasy team

3. STEP 2: Select Team Affiliation
   - Choose 1 real team from season
   - Get team bonuses when they win (from Phase 5)
   - Strategic: Pick team with good players OR weak team for differential

4. STEP 3: Draft Players
   - See available players with prices
   - Filter by position, star rating, price
   - Click "Add to Squad" on player
   - Budget deducts: €100M → €85M → €73M...
   - Add 15 players within budget
   - Meet position requirements

5. STEP 4: Lock Squad
   - Review: Manager, Team, Players (15), Budget
   - Click "Lock & Submit Squad"
   - Cannot modify after locking
```

### **Phase 3: Draft Completion**
```
When deadline reaches OR all teams lock:
1. Calculate ownership counts
2. Generate fantasy_player_ownership documents
3. Set dilution multipliers
4. Lock all squads
5. Draft complete → Fantasy league starts
```

---

## 🖥️ User Interface

### **Draft Builder Page:**
```
┌───────────────────────────────────────────────────────────────┐
│ 💰 BUILD YOUR SQUAD                                           │
│ Budget: €27M / €100M  |  Players: 11/15  |  [Lock Squad]    │
├───────────────────────────────────────────────────────────────┤
│ [Search: ____] [Position: All ▼] [Stars: All ▼] [Price ▼]   │
│                                                               │
│ AVAILABLE PLAYERS (Search Results)                           │
│                                                               │
│ ⚽ Ronaldo                                                     │
│ FWD • ⭐⭐⭐⭐⭐⭐⭐⭐⭐⭐ (10★) • €15M                               │
│ Team Alpha • 450 points • 👥 2 teams own                     │
│ [Add to Squad →]                                              │
│                                                               │
│ ⚽ Messi                                                       │
│ FWD • ⭐⭐⭐⭐⭐⭐⭐⭐⭐ (9★) • €12M                                  │
│ Team Beta • 420 points • 👥 3 teams own                      │
│ [Add to Squad →]                                              │
│                                                               │
│ 🛡️ Van Dijk                                                   │
│ DEF • ⭐⭐⭐⭐⭐⭐⭐⭐ (8★) • €10M                                     │
│ Team Gamma • 380 points • 👥 UNIQUE! ⭐                       │
│ [Add to Squad →]                                              │
│                                                               │
│ ... (scroll for 100+ players)                                │
├───────────────────────────────────────────────────────────────┤
│ YOUR SQUAD:                                                   │
│ ✓ Ronaldo  €15M  FWD  10★  👥 Shared                        │
│ ✓ Neymar   €10M  MID   8★  👥 Shared                        │
│ ✓ Kane     €8M   FWD   7★  👥 UNIQUE! ⭐                     │
│ ✓ Ramos    €7M   DEF   7★  👥 Shared                         │
│ ✓ Courtois €5M   GK    6★  👥 UNIQUE! ⭐                     │
│ ... (6 more players needed)                                  │
│                                                               │
│ Position Check: ✓ GK: 1/2  ⚠️ DEF: 1/4  ⚠️ MID: 1/4  ✓ FWD: 2/3│
│                                                               │
│ [💾 Save Progress] [🔒 Lock & Submit Squad]                  │
└───────────────────────────────────────────────────────────────┘
```

---

## ⚖️ Scoring System (Diluted by Ownership)

### **How Points Work:**

**Match Result:**
```
Ronaldo scores 2 goals + MOTM = 25 fantasy points

Ownership Status:
- Team A owns Ronaldo
- Team B owns Ronaldo
- Team C owns Ronaldo
→ Ownership Count: 3

Points Distribution:
Team A receives: 25 ÷ 3 = 8.33 points
Team B receives: 25 ÷ 3 = 8.33 points
Team C receives: 25 ÷ 3 = 8.33 points

If Team D had unique player "Kane" who scored 15 points:
Team D receives: 15 ÷ 1 = 15 points (FULL!)

Result: Team D (unique pick) > Team A/B/C (popular pick)
```

### **Strategic Implications:**
```
Scenario 1: All Elite Team
- Draft: Ronaldo, Messi, Neymar, etc. (all 9-10★)
- Cost: €120M+ (OVER BUDGET!)
- Can't afford it → Must pick cheaper players

Scenario 2: Balanced Team
- 3 elite (10★) = €45M
- 5 good (7★) = €35M
- 7 budget (4★) = €21M
- Total: €101M (over by €1M, adjust)

Scenario 3: Differential Strategy
- 2 elite unique picks = €30M
- 13 mid-tier unique picks = €70M
- All unique → Full points!
- Risky if picks underperform
```

---

## 🔧 APIs Needed

### **1. Generate Player Prices**
```typescript
POST /api/fantasy/draft/generate-prices
Body: { fantasy_league_id, pricing_model }
Response: { players_priced: 120, total_value: "€850M" }
```

### **2. Get Available Players**
```typescript
GET /api/fantasy/draft/available-players?league_id=xyz
Response: {
  players: [
    {
      player_id: "sspslpsl0001",
      name: "Ronaldo",
      star_rating: 10,
      price: 15000000,
      position: "FWD",
      ownership_count: 2,
      points: 450
    },
    ...
  ]
}
```

### **3. Add Player to Squad**
```typescript
POST /api/fantasy/draft/add-player
Body: {
  fantasy_team_id: "team_abc",
  player_id: "sspslpsl0001"
}
Response: {
  success: true,
  budget_remaining: 73000000,
  players_count: 11
}
```

### **4. Lock Squad**
```typescript
POST /api/fantasy/draft/lock-squad
Body: { fantasy_team_id: "team_abc" }
Response: {
  success: true,
  squad_locked: true,
  ownership_updated: true
}
```

---

## ✅ Validation Rules

```typescript
Can Add Player If:
✓ Budget remaining >= player price
✓ Players count < roster_size
✓ Position count < max_per_position
✓ Squad not locked

Can Lock Squad If:
✓ Players count = roster_size (15)
✓ All position minimums met
✓ Budget not exceeded

Cannot Modify If:
✗ Squad is locked
✗ Draft deadline passed
✗ League started
```

---

## 📈 Admin View

```
┌─────────────────────────────────────────────────┐
│ DRAFT OVERVIEW - Season 16 Fantasy              │
├─────────────────────────────────────────────────┤
│ Teams: 10                                       │
│ Draft Status: ✅ 8 complete, ⏳ 2 in progress  │
│ Deadline: March 15, 8 PM (3 hours remaining)   │
│                                                 │
│ Most Owned Players:                             │
│ 1. Ronaldo (8 teams) - Popular!               │
│ 2. Messi (7 teams)                             │
│ 3. Neymar (6 teams)                            │
│                                                 │
│ Unique Picks (Differential):                   │
│ • Team D owns Kane (0 others)                  │
│ • Team F owns Modric (0 others)                │
│                                                 │
│ [📊 View All Squads] [🔒 Force Lock All]       │
└─────────────────────────────────────────────────┘
```

---

## 🎯 Summary

**What Admin Sets:**
1. Roster size (e.g., 15 players)
2. Budget (e.g., €100M)
3. Position requirements
4. Draft deadline

**What System Does:**
1. Generates prices from star_rating
2. Tracks budget spending
3. Validates roster requirements
4. Calculates ownership dilution
5. Distributes points during matches

**What Teams Do:**
1. Browse available players
2. Add players within budget
3. Meet position requirements
4. Lock squad before deadline

Should I build this system?
