# Team Bulk Rounds Pages - Documentation

## Overview
Two new pages have been created for teams to participate in bulk bidding rounds and tiebreaker auctions. These pages are frontend-only with mock data and placeholder structures where backend features will be added later.

## Pages Created

### 1. **Team Bulk Round Bidding Page** ✅ NEW
**Path:** `app/dashboard/team/bulk-round/[id]/page.tsx`

**Purpose:** Allows teams to select and bid on multiple players at a fixed base price (£10)

**Features:**
- **Timer Display:**
  - Countdown timer with color coding (green → orange → red)
  - Shows hours:minutes:seconds remaining

- **Info Cards:**
  - Time Remaining
  - Base Price (£10 fixed)
  - Your Balance
  - Selected Players Count

- **Cost Summary Banner:**
  - Appears when players are selected
  - Shows: Selected count × Base price = Total cost
  - Displays remaining balance after bids
  - Submit Bids button

- **How It Works Info Card:**
  - Explains bulk bidding process
  - Fixed price bidding at £10
  - Automatic assignment for single bidders
  - Tiebreaker process for multiple bidders

- **Filters and Controls:**
  - Search bar for player names
  - Position filters (All, GK, DEF, MID, FWD)
  - Select All / Deselect All button

- **Player Selection Grid:**
  - Grid of player cards (responsive: 1/2/3 columns)
  - Checkbox-style selection
  - Shows: Name, Position, Club, Rating, Playing Style
  - Star icon for favorite players
  - Visual feedback on selection (blue border, blue background)

- **Selection Features:**
  - Multi-select capability
  - Click to toggle selection
  - Balance validation before submission
  - Confirmation dialog before submitting

**Status:** ✅ Created with mock data

---

### 2. **Team Bulk Tiebreaker Auction Page** ✅ NEW
**Path:** `app/dashboard/team/bulk-tiebreaker/[id]/page.tsx`

**Purpose:** Open auction interface for teams to bid on contested players

**Features:**
- **Status Banner:**
  - **Winning State:** Green banner with success icon
    - "You're Winning!" message
    - Shows your current bid amount
  - **Losing State:** Orange banner with warning icon
    - "You're Being Outbid!" message
    - Shows highest bidder and their bid

- **Player Information Card:**
  - Player avatar/icon
  - Name, Position, Club, Rating
  - Original bid amount
  - Your last bid (if any)

- **Bidding Section:**
  - **Current Highest Bid Display:**
    - Large red text showing amount
    - Shows bidder team name
  
  - **Your Balance Display:**
    - Large green text
    - Shows available balance after bid
  
  - **Bid Input:**
    - Large input field with £ symbol
    - Quick action buttons:
      - "Min Bid" (current + 1)
      - "+£5" (current + 5)
    - Minimum bid indicator
  
  - **Action Buttons:**
    - **Place Bid:** Large blue button
    - **Withdraw:** Red button to exit auction

- **How It Works Info Card:**
  - Yellow-themed informational panel
  - Explains open auction rules:
    - Highest bidder wins
    - Continuous bidding until close
    - Must bid higher than current
    - Last bid when closed wins
    - Can withdraw anytime

- **Bid History:**
  - Chronological list (newest first)
  - Shows all bids placed
  - Visual differentiation for your bids (blue background)
  - Displays:
    - Team avatar/initial
    - Team name (or "Your Team")
    - Bid amount (large)
    - Timestamp
    - "Highest Bid" tag for current leader

- **Real-time Updates:**
  - Auto-refreshes every 5 seconds
  - Polls for new bids
  - Updates bid history automatically

**Status:** ✅ Created with mock data

---

## Navigation Flow

```
Team Dashboard
    ↓
Bulk Round Page (/dashboard/team/bulk-round/[id])
    - Select players
    - Submit bids
    ↓
(If multiple bids on same player)
    ↓
Tiebreaker Auction (/dashboard/team/bulk-tiebreaker/[id])
    - Open auction bidding
    - Highest bidder wins
```

## Mock Data Structure

### Bulk Round
```typescript
interface BulkRound {
  id: number;
  round_number: number;
  status: string;
  base_price: number; // Fixed at £10
  start_time?: string;
  end_time?: string;
  duration_seconds: number;
  player_count: number;
}
```

### Tiebreaker
```typescript
interface Tiebreaker {
  id: string;
  round_id: string;
  player_id: string;
  player_name: string;
  position: string;
  original_amount: number; // Original £10 bid
  current_highest_bid: number;
  highest_bidder_team_id?: string;
  highest_bidder_team_name?: string;
  status: string;
  my_last_bid?: number;
  bid_history: Bid[];
}

interface Bid {
  team_id: string;
  team_name: string;
  amount: number;
  timestamp: string;
}
```

## Design Features

### Bulk Round Page:
- **Color Scheme:**
  - Blue (#0066FF) for primary actions
  - Blue-50 background for selected items
  - Green for positive indicators (balance)
  - Red for warnings (timer, insufficient balance)

- **Interactions:**
  - Hover effects on player cards
  - Click to toggle selection
  - Smooth transitions
  - Visual feedback

- **Responsive:**
  - Mobile: 1 column grid
  - Tablet: 2 columns
  - Desktop: 3 columns

### Tiebreaker Page:
- **Color Scheme:**
  - Green for winning state
  - Orange for losing/warning state
  - Red for current highest bid
  - Blue for your bids in history
  - Yellow for info cards

- **Real-time Feel:**
  - 5-second polling
  - Optimistic updates
  - Smooth animations
  - Instant visual feedback

## Features to Implement Later

### Bulk Round Page:
1. **API Integration:**
   - `GET /api/team/bulk-rounds/[id]` - Fetch round and players
   - `POST /api/team/bulk-rounds/[id]/bids` - Submit bids
   - `GET /api/team/balance` - Get team balance

2. **Real-time Updates:**
   - WebSocket for live player availability
   - Timer synchronization with server

3. **Enhanced Features:**
   - Player detailed view modal
   - Bid history/status for each player
   - Notification when round ends
   - Auto-save selections

### Tiebreaker Page:
1. **API Integration:**
   - `GET /api/team/tiebreakers/[id]` - Fetch tiebreaker data
   - `POST /api/team/tiebreakers/[id]/bid` - Place bid
   - `POST /api/team/tiebreakers/[id]/withdraw` - Withdraw from auction
   - WebSocket for real-time bid updates

2. **Enhanced Features:**
   - Audio notification on new bid
   - Auto-scroll to latest bid
   - Bid increment presets
   - Max bid limit setter
   - Countdown timer for auction close
   - Visual "Last Call" indicator

3. **Notifications:**
   - Alert when outbid
   - Alert when auction closing soon
   - Alert when you win/lose

## API Endpoints Needed

```typescript
// Bulk Rounds
GET    /api/team/bulk-rounds/[id]
POST   /api/team/bulk-rounds/[id]/bids
GET    /api/team/bulk-rounds/[id]/players

// Tiebreakers
GET    /api/team/tiebreakers/[id]
POST   /api/team/tiebreakers/[id]/bid
POST   /api/team/tiebreakers/[id]/withdraw
GET    /api/team/tiebreakers - List all active tiebreakers

// Team Data
GET    /api/team/balance
GET    /api/team/my-bids
```

## Testing

### Test Bulk Round Page:
1. Navigate to `/dashboard/team/bulk-round/123`
2. You'll see 20 mock players
3. Select/deselect players by clicking cards
4. Use filters and search
5. Try "Select All" button
6. Submit bids (will show alert as placeholder)

### Test Tiebreaker Page:
1. Navigate to `/dashboard/team/bulk-tiebreaker/456`
2. You'll see mock tiebreaker with bid history
3. Try changing bid amount
4. Use "Min Bid" and "+£5" buttons
5. Place bid (will show alert and update optimistically)
6. Check bid history updates

## User Experience Notes

### Bulk Round:
- **Simple Selection:** Teams just click to select players
- **Visual Feedback:** Blue border and background for selected
- **Balance Awareness:** Always shows remaining balance
- **No Competition:** First-come-first-served at base price
- **Quick Process:** Can bid on many players at once

### Tiebreaker:
- **Competitive:** Teams can see they're competing
- **Urgency:** Visual cues for winning/losing
- **Transparent:** Full bid history visible
- **Strategic:** Can choose when to bid
- **Open Auction:** Like eBay - highest bid wins

## Notes

- All pages use the `useAuth` hook for authentication
- Team role is required (`user.role === 'team'`)
- Pages redirect to `/login` if not authenticated
- Pages redirect to `/dashboard` if wrong role
- Loading states implemented with spinner
- Mock balance set to £1000 for testing
- Mock data refreshes on mount
- All buttons have hover states and transitions
- Disabled buttons show appropriate states
- Form validation before submission
