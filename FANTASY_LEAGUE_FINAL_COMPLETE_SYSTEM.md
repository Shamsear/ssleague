# Fantasy League - Complete System Design & Implementation

## 🎯 System Overview

### Core Concept
A **fantasy league based on real eFootball mobile players** competing in the main league. Features **tiered draft system**, **weekly lineup selection**, **player trading**, and **strategic squad management**.

### Context
- **Real Players**: eFootball mobile players (e.g., Player A plays for Team A)
- **Main League**: The actual tournament where teams compete
- **Fantasy League**: Parallel competition where users draft these real players
- **Points**: Based on real match performance in the main league

---

## 📋 Complete Feature List

### 1. Squad Management
- **Squad Size**: 5-7 players (admin configurable, e.g., 3-5, 5-7, 7-9)
- **Exclusive Ownership**: One player = One team only
- **Budget System**: €100M starting budget

### 2. Draft System
- **Tiered Lists**: Players divided into tiers by points/rating
- **Round-by-Round**: Each team picks one player per tier
- **Skip or Bid**: Teams can skip a tier or bid on players
- **Fair Distribution**: Equal opportunity across all tiers

### 3. Transfer System
- **Release Phase**: Teams release players first (creates available pool)
- **Draft Phase**: Bid on newly available players
- **Sale**: Sell player to another team (direct negotiation)
- **Swap**: Exchange players with another team

### 4. Weekly Lineup Selection
- **Starting Lineup**: Select X players from squad (e.g., 5 from 7)
- **Captain**: 2x points multiplier
- **Vice-Captain**: 1.5x points multiplier
- **Bench**: Remaining players (no points)
- **Deadline**: Lock before round starts

### 5. Points System
- **Only Starting Lineup Earns Points**: Bench players = 0 points
- **Captain Bonus**: 2x multiplier
- **Vice-Captain Bonus**: 1.5x multiplier
- **Passive Team Bonus**: Still applies

---

## 🎮 DETAILED SYSTEM FLOW

### Phase 1: Initial Draft (Season Start)

#### Step 1: Admin Preparation
```
Admin Actions:
1. Set squad size (e.g., 7 players)
2. Set number of tiers (e.g., 7 tiers for 7 players)
3. Generate tiered player lists
4. Set draft deadline (e.g., 7 days)
5. Notify teams
```

#### Step 2: Generate Tiered Lists
```
Algorithm:
1. Get all available players (300+ players)
2. Sort by total_points DESC
3. Divide into N equal tiers (N = squad size)

Example (20 teams, 7-player squads, 300 players):
Tier 1 (Elite): Top 20 players (Ronaldo, Messi, etc.)
Tier 2 (Stars): Next 20 players (Neymar, Salah, etc.)
Tier 3 (Quality): Next 20 players
Tier 4 (Good): Next 20 players
Tier 5 (Solid): Next 20 players
Tier 6 (Average): Next 20 players
Tier 7 (Depth): Next 20 players

Total: 140 players (20 teams × 7 players)
Remaining: 160 players (available for transfers)
```

#### Step 3: Teams Submit Bids Per Tier
```
For Each Tier:
- Team can SKIP (no bid)
- Team can BID (submit bid amount)

Example Team A's Bids:
Tier 1: Ronaldo - €25M
Tier 2: SKIP (saving budget)
Tier 3: Neymar - €15M
Tier 4: Kane - €10M
Tier 5: SKIP
Tier 6: Player X - €5M
Tier 7: Player Y - €3M

Total Bids: €58M (under €100M budget)
Expected Squad: 5 players (skipped 2 tiers)
```

#### Step 4: Process Draft (Tier by Tier)
```
Tier 1 Processing:
- 15 teams bid, 5 teams skip
- Highest 15 bidders win
- 5 teams that skipped get nothing from Tier 1

Tier 2 Processing:
- 18 teams bid (including 3 who lost Tier 1)
- Highest 18 bidders win
- 2 teams skip

Continue for all 7 tiers...

Final Result:
- Most teams have 5-7 players
- Some teams may have fewer (if they skipped too many)
- Budget varies (€20M - €80M remaining)
```

#### Step 5: Draft Results
```
Team A Results:
✅ Tier 1: Ronaldo - €25M (won, beat €22M)
❌ Tier 2: SKIPPED
✅ Tier 3: Neymar - €15M (won, beat €12M)
✅ Tier 4: Kane - €10M (won, beat €8M)
❌ Tier 5: SKIPPED
✅ Tier 6: Player X - €5M (won, beat €4M)
✅ Tier 7: Player Y - €3M (won, beat €2M)

Final Squad: 5 players
Budget Spent: €58M
Budget Remaining: €42M
```

---

### Phase 2: Weekly Lineup Selection

#### Step 1: Select Starting Lineup
```
Squad: 7 players
Must Select: 5 starters + 2 bench

Example:
Starting 5:
1. Ronaldo (Captain - 2x points)
2. Neymar (Vice-Captain - 1.5x points)
3. Kane
4. Player X
5. Player Y

Bench (0 points):
6. Player Z
7. Player W

Deadline: Friday 6 PM (before Round starts)
```

#### Step 2: Lock Lineup
```
After Deadline:
- Lineup locked (cannot change)
- Only starting 5 earn points
- Bench players earn 0 points
- Captain/VC multipliers applied
```

#### Step 3: Points Calculation
```
After Round Completes:
- Calculate points for starting 5 only
- Apply captain multiplier (2x)
- Apply vice-captain multiplier (1.5x)
- Bench players = 0 points
- Add passive team bonus
- Update leaderboard

Example:
Ronaldo (C): 20 base pts × 2 = 40 pts
Neymar (VC): 15 base pts × 1.5 = 22.5 pts
Kane: 10 base pts × 1 = 10 pts
Player X: 5 base pts × 1 = 5 pts
Player Y: 3 base pts × 1 = 3 pts
Bench: 0 pts

Total: 80.5 pts + passive bonus
```

---

### Phase 3: Transfer Windows

#### Step 1: Release Phase (48 hours)
```
Teams can release players:
- Select players to release
- Get back 80% of purchase price
- Released players go to available pool

Example:
Team A releases:
- Player X (bought for €5M) → Get back €4M
- Player Y (bought for €3M) → Get back €2.4M

New Budget: €42M + €6.4M = €48.4M
New Squad: 5 players (down from 7)
```

#### Step 2: Generate Available Player Lists
```
After Release Phase:
- Collect all released players
- Add undrafted players
- Sort by points
- Create new tiered lists

Example:
50 players released + 160 undrafted = 210 available
Create 7 tiers of 30 players each
```

#### Step 3: Transfer Draft (48 hours)
```
Same as initial draft:
- Teams bid on tiers
- Can skip or bid
- Highest bidder wins
- Fill squad back to 7 players
```

#### Step 4: Direct Sales & Swaps
```
After Transfer Draft:
Teams can negotiate directly:

SALE:
Team A → Team B: Player X for €10M
- Team A gets €10M
- Team B gets Player X
- Both teams agree

SWAP:
Team A ↔ Team B: Player X ↔ Player Y
- Team A gets Player Y
- Team B gets Player X
- Both teams agree
- Optional: Cash adjustment (€5M + Player X for Player Y)
```

---

## 🗄️ COMPLETE DATABASE SCHEMA

### New/Modified Tables

#### 1. fantasy_leagues (Modified)
```sql
ALTER TABLE fantasy_leagues
ADD COLUMN min_squad_size INTEGER DEFAULT 5,
ADD COLUMN max_squad_size INTEGER DEFAULT 7,
ADD COLUMN starting_lineup_size INTEGER DEFAULT 5,
ADD COLUMN number_of_tiers INTEGER DEFAULT 7,
ADD COLUMN lineup_lock_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN lineup_lock_hours_before INTEGER DEFAULT 2;
```

#### 2. fantasy_draft_tiers (New)
```sql
CREATE TABLE fantasy_draft_tiers (
  id SERIAL PRIMARY KEY,
  tier_id VARCHAR(100) UNIQUE NOT NULL,
  league_id VARCHAR(100) NOT NULL,
  draft_type VARCHAR(20) NOT NULL, -- 'initial', 'transfer'
  tier_number INTEGER NOT NULL,
  tier_name VARCHAR(100), -- 'Elite', 'Stars', 'Quality', etc.
  
  -- Player list
  player_ids JSONB NOT NULL, -- Array of player IDs in this tier
  player_count INTEGER NOT NULL,
  
  -- Tier stats
  min_points INTEGER,
  max_points INTEGER,
  avg_points DECIMAL(10,2),
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(league_id, draft_type, tier_number)
);

CREATE INDEX idx_draft_tiers_league ON fantasy_draft_tiers(league_id);
```

#### 3. fantasy_tier_bids (New)
```sql
CREATE TABLE fantasy_tier_bids (
  id SERIAL PRIMARY KEY,
  bid_id VARCHAR(100) UNIQUE NOT NULL,
  tier_id VARCHAR(100) NOT NULL REFERENCES fantasy_draft_tiers(tier_id),
  league_id VARCHAR(100) NOT NULL,
  team_id VARCHAR(100) NOT NULL,
  
  -- Bid details
  player_id VARCHAR(100) NOT NULL, -- Which player from tier
  bid_amount DECIMAL(10,2) NOT NULL,
  is_skip BOOLEAN DEFAULT FALSE, -- Team skipped this tier
  
  -- Status
  status VARCHAR(20) DEFAULT 'pending', -- pending, won, lost, skipped
  
  submitted_at TIMESTAMP DEFAULT NOW(),
  processed_at TIMESTAMP,
  
  UNIQUE(tier_id, team_id)
);

CREATE INDEX idx_tier_bids_tier ON fantasy_tier_bids(tier_id);
CREATE INDEX idx_tier_bids_team ON fantasy_tier_bids(team_id);
```

#### 4. fantasy_lineups (New)
```sql
CREATE TABLE fantasy_lineups (
  id SERIAL PRIMARY KEY,
  lineup_id VARCHAR(100) UNIQUE NOT NULL,
  league_id VARCHAR(100) NOT NULL,
  team_id VARCHAR(100) NOT NULL,
  round_id VARCHAR(100) NOT NULL,
  round_number INTEGER NOT NULL,
  
  -- Starting lineup (player IDs)
  starting_players JSONB NOT NULL, -- Array of player IDs
  captain_id VARCHAR(100) NOT NULL,
  vice_captain_id VARCHAR(100) NOT NULL,
  
  -- Bench
  bench_players JSONB NOT NULL, -- Array of player IDs
  
  -- Lock status
  is_locked BOOLEAN DEFAULT FALSE,
  locked_at TIMESTAMP,
  lock_deadline TIMESTAMP NOT NULL,
  
  -- Points (calculated after round)
  total_points DECIMAL(10,2) DEFAULT 0,
  captain_points DECIMAL(10,2) DEFAULT 0,
  vice_captain_points DECIMAL(10,2) DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(league_id, team_id, round_id)
);

CREATE INDEX idx_lineups_team ON fantasy_lineups(team_id);
CREATE INDEX idx_lineups_round ON fantasy_lineups(round_id);
CREATE INDEX idx_lineups_locked ON fantasy_lineups(is_locked);
```

#### 5. fantasy_trades (New)
```sql
CREATE TABLE fantasy_trades (
  id SERIAL PRIMARY KEY,
  trade_id VARCHAR(100) UNIQUE NOT NULL,
  league_id VARCHAR(100) NOT NULL,
  
  -- Teams involved
  team_a_id VARCHAR(100) NOT NULL,
  team_b_id VARCHAR(100) NOT NULL,
  
  -- Trade details
  trade_type VARCHAR(20) NOT NULL, -- 'sale', 'swap'
  
  -- Team A gives
  team_a_players JSONB NOT NULL, -- Array of player IDs
  team_a_cash DECIMAL(10,2) DEFAULT 0,
  
  -- Team B gives
  team_b_players JSONB NOT NULL, -- Array of player IDs
  team_b_cash DECIMAL(10,2) DEFAULT 0,
  
  -- Status
  status VARCHAR(20) DEFAULT 'proposed', -- proposed, accepted, rejected, cancelled
  proposed_by VARCHAR(100) NOT NULL, -- team_a_id or team_b_id
  proposed_at TIMESTAMP DEFAULT NOW(),
  responded_at TIMESTAMP,
  
  -- Expiry
  expires_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_trades_team_a ON fantasy_trades(team_a_id);
CREATE INDEX idx_trades_team_b ON fantasy_trades(team_b_id);
CREATE INDEX idx_trades_status ON fantasy_trades(status);
```

#### 6. fantasy_releases (New)
```sql
CREATE TABLE fantasy_releases (
  id SERIAL PRIMARY KEY,
  release_id VARCHAR(100) UNIQUE NOT NULL,
  league_id VARCHAR(100) NOT NULL,
  team_id VARCHAR(100) NOT NULL,
  window_id VARCHAR(100) NOT NULL,
  
  -- Player released
  player_id VARCHAR(100) NOT NULL,
  player_name VARCHAR(255) NOT NULL,
  
  -- Financial
  purchase_price DECIMAL(10,2) NOT NULL,
  refund_amount DECIMAL(10,2) NOT NULL, -- 80% of purchase price
  
  released_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_releases_team ON fantasy_releases(team_id);
CREATE INDEX idx_releases_window ON fantasy_releases(window_id);
```

---

## 🔧 COMPLETE API ENDPOINTS

### Draft APIs

#### 1. Generate Draft Tiers
```typescript
POST /api/fantasy/draft/generate-tiers

Request:
{
  league_id: "SSPSLFLS16",
  draft_type: "initial", // or "transfer"
  number_of_tiers: 7
}

Response:
{
  success: true,
  tiers: [
    {
      tier_id: "tier_1_SSPSLFLS16",
      tier_number: 1,
      tier_name: "Elite",
      players: [
        { id: "p001", name: "Ronaldo", points: 250 },
        { id: "p002", name: "Messi", points: 245 },
        ...
      ],
      player_count: 20,
      min_points: 230,
      max_points: 250,
      avg_points: 240
    },
    ...
  ]
}
```

#### 2. Submit Tier Bids
```typescript
POST /api/fantasy/draft/submit-tier-bids

Request:
{
  team_id: "SSPSLT0001",
  league_id: "SSPSLFLS16",
  bids: [
    { tier_id: "tier_1", player_id: "p001", bid_amount: 25.00 },
    { tier_id: "tier_2", is_skip: true }, // Skip this tier
    { tier_id: "tier_3", player_id: "p045", bid_amount: 15.00 },
    ...
  ]
}

Response:
{
  success: true,
  message: "7 tier bids submitted",
  total_bid_amount: 58.00,
  tiers_skipped: 2,
  deadline: "2024-12-20T12:00:00Z"
}
```

#### 3. Process Draft Tiers
```typescript
POST /api/fantasy/draft/process-tiers

Request:
{
  league_id: "SSPSLFLS16"
}

Response:
{
  success: true,
  results_by_tier: [
    {
      tier_number: 1,
      total_bids: 15,
      winners: 15,
      skipped: 5
    },
    ...
  ],
  total_players_drafted: 120,
  average_squad_size: 6
}
```

### Lineup APIs

#### 4. Submit Weekly Lineup
```typescript
POST /api/fantasy/lineups/submit

Request:
{
  team_id: "SSPSLT0001",
  league_id: "SSPSLFLS16",
  round_id: "SSPSLFR00001",
  starting_players: ["p001", "p045", "p078", "p102", "p156"],
  captain_id: "p001",
  vice_captain_id: "p045",
  bench_players: ["p189", "p234"]
}

Response:
{
  success: true,
  lineup_id: "lineup_001",
  lock_deadline: "2024-12-20T18:00:00Z",
  hours_until_lock: 24
}
```

#### 5. Auto-Lock Lineups
```typescript
POST /api/fantasy/lineups/auto-lock

Request:
{
  league_id: "SSPSLFLS16",
  round_id: "SSPSLFR00001"
}

Response:
{
  success: true,
  lineups_locked: 18,
  lineups_missing: 2,
  teams_without_lineup: ["SSPSLT0015", "SSPSLT0019"]
}
```

#### 6. Calculate Lineup Points
```typescript
POST /api/fantasy/lineups/calculate-points

Request:
{
  league_id: "SSPSLFLS16",
  round_id: "SSPSLFR00001"
}

Response:
{
  success: true,
  lineups_processed: 20,
  total_points_awarded: 1450,
  highest_scoring_team: {
    team_id: "SSPSLT0001",
    points: 95.5
  }
}
```

### Transfer APIs

#### 7. Release Players
```typescript
POST /api/fantasy/transfers/release

Request:
{
  team_id: "SSPSLT0001",
  window_id: "tw_001",
  player_ids: ["p189", "p234"]
}

Response:
{
  success: true,
  players_released: 2,
  refund_amount: 6.4,
  new_budget: 48.4,
  new_squad_size: 5
}
```

#### 8. Propose Trade
```typescript
POST /api/fantasy/trades/propose

Request:
{
  league_id: "SSPSLFLS16",
  team_a_id: "SSPSLT0001", // Proposer
  team_b_id: "SSPSLT0005", // Receiver
  trade_type: "swap",
  team_a_players: ["p001"], // Ronaldo
  team_a_cash: 5.00,
  team_b_players: ["p045", "p078"], // Neymar + Kane
  team_b_cash: 0,
  expires_in_hours: 48
}

Response:
{
  success: true,
  trade_id: "trade_001",
  message: "Trade proposed to Team B",
  expires_at: "2024-12-22T12:00:00Z"
}
```

#### 9. Respond to Trade
```typescript
POST /api/fantasy/trades/respond

Request:
{
  trade_id: "trade_001",
  team_id: "SSPSLT0005",
  action: "accept" // or "reject"
}

Response:
{
  success: true,
  message: "Trade accepted",
  players_swapped: 3,
  team_a_new_squad: [...],
  team_b_new_squad: [...]
}
```

---

## 💻 FRONTEND PAGES

### 1. Draft Tier Bidding Page
```
/app/dashboard/team/fantasy/draft/tiers/page.tsx

Layout:
┌─────────────────────────────────────────────────┐
│ Draft: Tier Bidding                             │
│ Deadline: 2 days 5 hours remaining              │
├─────────────────────────────────────────────────┤
│ Budget: €100M | Bids: €58M | Remaining: €42M   │
├─────────────────────────────────────────────────┤
│ TIER 1: ELITE (Top 20 Players)                  │
│ ┌─────────────────────────────────────────────┐ │
│ │ [Ronaldo] 250pts  [Messi] 245pts            │ │
│ │ [Neymar] 240pts   [Salah] 235pts            │ │
│ │ ...                                          │ │
│ └─────────────────────────────────────────────┘ │
│ Your Bid: [Ronaldo ▼] Amount: [€25M]           │
│ [Submit Bid] [Skip Tier]                        │
├─────────────────────────────────────────────────┤
│ TIER 2: STARS (Next 20 Players)                 │
│ [SKIPPED] ✓                                     │
├─────────────────────────────────────────────────┤
│ TIER 3: QUALITY (Next 20 Players)               │
│ Your Bid: [Neymar ▼] Amount: [€15M]            │
│ [Submit Bid] [Skip Tier]                        │
└─────────────────────────────────────────────────┘
```

### 2. Weekly Lineup Selection Page
```
/app/dashboard/team/fantasy/lineup/[roundId]/page.tsx

Layout:
┌─────────────────────────────────────────────────┐
│ Round 5 Lineup Selection                        │
│ Lock Deadline: Friday 6:00 PM (12 hours left)  │
├─────────────────────────────────────────────────┤
│ YOUR SQUAD (7 players)                          │
│ ┌─────────────────────────────────────────────┐ │
│ │ ☑ Ronaldo (250pts avg) [Captain]           │ │
│ │ ☑ Neymar (180pts avg) [Vice-Captain]       │ │
│ │ ☑ Kane (150pts avg)                         │ │
│ │ ☑ Player X (100pts avg)                     │ │
│ │ ☑ Player Y (80pts avg)                      │ │
│ │ ☐ Player Z (70pts avg) [BENCH]             │ │
│ │ ☐ Player W (60pts avg) [BENCH]             │ │
│ └─────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────┤
│ STARTING 5: ✓ Selected                          │
│ CAPTAIN: Ronaldo (2x points)                    │
│ VICE-CAPTAIN: Neymar (1.5x points)              │
│ BENCH: 2 players (0 points)                     │
├─────────────────────────────────────────────────┤
│ [Save Lineup] [Lock Lineup Now]                 │
└─────────────────────────────────────────────────┘
```

### 3. Trade Proposal Page
```
/app/dashboard/team/fantasy/trades/propose/page.tsx

Layout:
┌─────────────────────────────────────────────────┐
│ Propose Trade                                    │
├─────────────────────────────────────────────────┤
│ Trade With: [Team B ▼]                          │
├─────────────────────────────────────────────────┤
│ YOU GIVE:                                        │
│ Players: [Ronaldo ▼] [+ Add Player]            │
│ Cash: [€5M]                                     │
├─────────────────────────────────────────────────┤
│ YOU RECEIVE:                                     │
│ Players: [Neymar ▼] [Kane ▼] [+ Add Player]    │
│ Cash: [€0]                                      │
├─────────────────────────────────────────────────┤
│ TRADE SUMMARY:                                   │
│ You give: Ronaldo + €5M                         │
│ You get: Neymar + Kane                          │
│ Net value: Fair (±€2M)                          │
├─────────────────────────────────────────────────┤
│ Expires in: [48 hours ▼]                        │
│ [Propose Trade]                                  │
└─────────────────────────────────────────────────┘
```

---

## 🎮 ENGAGEMENT ENHANCEMENTS

### 1. Weekly Predictions & Bonuses

#### Match Result Predictions
```
Before Each Round:
- Predict winner of each match
- Predict total goals in match
- Predict MOTM (Man of the Match)

Rewards:
- Correct winner: +5 bonus points
- Correct score: +10 bonus points
- Correct MOTM: +15 bonus points
- Perfect round (all correct): +50 bonus points
```

**Database Schema:**
```sql
CREATE TABLE fantasy_predictions (
  id SERIAL PRIMARY KEY,
  prediction_id VARCHAR(100) UNIQUE NOT NULL,
  team_id VARCHAR(100) NOT NULL,
  round_id VARCHAR(100) NOT NULL,
  fixture_id VARCHAR(100) NOT NULL,
  
  -- Predictions
  predicted_winner VARCHAR(100), -- 'home', 'away', 'draw'
  predicted_home_score INTEGER,
  predicted_away_score INTEGER,
  predicted_motm_player_id VARCHAR(100),
  
  -- Results
  is_winner_correct BOOLEAN DEFAULT FALSE,
  is_score_correct BOOLEAN DEFAULT FALSE,
  is_motm_correct BOOLEAN DEFAULT FALSE,
  bonus_points_earned INTEGER DEFAULT 0,
  
  submitted_at TIMESTAMP DEFAULT NOW(),
  calculated_at TIMESTAMP
);
```

---

### 2. Player Form & Momentum System

#### Hot/Cold Streaks
```
Player Form Indicators:
🔥 ON FIRE: 3+ good games in a row (+15% points)
📈 HOT: 2 good games in a row (+10% points)
➡️ STEADY: Normal performance (no change)
📉 COLD: 2 bad games in a row (-10% points)
❄️ FROZEN: 3+ bad games in a row (-15% points)

Good Game: 15+ points
Bad Game: <5 points
```

**Database Schema:**
```sql
ALTER TABLE fantasy_players
ADD COLUMN form_status VARCHAR(20) DEFAULT 'steady', -- fire, hot, steady, cold, frozen
ADD COLUMN form_streak INTEGER DEFAULT 0, -- Positive = good, Negative = bad
ADD COLUMN last_5_games_avg DECIMAL(10,2) DEFAULT 0,
ADD COLUMN form_multiplier DECIMAL(3,2) DEFAULT 1.00; -- 0.85 to 1.15
```

**Points Calculation:**
```typescript
// Apply form multiplier to player points
const basePoints = calculateBasePoints(performance);
const formMultiplier = player.form_multiplier; // 0.85 - 1.15
const finalPoints = Math.round(basePoints * formMultiplier);
```

---

### 3. Weekly Challenges & Achievements

#### Challenge System
```
Weekly Challenges (Rotate Each Week):

Week 1: "Captain Masterclass"
- Captain scores 25+ points
- Reward: +20 bonus points

Week 2: "Underdog Hero"
- Start a player from bottom 3 teams who scores 15+
- Reward: +25 bonus points

Week 3: "Perfect Lineup"
- All 5 starters score 10+ points
- Reward: +30 bonus points

Week 4: "Differential Pick"
- Own player owned by <20% of teams who scores 20+
- Reward: +35 bonus points

Week 5: "Budget Genius"
- Win with squad value under €40M
- Reward: +40 bonus points
```

**Database Schema:**
```sql
CREATE TABLE fantasy_challenges (
  id SERIAL PRIMARY KEY,
  challenge_id VARCHAR(100) UNIQUE NOT NULL,
  league_id VARCHAR(100) NOT NULL,
  round_id VARCHAR(100) NOT NULL,
  
  challenge_type VARCHAR(50) NOT NULL,
  challenge_name VARCHAR(255) NOT NULL,
  challenge_description TEXT NOT NULL,
  reward_points INTEGER NOT NULL,
  
  -- Conditions
  conditions JSONB NOT NULL,
  
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE fantasy_challenge_completions (
  id SERIAL PRIMARY KEY,
  team_id VARCHAR(100) NOT NULL,
  challenge_id VARCHAR(100) NOT NULL,
  round_id VARCHAR(100) NOT NULL,
  
  completed_at TIMESTAMP DEFAULT NOW(),
  bonus_points_awarded INTEGER NOT NULL,
  
  UNIQUE(team_id, challenge_id)
);
```

---

### 4. Power-Up Chips (Limited Use)

#### Strategic Boosts
```
Each Team Gets Per Season:

1. TRIPLE CAPTAIN (1x use)
   - Captain gets 3x points instead of 2x
   - Use on easy fixture week

2. BENCH BOOST (2x use)
   - All bench players earn points this week
   - Normally bench = 0 points

3. FREE HIT (1x use)
   - Make unlimited lineup changes for one week
   - Team reverts to original next week
   - Good for injury crisis

4. WILDCARD (2x use)
   - Unlimited transfers in one window
   - No points deduction
   - Use after bad draft or injuries
```

**Database Schema:**
```sql
CREATE TABLE fantasy_power_ups (
  id SERIAL PRIMARY KEY,
  team_id VARCHAR(100) NOT NULL,
  league_id VARCHAR(100) NOT NULL,
  
  -- Available chips
  triple_captain_available INTEGER DEFAULT 1,
  bench_boost_available INTEGER DEFAULT 2,
  free_hit_available INTEGER DEFAULT 1,
  wildcard_available INTEGER DEFAULT 2,
  
  -- Usage history
  triple_captain_used_rounds JSONB DEFAULT '[]',
  bench_boost_used_rounds JSONB DEFAULT '[]',
  free_hit_used_rounds JSONB DEFAULT '[]',
  wildcard_used_rounds JSONB DEFAULT '[]',
  
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE fantasy_power_up_usage (
  id SERIAL PRIMARY KEY,
  team_id VARCHAR(100) NOT NULL,
  round_id VARCHAR(100) NOT NULL,
  power_up_type VARCHAR(50) NOT NULL,
  
  bonus_points_earned INTEGER DEFAULT 0,
  used_at TIMESTAMP DEFAULT NOW()
);
```

---

### 5. Head-to-Head Mini-Leagues

#### Weekly Matchups
```
Parallel Competition:

Main League: Total points accumulation
H2H League: Weekly matchups

How It Works:
1. Each week, teams paired randomly
2. Compare points for that week only
3. Winner gets 3 points, Draw = 1 point each
4. Separate H2H table

Example Week 5:
Team A: 75 points → WIN (3 H2H points)
Team B: 68 points → LOSS (0 H2H points)

Season End:
- Main League Champion (total points)
- H2H League Champion (most H2H points)
- Double winner possible!
```

**Database Schema:**
```sql
CREATE TABLE fantasy_h2h_fixtures (
  id SERIAL PRIMARY KEY,
  fixture_id VARCHAR(100) UNIQUE NOT NULL,
  league_id VARCHAR(100) NOT NULL,
  round_id VARCHAR(100) NOT NULL,
  
  team_a_id VARCHAR(100) NOT NULL,
  team_b_id VARCHAR(100) NOT NULL,
  
  -- Results
  team_a_points INTEGER DEFAULT 0,
  team_b_points INTEGER DEFAULT 0,
  winner VARCHAR(100), -- team_a_id, team_b_id, or 'draw'
  
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE TABLE fantasy_h2h_standings (
  id SERIAL PRIMARY KEY,
  league_id VARCHAR(100) NOT NULL,
  team_id VARCHAR(100) NOT NULL,
  
  matches_played INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  draws INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  h2h_points INTEGER DEFAULT 0, -- 3 for win, 1 for draw
  
  points_for INTEGER DEFAULT 0,
  points_against INTEGER DEFAULT 0,
  
  rank INTEGER,
  
  UNIQUE(league_id, team_id)
);
```

---

### 6. Player Spotlight & Stats

#### Enhanced Player Information
```
Player Card Shows:

Basic Stats:
- Total points this season
- Average points per game
- Games played
- Current form (🔥/📈/➡️/📉/❄️)

Advanced Stats:
- Goals scored
- Clean sheets
- MOTM awards
- Win rate (team wins when they play)
- Ownership % (how many teams own them)

Recent Form:
- Last 5 games: [20, 15, 18, 22, 12]
- Trend: 📈 Improving

Upcoming Fixtures:
- Next 3 opponents with difficulty rating
- Easy (Green), Medium (Yellow), Hard (Red)

Fantasy Impact:
- Times captained: 45
- Captain success rate: 67%
- Differential score: 15% owned (good differential)
```

**Database Schema:**
```sql
ALTER TABLE fantasy_players
ADD COLUMN games_played INTEGER DEFAULT 0,
ADD COLUMN goals_scored INTEGER DEFAULT 0,
ADD COLUMN clean_sheets INTEGER DEFAULT 0,
ADD COLUMN motm_count INTEGER DEFAULT 0,
ADD COLUMN win_rate DECIMAL(5,2) DEFAULT 0,
ADD COLUMN ownership_percentage DECIMAL(5,2) DEFAULT 0,
ADD COLUMN times_captained INTEGER DEFAULT 0,
ADD COLUMN captain_success_rate DECIMAL(5,2) DEFAULT 0,
ADD COLUMN last_5_scores JSONB DEFAULT '[]',
ADD COLUMN upcoming_fixtures JSONB DEFAULT '[]';
```

---

### 7. League Chat & Banter

#### Social Features
```
League Chat Room:
- Real-time messaging
- Emoji reactions
- GIF support
- Trash talk before matches
- Congratulations after wins

Pre-Match Banter:
"My captain will destroy yours this week! 💪"

Post-Match Reactions:
"😭 My captain scored 2 points..."
"🔥 Triple captain paid off! 60 points!"

Trade Negotiations:
"Want to swap players? DM me"
```

**Database Schema:**
```sql
CREATE TABLE fantasy_chat_messages (
  id SERIAL PRIMARY KEY,
  message_id VARCHAR(100) UNIQUE NOT NULL,
  league_id VARCHAR(100) NOT NULL,
  team_id VARCHAR(100) NOT NULL,
  sender_name VARCHAR(255) NOT NULL,
  
  message_text TEXT NOT NULL,
  message_type VARCHAR(20) DEFAULT 'text', -- text, gif, emoji, system
  
  -- Reactions
  reactions JSONB DEFAULT '{}', -- {emoji: [team_ids]}
  
  -- Reply
  reply_to_message_id VARCHAR(100),
  
  created_at TIMESTAMP DEFAULT NOW(),
  edited_at TIMESTAMP,
  deleted_at TIMESTAMP
);
```

---

### 8. Auto-Sub Feature

#### Automatic Substitutions
```
If Starting Player Doesn't Play:

Option 1: Auto-Sub Enabled
- If starter scores 0 points (didn't play)
- Automatically substitute with first bench player
- Bench player's points count

Option 2: Auto-Sub Disabled
- Starter scores 0 points
- No substitution
- You lose those points

Example:
Starting 5: [Ronaldo, Messi, Neymar, Kane, Salah]
Bench: [Player X, Player Y]

Ronaldo doesn't play (0 pts)
→ Auto-sub: Player X comes in (scored 12 pts)
→ You get 12 pts instead of 0 pts

Settings:
- Enable/disable auto-sub
- Set bench priority order
```

**Database Schema:**
```sql
ALTER TABLE fantasy_lineups
ADD COLUMN auto_sub_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN bench_priority_order JSONB DEFAULT '[]', -- [player_id_1, player_id_2]
ADD COLUMN substitutions_made JSONB DEFAULT '[]'; -- [{out: player_id, in: player_id, reason: 'dnp'}]
```

---

### 9. Fixture Difficulty Rating

#### Smart Scheduling
```
Fixture Difficulty (1-5):

1 ⭐ - Very Easy (vs bottom team)
2 ⭐⭐ - Easy (vs lower-mid team)
3 ⭐⭐⭐ - Medium (vs mid-table team)
4 ⭐⭐⭐⭐ - Hard (vs upper-mid team)
5 ⭐⭐⭐⭐⭐ - Very Hard (vs top team)

Player Card Shows Next 3 Fixtures:
Week 5: vs Team A (⭐⭐ Easy)
Week 6: vs Team B (⭐⭐⭐⭐ Hard)
Week 7: vs Team C (⭐ Very Easy)

Strategy:
- Captain players with easy fixtures
- Avoid players with hard fixtures
- Plan transfers around fixture swings
```

**Database Schema:**
```sql
CREATE TABLE fixture_difficulty_ratings (
  id SERIAL PRIMARY KEY,
  fixture_id VARCHAR(100) NOT NULL,
  team_id VARCHAR(100) NOT NULL, -- Which team's perspective
  opponent_id VARCHAR(100) NOT NULL,
  
  difficulty_rating INTEGER NOT NULL, -- 1-5
  difficulty_label VARCHAR(20) NOT NULL, -- 'Very Easy', 'Easy', etc.
  
  -- Factors
  opponent_rank INTEGER,
  opponent_form VARCHAR(20),
  home_away VARCHAR(10), -- 'home' or 'away'
  
  calculated_at TIMESTAMP DEFAULT NOW()
);
```

---

### 10. Season-Long Achievements

#### Unlock Badges
```
Achievement System:

🏆 CHAMPION - Win the league
⚽ TOP SCORER - Highest total points
🧠 MASTERMIND - Most successful transfers
👑 CAPTAIN KING - Captain scores 20+ most often
💰 BARGAIN HUNTER - Best value squad
📊 CONSISTENT - Never finish below 5th
⚔️ GIANT KILLER - Beat #1 team
🔥 HOT STREAK - Win 5 weeks in a row
💪 IRON MAN - Never miss lineup deadline
🎯 PERFECT WEEK - Score 100+ points in one week

Rewards:
- Badge displayed on profile
- Bonus fantasy coins
- Bragging rights
- Hall of Fame entry
```

**Database Schema:**
```sql
CREATE TABLE fantasy_achievements (
  id SERIAL PRIMARY KEY,
  achievement_id VARCHAR(100) UNIQUE NOT NULL,
  achievement_name VARCHAR(255) NOT NULL,
  achievement_description TEXT NOT NULL,
  achievement_icon VARCHAR(50) NOT NULL, -- emoji or icon name
  
  -- Unlock conditions
  unlock_conditions JSONB NOT NULL,
  
  -- Rewards
  reward_coins INTEGER DEFAULT 0,
  reward_badge VARCHAR(255),
  
  is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE fantasy_team_achievements (
  id SERIAL PRIMARY KEY,
  team_id VARCHAR(100) NOT NULL,
  achievement_id VARCHAR(100) NOT NULL,
  
  unlocked_at TIMESTAMP DEFAULT NOW(),
  season_id VARCHAR(100) NOT NULL,
  
  UNIQUE(team_id, achievement_id, season_id)
);
```

---

## 🔄 COMPLETE WORKFLOW

### Season Flow

```
1. SEASON START
   ↓
2. ADMIN: Generate Draft Tiers (7 tiers)
   ↓
3. TEAMS: Submit Tier Bids (7 days)
   ↓
4. ADMIN: Process Draft
   ↓
5. TEAMS: Have 5-7 players each
   ↓
6. ROUND 1 STARTS
   ↓
7. TEAMS: Submit Weekly Lineup (by Friday 6 PM)
   ↓
8. SYSTEM: Auto-lock lineups at deadline
   ↓
9. ROUND 1 PLAYS (Weekend)
   ↓
10. SYSTEM: Calculate lineup points (Monday)
    ↓
11. TEAMS: View results, update leaderboard
    ↓
12. REPEAT steps 6-11 for Rounds 2-7
    ↓
13. TRANSFER WINDOW 1 (After Round 7)
    ↓
14. TEAMS: Release players (48 hours)
    ↓
15. ADMIN: Generate new tiers from available players
    ↓
16. TEAMS: Bid on tiers (48 hours)
    ↓
17. ADMIN: Process transfer draft
    ↓
18. TEAMS: Can propose trades/sales
    ↓
19. REPEAT steps 6-18 for rest of season
    ↓
20. SEASON END: Champion crowned!
```

---

## 📊 COMPARISON: OLD vs NEW

| Feature | OLD System | NEW System |
|---------|-----------|------------|
| **Squad Size** | 11-15 players | 5-7 players (configurable) |
| **Ownership** | Multiple teams | Exclusive (one team only) |
| **Draft** | None | Tiered draft with skip/bid |
| **Lineup** | All players earn points | Only starting 5 earn points |
| **Captain** | Set once | Set weekly |
| **Bench** | No bench | 2 bench players (0 points) |
| **Transfers** | First-come-first-serve | Release → Draft → Trade |
| **Trading** | No team-to-team | Yes (sale & swap) |
| **Strategy** | Low | Very High |
| **Weekly Engagement** | Low | High (lineup selection) |

---

## 🚀 IMPLEMENTATION TIMELINE

### Week 1-2: Core Draft System
- Database schema (tiers, bids, lineups)
- Tier generation algorithm
- Tier bidding API
- Draft processing logic

### Week 3-4: Lineup System
- Weekly lineup submission
- Auto-lock mechanism
- Points calculation (starting 5 only)
- Lineup history

### Week 5-6: Transfer System
- Release phase
- Transfer draft
- Trade proposals
- Trade acceptance/rejection

### Week 7-8: Frontend
- Draft tier bidding UI
- Weekly lineup selection UI
- Trade proposal UI
- Results and history pages

### Week 9-10: Testing & Polish
- Unit tests
- Integration tests
- Beta testing
- Bug fixes
- Performance optimization

**Total: 10 weeks**

---

## 📱 NEW API ENDPOINTS (Enhancements)

### Predictions
```typescript
POST /api/fantasy/predictions/submit
GET /api/fantasy/predictions/results?team_id=xxx&round_id=xxx
POST /api/fantasy/predictions/calculate-bonus
```

### Challenges
```typescript
GET /api/fantasy/challenges/active?league_id=xxx
POST /api/fantasy/challenges/check-completion
GET /api/fantasy/challenges/leaderboard?league_id=xxx
```

### Power-Ups
```typescript
GET /api/fantasy/power-ups/available?team_id=xxx
POST /api/fantasy/power-ups/activate
GET /api/fantasy/power-ups/history?team_id=xxx
```

### Head-to-Head
```typescript
GET /api/fantasy/h2h/fixtures?league_id=xxx&round_id=xxx
GET /api/fantasy/h2h/standings?league_id=xxx
POST /api/fantasy/h2h/generate-fixtures
```

### Chat
```typescript
POST /api/fantasy/chat/send
GET /api/fantasy/chat/messages?league_id=xxx&limit=50
POST /api/fantasy/chat/react
DELETE /api/fantasy/chat/delete?message_id=xxx
```

### Stats & Analytics
```typescript
GET /api/fantasy/players/form?player_id=xxx
GET /api/fantasy/players/fixtures?player_id=xxx
GET /api/fantasy/players/ownership?league_id=xxx
GET /api/fantasy/teams/achievements?team_id=xxx
```

---

## 💻 NEW FRONTEND PAGES

### 1. Predictions Page
```
/app/dashboard/team/fantasy/predictions/[roundId]/page.tsx

Features:
- Predict match winners
- Predict scores
- Predict MOTM
- See prediction history
- View bonus points earned
```

### 2. Challenges Page
```
/app/dashboard/team/fantasy/challenges/page.tsx

Features:
- View active challenges
- Track progress
- See completed challenges
- Challenge leaderboard
```

### 3. Power-Ups Page
```
/app/dashboard/team/fantasy/power-ups/page.tsx

Features:
- View available chips
- Activate power-ups
- See usage history
- Power-up strategy guide
```

### 4. Head-to-Head Page
```
/app/dashboard/team/fantasy/h2h/page.tsx

Features:
- View weekly matchup
- H2H standings table
- H2H history
- Compare with opponent
```

### 5. League Chat Page
```
/app/dashboard/team/fantasy/chat/page.tsx

Features:
- Real-time messaging
- Emoji reactions
- GIF support
- Message history
```

### 6. Player Analysis Page
```
/app/dashboard/team/fantasy/players/[playerId]/page.tsx

Features:
- Detailed player stats
- Form graph (last 10 games)
- Fixture difficulty
- Ownership stats
- Captain stats
```

---

## 🎯 SUCCESS CRITERIA

### Core Features
✅ Tiered draft works smoothly (all teams get 5-7 players)
✅ Weekly lineup selection is intuitive
✅ Auto-lock prevents late submissions
✅ Only starting 5 earn points (bench = 0)
✅ Trades work between teams
✅ Transfer windows process correctly
✅ No duplicate ownership

### Engagement Features
✅ Predictions system working (80%+ participation)
✅ Weekly challenges completed (60%+ participation)
✅ Power-ups used strategically (50%+ usage rate)
✅ H2H fixtures generate excitement
✅ League chat active (10+ messages per day)
✅ Player form visible and accurate
✅ Auto-sub prevents 0-point disasters

### User Satisfaction
✅ 95%+ user satisfaction
✅ High weekly engagement (lineup changes)
✅ Daily active users +200%
✅ Average session time +150%
✅ User retention 90%+ through season

---

## 📊 ENGAGEMENT METRICS TO TRACK

### Daily Metrics
- Active users
- Lineups submitted
- Chat messages sent
- Predictions made
- Player views

### Weekly Metrics
- Lineup submission rate
- Power-up usage
- Challenge completion rate
- Trade proposals
- H2H match engagement

### Season Metrics
- User retention
- Average points per team
- Transfer activity
- Achievement unlocks
- Overall satisfaction

---

## 🚀 QUICK WINS (Implement First)

These features have **high impact** and are **easy to implement**:

1. **Player Form Indicators** (🔥📈➡️📉❄️) - Visual, instant value
2. **Weekly Challenges** - Copy-paste challenge templates
3. **Auto-Sub Feature** - Prevents frustration, easy logic
4. **Fixture Difficulty** - Simple calculation, huge strategic value
5. **League Chat** - Use existing chat libraries
6. **Predictions** - Simple form, bonus points
7. **Achievement Badges** - Gamification, low effort
8. **H2H Fixtures** - Parallel competition, exciting

---

## 🎮 IMPLEMENTATION PRIORITY (REVISED)

### Phase 1: Core System (Weeks 1-2)
- Tiered draft
- Weekly lineups
- Points calculation

### Phase 2: Engagement Layer (Weeks 3-4)
- Player form indicators
- Auto-sub feature
- Fixture difficulty
- Weekly challenges

### Phase 3: Social Features (Weeks 5-6)
- League chat
- Predictions
- H2H fixtures

### Phase 4: Advanced Features (Weeks 7-8)
- Power-ups
- Achievements
- Player analysis

### Phase 5: Polish & Test (Weeks 9-10)
- Bug fixes
- Performance optimization
- User testing
- Launch preparation

---

This is the COMPLETE enhanced system with **10 major engagement features** added to your base system! 

The enhancements focus on:
✅ **Weekly engagement** (predictions, challenges, H2H)
✅ **Strategic depth** (form, fixtures, power-ups)
✅ **Social interaction** (chat, banter, achievements)
✅ **User retention** (auto-sub, achievements, badges)

Ready to start building? 🚀⚡
