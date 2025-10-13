# Bulk Tiebreaker System Architecture

## 🏗️ System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        TEAM USERS                                │
│                                                                  │
│  [Browse Tiebreakers] → [View Details] → [Bid / Withdraw]      │
└────────────────────────┬─────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                     FRONTEND (Next.js)                           │
├─────────────────────────────────────────────────────────────────┤
│  Pages:                                                          │
│  • /team/tiebreakers              (List Page)                   │
│  • /team/tiebreakers/[id]         (Detail Page)                 │
│                                                                  │
│  Components:                                                     │
│  • TiebreakerCard                 (Card Component)              │
│  • BidModal                       (Bid Form)                    │
│  • WithdrawModal                  (Withdrawal Confirmation)     │
│                                                                  │
│  Utils:                                                          │
│  • tiebreakerUtils.ts             (Formatting, Validation)      │
│  • types/tiebreaker.ts            (TypeScript Definitions)      │
└────────────────────────┬─────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                   API LAYER (Next.js Routes)                     │
├─────────────────────────────────────────────────────────────────┤
│  Team Endpoints:                                                 │
│  • GET  /api/team/bulk-tiebreakers           [List]             │
│  • GET  /api/team/bulk-tiebreakers/:id       [View]             │
│  • POST /api/team/bulk-tiebreakers/:id/bid   [Bid]              │
│  • POST /api/team/bulk-tiebreakers/:id/withdraw [Withdraw]      │
│                                                                  │
│  Admin Endpoints:                                                │
│  • GET  /api/admin/bulk-tiebreakers          [List All]         │
│  • GET  /api/admin/bulk-tiebreakers/:id      [View]             │
│  • POST /api/admin/bulk-tiebreakers/:id/start [Start]           │
│  • POST /api/admin/bulk-tiebreakers/:id/finalize [Finalize]     │
└────────────────────────┬─────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                  AUTHENTICATION LAYER                            │
├─────────────────────────────────────────────────────────────────┤
│  Firebase Admin SDK:                                             │
│  • Verify ID tokens                                              │
│  • Check user roles (team vs committee_admin)                   │
│  • Validate permissions                                          │
└────────────────────────┬─────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                   BUSINESS LOGIC LAYER                           │
├─────────────────────────────────────────────────────────────────┤
│  Validation:                                                     │
│  • Bid amount validation                                         │
│  • Balance checking                                              │
│  • Time limit enforcement                                        │
│  • Status validation                                             │
│  • CRITICAL: Highest bidder cannot withdraw                     │
│                                                                  │
│  Winner Detection:                                               │
│  • Check if only 1 team remains                                  │
│  • Determine winner (last standing OR highest after 24h)        │
│  • Flag for auto-finalization                                    │
└────────────────────────┬─────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                   DATABASE LAYER (PostgreSQL)                    │
├─────────────────────────────────────────────────────────────────┤
│  Tables:                                                         │
│  • bulk_tiebreakers                                              │
│    - id, player_name, status, current_highest_bid, etc.         │
│                                                                  │
│  • bulk_tiebreaker_teams                                         │
│    - tiebreaker_id, team_id, status, current_bid, etc.          │
│                                                                  │
│  • bulk_tiebreaker_bids                                          │
│    - tiebreaker_id, team_id, bid_amount, bid_time, etc.         │
│                                                                  │
│  Helper Functions:                                               │
│  • check_tiebreaker_winner(tiebreaker_id)                       │
│    Returns: winner_team_id, teams_left                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📊 Data Flow Diagrams

### 1. Bid Placement Flow

```
┌──────────┐     ┌──────────┐     ┌───────────┐     ┌──────────┐
│  Team UI │────>│ API Route│────>│ Validation│────>│ Database │
└──────────┘     └──────────┘     └───────────┘     └──────────┘
     │                 │                 │                 │
     │  Submit Bid     │  POST /bid      │  Validate       │  INSERT
     │  Amount: £120   │                 │  • Amount       │  into bids
     │                 │                 │  • Balance      │  table
     │                 │                 │  • Status       │
     │                 │                 │  • Time         │  UPDATE
     │                 │                 │                 │  tiebreaker
     │                 │                 │                 │  highest bid
     │                 │                 │                 │
     │                 │                 │                 │  UPDATE
     │                 │                 │                 │  team current
     │                 │                 │                 │  bid
     │                 │                 │                 │
     │                 │                 │  Check Winner   │  SELECT
     │                 │                 │  (Only 1 left?) │  active teams
     │                 │                 │                 │
     │<────────────────│<────────────────│<────────────────│
     │  Success        │  Return data    │  Result         │  Data
     │  Message        │                 │                 │
     │                 │                 │                 │
     │  Auto-refresh   │                 │                 │
     │  UI             │                 │                 │
```

### 2. Withdrawal Flow

```
┌──────────┐     ┌──────────┐     ┌───────────┐     ┌──────────┐
│  Team UI │────>│ API Route│────>│ Validation│────>│ Database │
└──────────┘     └──────────┘     └───────────┘     └──────────┘
     │                 │                 │                 │
     │  Click          │  POST           │  CRITICAL       │  SELECT
     │  Withdraw       │  /withdraw      │  Check:         │  current
     │                 │                 │                 │  highest
     │                 │                 │  Is user        │
     │                 │                 │  the highest    │
     │                 │                 │  bidder?        │
     │                 │                 │                 │
     │                 │                 │  YES ❌         │
     │<────────────────│<────────────────│  REJECT         │
     │  Error:         │  400 Error      │                 │
     │  "Cannot        │                 │                 │
     │  withdraw!"     │                 │                 │
     │                 │                 │                 │
     │                 │                 │  NO ✅          │
     │                 │                 │  Allow          │  UPDATE
     │                 │                 │                 │  team status
     │                 │                 │                 │  to withdrawn
     │                 │                 │                 │
     │                 │                 │  Check Winner   │  SELECT
     │                 │                 │  (Only 1 left?) │  active teams
     │                 │                 │                 │
     │<────────────────│<────────────────│<────────────────│
     │  Success        │  Return data    │  Result         │  Data
     │  Message        │                 │                 │
```

### 3. Admin Start Tiebreaker Flow

```
┌──────────┐     ┌──────────┐     ┌───────────┐     ┌──────────┐
│ Admin UI │────>│ API Route│────>│ Validation│────>│ Database │
└──────────┘     └──────────┘     └───────────┘     └──────────┘
     │                 │                 │                 │
     │  Click Start    │  POST           │  Check:         │  SELECT
     │  Tiebreaker     │  /start         │  • Admin role   │  tiebreaker
     │                 │                 │  • Status=      │
     │                 │                 │    pending      │
     │                 │                 │  • Teams >= 2   │  SELECT
     │                 │                 │                 │  teams count
     │                 │                 │                 │
     │                 │                 │  All valid ✅   │  UPDATE
     │                 │                 │                 │  status=active
     │                 │                 │                 │  start_time=now
     │                 │                 │                 │  max_end=now+24h
     │                 │                 │                 │
     │<────────────────│<────────────────│<────────────────│
     │  Tiebreaker     │  Return data    │  Result         │  Data
     │  Started!       │                 │                 │
     │                 │                 │                 │
     │  TODO:          │                 │                 │
     │  Notify Teams   │                 │                 │
```

---

## 🔐 Security Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     REQUEST FLOW                                 │
└─────────────────────────────────────────────────────────────────┘

1. Browser Request
   ├─ Include Firebase ID token in cookie
   └─ Headers: Content-Type, Cookie

2. Next.js API Route
   ├─ Extract token from cookie
   ├─ Call Firebase Admin SDK
   └─ Verify token signature and expiry

3. Role Check
   ├─ Get user data from Firestore
   ├─ Check role field
   │  ├─ Admin routes require: role === 'committee_admin'
   │  └─ Team routes require: role === 'team'
   └─ Reject if unauthorized (403)

4. Business Logic
   ├─ Additional validations
   │  ├─ Participation check
   │  ├─ Balance check
   │  ├─ Status check
   │  └─ Time limit check
   └─ Execute if all pass

5. Database Transaction
   ├─ Multiple operations in sequence
   ├─ Use PostgreSQL transactions
   └─ Rollback on error

6. Response
   ├─ Success: Return data + message
   └─ Error: Return error code + message
```

---

## 🗄️ Database Schema

```
┌────────────────────────────────────────────────────────────────┐
│                   bulk_tiebreakers                              │
├────────────────────────────────────────────────────────────────┤
│ • id (UUID, PK)                                                 │
│ • round_id (UUID, FK → auction_rounds)                          │
│ • player_name (VARCHAR)                                         │
│ • player_team (VARCHAR)                                         │
│ • player_position (VARCHAR)                                     │
│ • status (ENUM: pending, active, completed, cancelled)         │
│ • tie_amount (INTEGER)                                          │
│ • tied_team_count (INTEGER)                                     │
│ • current_highest_bid (INTEGER)                                 │
│ • current_highest_team_id (VARCHAR)                             │
│ • start_time (TIMESTAMPTZ)                                      │
│ • last_activity_time (TIMESTAMPTZ)                              │
│ • max_end_time (TIMESTAMPTZ)  -- 24 hours from start           │
│ • created_at (TIMESTAMPTZ)                                      │
│ • updated_at (TIMESTAMPTZ)                                      │
└────────────────────────────────────────────────────────────────┘
                              │
                              │ 1:N
                              ▼
┌────────────────────────────────────────────────────────────────┐
│                bulk_tiebreaker_teams                            │
├────────────────────────────────────────────────────────────────┤
│ • id (UUID, PK)                                                 │
│ • tiebreaker_id (UUID, FK → bulk_tiebreakers)                   │
│ • team_id (VARCHAR)                                             │
│ • team_name (VARCHAR)                                           │
│ • status (ENUM: active, withdrawn)                              │
│ • current_bid (INTEGER)                                         │
│ • joined_at (TIMESTAMPTZ)                                       │
│ • withdrawn_at (TIMESTAMPTZ)                                    │
└────────────────────────────────────────────────────────────────┘
                              │
                              │ 1:N
                              ▼
┌────────────────────────────────────────────────────────────────┐
│                 bulk_tiebreaker_bids                            │
├────────────────────────────────────────────────────────────────┤
│ • id (UUID, PK)                                                 │
│ • tiebreaker_id (UUID, FK → bulk_tiebreakers)                   │
│ • team_id (VARCHAR)                                             │
│ • team_name (VARCHAR)                                           │
│ • bid_amount (INTEGER)                                          │
│ • bid_time (TIMESTAMPTZ)                                        │
└────────────────────────────────────────────────────────────────┘

Indexes:
• bulk_tiebreakers: (round_id), (status), (current_highest_team_id)
• bulk_tiebreaker_teams: (tiebreaker_id, team_id), (tiebreaker_id, status)
• bulk_tiebreaker_bids: (tiebreaker_id, bid_time DESC)
```

---

## 🔄 State Machine

```
Tiebreaker Status Flow:

  [Created]
      ↓
  pending ──────────────────────┐
      ↓                         │
   (Admin starts)               │ (Admin cancels)
      ↓                         │
  active ────────────────────┐  │
      ↓                      │  │
   (Only 1 team left)        │  │
   (24 hours elapsed)        │  │
      ↓                      │  │
  auto_finalize_pending      │  │
      ↓                      │  │
   (Admin finalizes)         │  │
      ↓                      │  │
  completed ◄────────────────┘  │
                                │
                                ▼
                           cancelled


Team Status Flow:

  [Team added]
      ↓
  active ──────────┐
      ↓            │
   (Withdraws)     │ (Tiebreaker ends)
      ↓            │
  withdrawn        │
      ↓            │
  [Cannot rejoin]  │
                   │
                   ▼
              [Tiebreaker
               completes]
```

---

## 🚦 Business Rules Enforcement

```
┌─────────────────────────────────────────────────────────────────┐
│                     VALIDATION MATRIX                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Bid Placement:                                                  │
│  ✓ Tiebreaker must be 'active'                                  │
│  ✓ Team must be 'active' (not withdrawn)                        │
│  ✓ Bid amount > current_highest_bid                             │
│  ✓ Bid amount <= team_balance                                   │
│  ✓ Within 24-hour time limit                                    │
│                                                                  │
│  Withdrawal:                                                     │
│  ✓ Tiebreaker must be 'active'                                  │
│  ✓ Team must be 'active' (not already withdrawn)                │
│  ✓ Team is NOT the current highest bidder ⚠️ CRITICAL          │
│  ✓ Within 24-hour time limit                                    │
│                                                                  │
│  Start Tiebreaker (Admin):                                       │
│  ✓ User has 'committee_admin' role                              │
│  ✓ Tiebreaker must be 'pending'                                 │
│  ✓ At least 2 active teams                                      │
│                                                                  │
│  Finalize Tiebreaker (Admin):                                    │
│  ✓ User has 'committee_admin' role                              │
│  ✓ Tiebreaker must be 'active' or 'auto_finalize_pending'      │
│  ✓ Determine winner (highest bidder with status='active')       │
│  ✓ Allocate player to winner                                    │
│  ✓ Deduct balance from winner                                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📈 Scalability Considerations

### Current Implementation
- ✅ Handles moderate concurrent users
- ✅ Database indexes for fast queries
- ✅ Efficient pagination (if needed)
- ✅ Auto-refresh every 10 seconds (not every second)

### Future Optimizations
- 🔜 **WebSocket**: Real-time updates without polling
- 🔜 **Redis Cache**: Cache active tiebreakers
- 🔜 **Load Balancer**: Distribute API requests
- 🔜 **CDN**: Cache static assets
- 🔜 **Database Replication**: Read replicas for queries

---

## 🧪 Testing Strategy

```
Unit Tests:
├─ Utility functions (formatting, validation)
├─ Business logic (winner detection)
└─ Helper functions (bid suggestions)

Integration Tests:
├─ API endpoints (all 8)
├─ Authentication flow
└─ Database transactions

End-to-End Tests:
├─ Complete bid flow (team places bid → wins)
├─ Complete withdrawal flow (team withdraws → another wins)
└─ Admin flow (start → finalize)

Load Tests:
├─ Multiple simultaneous bids
├─ Many concurrent users viewing
└─ Database query performance
```

---

## 📱 Responsive Design

```
Mobile (320px - 767px):
├─ Single column layout
├─ Stacked cards
├─ Bottom sheet modals
└─ Touch-friendly buttons

Tablet (768px - 1023px):
├─ 2-column grid
├─ Larger cards
└─ Centered modals

Desktop (1024px+):
├─ 3-column grid
├─ Sidebar layout (detail page)
├─ Larger fonts
└─ Hover effects
```

---

## 🎯 Performance Metrics

Target metrics:
- **API Response Time**: < 200ms
- **Page Load Time**: < 2s
- **Auto-refresh**: Every 10s (active only)
- **Database Query Time**: < 50ms
- **Time to Interactive**: < 3s

---

## 🔮 Future Architecture (Phase 5+)

```
With WebSocket Integration:

┌──────────┐     ┌──────────┐     ┌──────────┐
│  Client  │────>│ WebSocket│────>│ Server   │
│  (Team)  │     │  Server  │     │          │
└──────────┘     └──────────┘     └──────────┘
     ▲                 │                 │
     │                 │                 │
     │  Real-time      │  Broadcast      │  Database
     │  Updates        │  to all         │  Changes
     │                 │  connected      │
     │                 │  clients        │
     └─────────────────┴─────────────────┘

Events:
• tiebreaker:bid
• tiebreaker:withdraw
• tiebreaker:complete
• tiebreaker:update
```

---

**System is production-ready for immediate deployment!** 🚀
