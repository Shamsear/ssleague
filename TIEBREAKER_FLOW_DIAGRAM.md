# Tiebreaker Flow - Last Person Standing

## 🎯 Visual Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│           BULK ROUND ENDS                               │
│  Admin clicks "Finalize Bulk Round"                    │
└─────────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│           ANALYZE BIDS                                  │
│  Query: SELECT player_id, COUNT(DISTINCT team_id)      │
│         GROUP BY player_id                              │
└─────────────────────────────────────────────────────────┘
                      │
          ┌───────────┴───────────┐
          │                       │
          ▼                       ▼
┌──────────────────┐    ┌──────────────────┐
│  SINGLE BIDDER   │    │ MULTIPLE BIDDERS │
│  (No Conflict)   │    │   (Conflict!)    │
└──────────────────┘    └──────────────────┘
          │                       │
          ▼                       ▼
┌──────────────────┐    ┌──────────────────┐
│ Assign Player    │    │ Create Tiebreaker│
│ Deduct £10       │    │ DON'T deduct yet │
│ Status: SOLD     │    │ Status: PENDING  │
└──────────────────┘    └──────────────────┘
                                  │
                                  ▼
                        ┌──────────────────┐
                        │  Admin Dashboard │
                        │  Shows Pending   │
                        │  Tiebreakers     │
                        └──────────────────┘
                                  │
                        Admin clicks "Start Tiebreaker #1"
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────┐
│              TIEBREAKER STARTS                          │
│  - Teams notified via WebSocket                         │
│  - All teams start at £10                               │
│  - No timer (runs until 1 team left)                    │
│  - Safety: 3hr inactivity, 24hr max                     │
└─────────────────────────────────────────────────────────┘
                                  │
                                  ▼
                        ╔══════════════════╗
                        ║  AUCTION ACTIVE  ║
                        ║  (Live Bidding)  ║
                        ╚══════════════════╝
                                  │
            ┌─────────────────────┼─────────────────────┐
            │                     │                     │
            ▼                     ▼                     ▼
    ┌────────────┐        ┌────────────┐       ┌────────────┐
    │  Team A    │        │  Team B    │       │  Team C    │
    │  Actions:  │        │  Actions:  │       │  Actions:  │
    │            │        │            │       │            │
    │ 1. Raise   │        │ 1. Raise   │       │ 1. Raise   │
    │ 2. Withdraw│        │ 2. Withdraw│       │ 2. Withdraw│
    └────────────┘        └────────────┘       └────────────┘
            │                     │                     │
            └─────────────────────┴─────────────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
           ╔════════▼════════╗         ╔════════▼════════╗
           ║ TEAM RAISES BID ║         ║ TEAM WITHDRAWS  ║
           ╚═════════════════╝         ╚═════════════════╝
                    │                           │
                    ▼                           ▼
        ┌────────────────────┐      ┌────────────────────┐
        │ Check conditions:  │      │ Check conditions:  │
        │ 1. Bid > current   │      │ 1. NOT highest?    │
        │ 2. Team has balance│      │ 2. Still active?   │
        │ 3. Team is active  │      │ → Remove immediate │
        └────────────────────┘      └────────────────────┘
                    │                           │
                    ▼                           ▼
        ┌────────────────────┐      ┌────────────────────┐
        │ Update:            │      │ Update:            │
        │ - Highest bid      │      │ - Status:WITHDRAWN │
        │ - Highest team     │      │ - Teams remaining  │
        │ - Last activity    │      │ - Last activity    │
        │ - Broadcast WS     │      │ - Broadcast WS     │
        └────────────────────┘      └────────────────────┘
                    │                           │
                    └─────────────┬─────────────┘
                                  ▼
                        ┌──────────────────┐
                        │ Check Win Cond:  │
                        │ Teams left = 1?  │
                        └──────────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
                    ▼                           ▼
            ┌───────────────┐          ┌───────────────┐
            │  YES (1 left) │          │  NO (2+ left) │
            └───────────────┘          └───────────────┘
                    │                           │
                    ▼                           │
        ┌────────────────────┐                 │
        │  AUTO-FINALIZE     │                 │
        │  Winner = Last Team│                 │
        │  Amount = Their Bid│                 │
        └────────────────────┘                 │
                    │                           │
                    │   ◄───────────────────────┘
                    │       (Continue auction)
                    ▼
        ┌────────────────────┐
        │  Assign Player     │
        │  Deduct bid amount │
        │  Update squad count│
        │  Status: SOLD      │
        └────────────────────┘
                    │
                    ▼
        ┌────────────────────┐
        │ Notify all teams:  │
        │ - Winner: You won! │
        │ - Losers: You lost │
        │ - Admin: Resolved  │
        └────────────────────┘
                    │
                    ▼
        ┌────────────────────┐
        │  Admin starts      │
        │  Next Tiebreaker   │
        │  (if any remaining)│
        └────────────────────┘
```

---

## 🔄 State Machine

```
TIEBREAKER STATES:
┌──────────┐
│ PENDING  │ → Admin hasn't started yet
└──────────┘
     │
     │ (Admin clicks "Start")
     ▼
┌──────────┐
│  ACTIVE  │ → Auction running, teams bidding/withdrawing
└──────────┘
     │
     │ (Only 1 team left OR Admin force-finalize)
     ▼
┌──────────┐
│ RESOLVED │ → Winner assigned, payment processed
└──────────┘

TEAM STATES (within active tiebreaker):
┌────────┐
│ ACTIVE │ → Can bid or withdraw (if not highest)
└────────┘
     │
     │ (Team withdraws)
     ▼
┌──────────┐
│WITHDRAWN │ → Permanently out
└──────────┘

HIGHEST BIDDER FLAG:
┌──────────────┐
│ is_highest?  │
│  NO  → Can withdraw, can bid
│  YES → CANNOT withdraw, others can outbid
└──────────────┘
```

---

## 🎮 Team UI States

### State 1: Not Highest Bidder
```
┌───────────────────────────────────────┐
│  Tiebreaker: Player Name              │
├───────────────────────────────────────┤
│  Current Highest: £35 (Team B)        │
│  Your Bid: £20                        │
│                                       │
│  You are: 🟡 ACTIVE (Not Leading)     │
│                                       │
│  Your Balance: £500                   │
│                                       │
│  Actions:                             │
│  ┌─────────────┐  ┌─────────────┐   │
│  │ Raise Bid   │  │  Withdraw   │   │
│  └─────────────┘  └─────────────┘   │
│                                       │
│  Teams Remaining: 3/5                 │
│  - Team B: £35 (Highest)              │
│  - You: £20                           │
│  - Team D: £15                        │
└───────────────────────────────────────┘
```

### State 2: Highest Bidder
```
┌───────────────────────────────────────┐
│  Tiebreaker: Player Name              │
├───────────────────────────────────────┤
│  Current Highest: £35 (YOU!)          │
│  Your Bid: £35                        │
│                                       │
│  You are: 🟢 LEADING                  │
│                                       │
│  Your Balance: £500                   │
│                                       │
│  Status:                              │
│  ⚠️ You cannot withdraw while leading │
│  Waiting for other teams...          │
│                                       │
│  Teams Remaining: 3/5                 │
│  - YOU: £35 (Highest) 👑              │
│  - Team A: £20                        │
│  - Team D: £15                        │
└───────────────────────────────────────┘
```

### State 3: Withdrawn
```
┌───────────────────────────────────────┐
│  Tiebreaker: Player Name              │
├───────────────────────────────────────┤
│  Current Highest: £45 (Team D)        │
│                                       │
│  You have: ❌ WITHDRAWN                │
│                                       │
│  You withdrew at: £20                 │
│  Current highest: £45                 │
│                                       │
│  Result: You will not get this player │
│  No payment will be deducted          │
│                                       │
│  Teams Remaining: 2/5                 │
│  - Team D: £45 (Highest)              │
│  - Team B: £30                        │
└───────────────────────────────────────┘
```

---

## ⏱️ Inactivity & Safety Mechanisms

```
┌─────────────────────────────────────────────┐
│  TIMELINE                                   │
├─────────────────────────────────────────────┤
│                                             │
│  0:00 → Tiebreaker starts                  │
│         last_activity_time = NOW            │
│                                             │
│  0:15 → Team A bids £20                    │
│         last_activity_time = NOW            │
│                                             │
│  1:30 → Team B withdraws                   │
│         last_activity_time = NOW            │
│                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│                                             │
│  4:30 → No activity for 3 hours!           │
│         ⚠️ System alerts admin              │
│         Admin dashboard shows "STALLED"     │
│         Admin can force-finalize            │
│                                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│                                             │
│  24:00 → Max duration reached              │
│          🚨 MUST be finalized               │
│          System flags for immediate action  │
│          Admin force-finalizes to highest   │
│                                             │
└─────────────────────────────────────────────┘
```

---

## 🔔 WebSocket Events

```typescript
// Event Types
type TiebreakerEvent = 
  | 'TIEBREAKER_STARTED'
  | 'BID_PLACED'
  | 'TEAM_WITHDRAWN'
  | 'TIEBREAKER_ENDED'
  | 'HIGHEST_CHANGED';

// Examples:

// When team places bid
{
  type: 'BID_PLACED',
  tiebreaker_id: 42,
  team_name: 'Team Alpha',
  new_bid: 35,
  current_highest: 35,
  current_highest_team: 'team_alpha_id',
  teams_remaining: 3
}

// When team withdraws
{
  type: 'TEAM_WITHDRAWN',
  tiebreaker_id: 42,
  team_name: 'Team Beta',
  teams_remaining: 2,
  message: 'Team Beta has withdrawn'
}

// When only 1 team left (auto-finalize)
{
  type: 'TIEBREAKER_ENDED',
  tiebreaker_id: 42,
  winner_team: 'Team Alpha',
  winning_bid: 35,
  reason: 'last_team_standing'
}
```

---

## 🎯 API Validation Logic

### POST /api/team/bulk-tiebreakers/:id/bid
```typescript
// Validation checks:
1. Is tiebreaker active?
2. Is team participating in this tiebreaker?
3. Has team already withdrawn?
4. Is bid amount > current_highest_bid?
5. Does team have sufficient balance?
6. Is this within 24 hour limit?

// If all pass → Accept bid
// Update: current_highest_bid, current_highest_team, last_activity_time
// Broadcast: BID_PLACED event to all teams
// Check: If only 1 team left → Auto-finalize
```

### POST /api/team/bulk-tiebreakers/:id/withdraw
```typescript
// Validation checks:
1. Is tiebreaker active?
2. Is team participating in this tiebreaker?
3. Has team already withdrawn?
4. Is team NOT the highest bidder? ← CRITICAL
5. Is this within 24 hour limit?

// If all pass → Accept withdrawal
// Update: team status to WITHDRAWN, teams_remaining--, last_activity_time
// Broadcast: TEAM_WITHDRAWN event to all teams
// Check: If only 1 team left → Auto-finalize
```

---

## 🏆 Auto-Finalize Logic

```typescript
function checkAutoFinalize(tiebreaker_id) {
  // Count active teams
  const activeTeams = SELECT COUNT(*) 
                      FROM bulk_tiebreaker_teams 
                      WHERE tiebreaker_id = tiebreaker_id 
                      AND status = 'active';
  
  if (activeTeams === 1) {
    // Only 1 team left → Winner!
    const winner = SELECT team_id, last_bid 
                   FROM bulk_tiebreaker_teams 
                   WHERE tiebreaker_id = tiebreaker_id 
                   AND status = 'active';
    
    // Finalize tiebreaker
    assignPlayerToTeam(winner.team_id);
    deductBalance(winner.team_id, winner.last_bid || 10);
    updateTiebreakerStatus(tiebreaker_id, 'resolved');
    
    // Notify all
    broadcast('TIEBREAKER_ENDED', { winner, reason: 'last_team_standing' });
  }
}

// Call this function after:
// - Every bid placed
// - Every withdrawal
```

---

## 📊 Admin Dashboard View

```
┌────────────────────────────────────────────────────┐
│  Bulk Round #1 - Tiebreakers                       │
├────────────────────────────────────────────────────┤
│                                                    │
│  Tiebreaker #1: John Doe (CF)                     │
│  Status: 🟢 ACTIVE                                 │
│  Started: 45 minutes ago                          │
│  Last Activity: 2 minutes ago                     │
│                                                    │
│  Teams (3/5 remaining):                           │
│  👑 Team Alpha - £35 (Highest - Cannot withdraw)  │
│  🟡 Team Beta - £30 (Can bid or withdraw)         │
│  🟡 Team Gamma - £25 (Can bid or withdraw)        │
│  ❌ Team Delta - Withdrawn at £20                  │
│  ❌ Team Epsilon - Withdrawn at £15                │
│                                                    │
│  [Force Finalize] [View Details] [Cancel]         │
│                                                    │
├────────────────────────────────────────────────────┤
│                                                    │
│  Tiebreaker #2: Jane Smith (AMF)                  │
│  Status: ⚠️ STALLED (3h no activity)               │
│  Started: 4 hours ago                             │
│  Last Activity: 3 hours 12 minutes ago            │
│                                                    │
│  Teams (2/4 remaining):                           │
│  👑 Team Delta - £40 (Highest)                     │
│  🟡 Team Zeta - £25                                │
│  ❌ Team Alpha - Withdrawn                         │
│  ❌ Team Beta - Withdrawn                          │
│                                                    │
│  ⚠️ ACTION REQUIRED                                │
│  [Force Finalize Now] [Send Reminder] [Cancel]    │
│                                                    │
└────────────────────────────────────────────────────┘
```

---

This is the complete Last Person Standing mechanism! Ready to implement? 🚀
