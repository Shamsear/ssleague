# Committee Round Detail & Tiebreaker System Implementation

## Overview
This document outlines the implementation of the committee round detail page with incomplete bid annotations and the complete tiebreaker system for handling tied bids during round finalization.

---

## Part 1: Committee Round Detail Page ✅ COMPLETED

### Features Implemented

#### 1. **Incomplete Bid Annotations**
When a team wins a player without submitting the required number of bids, the system now clearly indicates this:

**Visual Indicators:**
- Orange warning badges showing "Incomplete (X/Y bids)"
- Detailed explanation boxes explaining the incomplete bid penalty
- Display of both the average price paid and the original bid amount
- Highlighted rows in the winning bids table

**Data Flow:**
- Added `phase` column to `bids` table ('regular' or 'incomplete')
- Added `actual_bid_amount` column to store original bid when average price is applied
- Updated finalization logic to store phase information
- Component calculates and displays team bid counts vs required bids

#### 2. **Enhanced UI/UX**
- **Mobile Responsive**: Card-based layout for mobile, table for desktop
- **Glass Morphism Design**: Modern frosted glass effects matching template
- **Smooth Animations**: Fade-in effects with staggered delays
- **Collapsible Sections**: Team bid lists can be expanded/collapsed
- **Color-Coded Badges**: Position and rating badges with intuitive colors
- **Export Functionality**: Placeholder for Excel export (ready to implement)

#### 3. **Round Summary Section**
- Position, Status, and Date/Time at a glance
- Clean, card-based layout
- Responsive grid system

#### 4. **Winning Bids Section** (Only for completed rounds)
- Shows all players won with winning bids
- Displays incomplete bid warnings
- Mobile-optimized cards and desktop tables
- Team name, bid amount, rating, and status

#### 5. **All Bids by Team Section**
- Collapsible team sections
- Bid count and won count badges
- Chronological bid listing
- Won bids highlighted in green
- Detailed timestamps and amounts

###Files Modified/Created:
```
✅ app/dashboard/committee/rounds/[id]/page.tsx - New React component
✅ scripts/add-phase-to-bids.ts - Migration script for phase columns
✅ lib/finalize-round.ts - Updated to store phase information
```

### Database Changes:
```sql
ALTER TABLE bids 
  ADD COLUMN phase VARCHAR(20),
  ADD COLUMN actual_bid_amount INTEGER;
```

---

## Part 2: Tiebreaker System 🚧 IN PROGRESS

### System Requirements

#### Core Rules:
1. **One bid only** - Each team can submit exactly ONE new bid during tiebreaker
2. **Must be higher** - New bid must be greater than the original tied amount
3. **Replaces original bid** - The new bid replaces the tied bid in finalization
4. **Non-participation penalty** - Teams that don't participate are excluded

#### Flow:
```
1. Finalization detects tie (multiple bids with same highest amount)
   ↓
2. Create tiebreaker record
   ↓
3. Create team_tiebreaker records for each tied team
   ↓
4. Halt finalization process
   ↓
5. Redirect tied teams to tiebreaker page
   ↓
6. Teams submit new higher bids (one attempt only)
   ↓
7. After timer expires OR all teams submit:
   - Select highest new bid as winner
   - Exclude non-participants
   - Update bid records with new amounts
   - Resume finalization with updated bids
   ↓
8. Complete finalization process
```

### Database Schema ✅ COMPLETED

#### `tiebreakers` Table:
```sql
CREATE TABLE tiebreakers (
  id UUID PRIMARY KEY,
  round_id UUID REFERENCES rounds(id),
  player_id VARCHAR(255) REFERENCES footballplayers(id),
  original_amount INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'active', -- active, resolved, excluded
  winning_team_id VARCHAR(255),
  winning_amount INTEGER,
  duration_minutes INTEGER DEFAULT 2,
  created_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP
);
```

#### `team_tiebreakers` Table:
```sql
CREATE TABLE team_tiebreakers (
  id UUID PRIMARY KEY,
  tiebreaker_id UUID REFERENCES tiebreakers(id),
  team_id VARCHAR(255) NOT NULL,
  original_bid_id UUID REFERENCES bids(id),
  new_bid_amount INTEGER,
  submitted BOOLEAN DEFAULT FALSE,
  submitted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Implementation Plan

#### Step 1: Tiebreaker Detection in Finalization ⏳ TODO
**File**: `lib/finalize-round.ts`

Modify the finalization algorithm to:
- Detect when multiple bids have the same highest amount
- Create tiebreaker record
- Create team_tiebreaker records for each tied team
- Return tiebreaker information instead of error

#### Step 2: Tiebreaker API Routes ⏳ TODO
**Create**: `app/api/tiebreakers/` directory

**Routes needed:**
1. `GET /api/tiebreakers/[id]/route.ts`
   - Fetch tiebreaker details with team submissions
   - Used by both admin and team views

2. `POST /api/tiebreakers/[id]/submit/route.ts`
   - Submit new bid for team
   - Validates: amount > original, team hasn't submitted yet, balance check
   - Updates team_tiebreaker record

3. `GET /api/tiebreakers/[id]/status/route.ts`
   - Check if tiebreaker is resolved
   - Return winning team/amount if resolved
   - Used for real-time updates

4. `POST /api/tiebreakers/[id]/resolve/route.ts`
   - Auto-resolve tiebreaker (called by timeout or when all submit)
   - Select highest new bid
   - Exclude non-participants
   - Update bids table with new amounts
   - Resume finalization

#### Step 3: Committee Admin Tiebreaker View ⏳ TODO
**Create**: `app/dashboard/committee/tiebreakers/[id]/page.tsx`

**Features:**
- Player information card with photo and stats
- Status overview (active/resolved)
- Progress bar showing team submissions
- Real-time updates (auto-refresh every 5 seconds)
- Bid summary statistics
- Table showing all tied teams with their submission status
- Mobile-responsive design
- **No manual intervention** - Admin can only observe

#### Step 4: Team Tiebreaker View ⏳ TODO
**Create**: `app/dashboard/team/tiebreakers/[id]/page.tsx`

**Features:**
- Urgent action required alert
- Player information display
- Original bid vs minimum new bid
- Bid submission form with validation
- Increment/decrement controls
- Quick bid button (+£10 over original)
- Real-time timer countdown
- Balance check
- Auto-redirect when resolved
- One-time submission enforcement
- Success/waiting state after submission

#### Step 5: Update Finalization Route ⏳ TODO
**File**: `app/api/admin/rounds/[id]/finalize/route.ts`

Modify to:
- Call finalization algorithm
- If tie detected, create tiebreaker instead of returning error
- Return tiebreaker ID and redirect info to teams
- Store round state as 'finalizing' (new status)

#### Step 6: Tiebreaker Resolution Logic ⏳ TODO
**Create**: `lib/resolve-tiebreaker.ts`

Functions:
1. `checkTiebreakerCompletion(tiebreakerId)` - Check if all teams submitted or time expired
2. `resolveTiebreaker(tiebreakerId)` - Select winner, update bids, resume finalization
3. `excludeNonParticipants(tiebreakerId)` - Mark non-submitting teams' bids as excluded

Auto-resolution triggers:
- Scheduled check every 30 seconds for active tiebreakers
- Immediate check when last team submits
- Timeout based on duration_minutes

#### Step 7: Round Access Control ⏳ TODO
**File**: `app/dashboard/team/rounds/[id]/page.tsx`

Add middleware/checks:
- Block access after timer ends
- Block access after finalization button clicked
- Redirect to tiebreaker page if team has active tiebreaker
- Redirect to dashboard otherwise

#### Step 8: Team Redirection Logic ⏳ TODO
When finalization detects tie:
1. Mark round as 'finalizing'
2. Create tiebreaker
3. Teams trying to access round page get redirected:
   - If they're in the tiebreaker → `/dashboard/team/tiebreakers/[id]`
   - If they're not involved → `/dashboard`

### Testing Scenarios

#### Scenario 1: All Teams Participate
```
1. Three teams bid £1000 for Player A
2. Finalization detects tie
3. Tiebreaker created, all three teams redirected
4. Team 1 bids £1100, Team 2 bids £1150, Team 3 bids £1050
5. Team 2 wins with £1150
6. Finalization resumes with Team 2's winning bid
```

#### Scenario 2: Some Teams Don't Participate
```
1. Two teams bid £1000 for Player A
2. Tiebreaker created
3. Team 1 submits £1200
4. Team 2 doesn't submit (timeout)
5. Team 1 wins automatically
6. Team 2's original bid is excluded
```

#### Scenario 3: No Teams Participate
```
1. Two teams bid £1000 for Player A
2. Tiebreaker created
3. Neither team submits (timeout)
4. Both bids excluded from finalization
5. Player A goes unallocated (or to next highest bid if exists)
```

### UI/UX Considerations

#### Admin View:
- **Real-time updates**: Auto-refresh every 5 seconds
- **Progress tracking**: Visual progress bar and submission counters
- **Bid statistics**: Highest bid, average bid, original bid
- **Team status**: Clear indication of who has/hasn't submitted
- **Winner highlight**: Green background for winning team when resolved
- **No intervention**: No manual winner selection (Force Resolve button removed)

#### Team View:
- **Urgency indicators**: Yellow warning alerts, countdown timer
- **Clear instructions**: Minimum bid requirements, balance display
- **Validation**: Real-time validation of bid amount
- **One-shot submission**: Form disabled after submission
- **Waiting state**: Spinner and message while waiting for other teams
- **Auto-redirect**: Automatic redirect when tiebreaker resolves
- **Winner notification**: Show if your team won before redirecting

### Integration Points

#### Finalization Process:
```typescript
// Before (simple finalization)
finalizeRound() → allocate players → update database → complete

// After (with tiebreaker support)
finalizeRound() → detect tie? 
  ├─ No → allocate players → update database → complete
  └─ Yes → create tiebreaker → halt finalization
              ↓
          teams submit new bids
              ↓
          resolve tiebreaker → update bids → resume finalization
```

#### Notification System (Future):
- Email/SMS notifications when tiebreaker created
- Push notifications for bid submission deadline
- Real-time updates via WebSocket (optional enhancement)

---

## File Structure

```
nextjs-project/
├── app/
│   ├── api/
│   │   ├── admin/
│   │   │   └── rounds/
│   │   │       └── [id]/
│   │   │           └── finalize/
│   │   │               └── route.ts ✅ (needs tiebreaker integration)
│   │   └── tiebreakers/
│   │       └── [id]/
│   │           ├── route.ts ⏳ (GET tiebreaker details)
│   │           ├── submit/
│   │           │   └── route.ts ⏳ (POST new bid)
│   │           ├── status/
│   │           │   └── route.ts ⏳ (GET status)
│   │           └── resolve/
│   │               └── route.ts ⏳ (POST resolve)
│   ├── dashboard/
│   │   ├── committee/
│   │   │   ├── rounds/
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx ✅ COMPLETED
│   │   │   └── tiebreakers/
│   │   │       └── [id]/
│   │   │           └── page.tsx ⏳ (admin view)
│   │   └── team/
│   │       ├── rounds/
│   │       │   └── [id]/
│   │       │       └── page.tsx ⏳ (needs access control)
│   │       └── tiebreakers/
│   │           └── [id]/
│   │               └── page.tsx ⏳ (team view)
├── lib/
│   ├── finalize-round.ts ✅ (needs tiebreaker detection)
│   └── resolve-tiebreaker.ts ⏳ (new file)
└── scripts/
    ├── add-phase-to-bids.ts ✅ COMPLETED
    └── create-tiebreaker-tables.ts ✅ COMPLETED
```

---

## Next Steps

1. **Implement tiebreaker detection in finalization logic**
2. **Create all tiebreaker API routes**
3. **Build committee admin tiebreaker view page**
4. **Build team tiebreaker view page**
5. **Implement tiebreaker resolution logic**
6. **Add round access control**
7. **Test all scenarios**
8. **Add error handling and edge cases**

---

## Summary

### ✅ Completed:
- Committee round detail page with incomplete bid annotations
- Database schema for phase tracking in bids
- Finalization logic updated to store phase information
- Tiebreaker database tables created

### 🚧 In Progress:
- Tiebreaker system implementation (API routes, UI pages, resolution logic)

### ⏳ Todo:
- Complete remaining 7 tasks in the tiebreaker system
- Testing and validation
- Documentation and deployment

---

## Technical Notes

### Key Design Decisions:

1. **One-time bid submission**: Enforced at database level with `submitted` boolean flag
2. **No admin intervention**: Admin can only observe, system auto-resolves
3. **Automatic exclusion**: Non-participants automatically excluded after timeout
4. **Bid replacement**: New bids replace original tied bids in the finalization process
5. **Phase tracking**: Bids marked as 'regular' or 'incomplete' for transparency

### Performance Considerations:

- Indexes on `tiebreakers(round_id, status)` for quick lookups
- Indexes on `team_tiebreakers(tiebreaker_id, team_id)` for efficient queries
- Auto-refresh intervals: 5 seconds for admin, 1 second for team (during active bid)
- Efficient SQL queries with proper JOINs to minimize database calls

### Security Considerations:

- Team can only submit bid for their own tiebreaker
- Validation of bid amount (must be > original)
- Balance checking before submission
- One submission per team enforced
- Access control on round pages after finalization starts

---

**Last Updated**: 2025-01-05
**Status**: Phase 1 Complete, Phase 2 In Progress
