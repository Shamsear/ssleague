# Bulk Rounds Pages - Committee Side

## Overview
Three pages have been set up for managing bulk rounds on the committee side of the Next.js application. These pages are frontend-only with placeholder structures where features will be added later.

## Pages Created/Updated

### 1. **Main Bulk Rounds Page** ✅ (Already Exists)
**Path:** `app/dashboard/committee/bulk-rounds/page.tsx`

**Features:**
- List all bulk rounds for the current season
- Filter rounds by status (all, draft, scheduled, active, completed)
- Create new bulk rounds with base price and duration
- View active round alerts
- Navigate to individual round details
- Status indicators with color coding
- Real-time round statistics

**Status:** Already implemented and functional

---

### 2. **Bulk Round Details Page** ✅ (Already Exists)
**Path:** `app/dashboard/committee/bulk-rounds/[id]/page.tsx`

**Features:**
- Display round information (base price, duration, player count)
- Show active round timer (countdown)
- Statistics cards (total players, sold, contested)
- Player management (add/remove players)
- Player list with bid counts and status
- Round status controls (start, complete, delete)
- Navigation to tiebreakers page
- Tiebreaker alerts for contested players

**Status:** Already implemented and functional

---

### 3. **Bulk Round Tiebreakers Page** ✅ NEW
**Path:** `app/dashboard/committee/bulk-rounds/[id]/tiebreakers/page.tsx`

**Features:**
- **Header Section:**
  - Back navigation to bulk round details
  - Round number display
  - Page description

- **Info Card:**
  - Explanation of how tiebreakers work
  - Yellow-themed alert design

- **Statistics Cards:**
  - Total tiebreakers
  - Active tiebreakers
  - Pending tiebreakers
  - Completed tiebreakers

- **Filter Bar:**
  - Filter by status: All, Pending, Active, Completed

- **Action Buttons (Placeholders for future features):**
  - Create Tiebreaker (Coming Soon)
  - Resolve All (Coming Soon)
  - Refresh Status (Coming Soon)

- **Tiebreakers List:**
  - Expandable/collapsible tiebreaker cards
  - Player name, position, and status badges
  - Base price and bid statistics
  - Team bid details (when expanded):
    - Team name
    - Bid amount
    - Submission status
    - Submission timestamp
  - Action buttons per tiebreaker:
    - Resolve Tiebreaker (Coming Soon)
    - Cancel Tiebreaker (Coming Soon)

**Status:** ✅ Created with mock data

---

## Navigation Flow

```
Committee Dashboard
    ↓
Bulk Rounds List (/dashboard/committee/bulk-rounds)
    ↓
Bulk Round Details (/dashboard/committee/bulk-rounds/[id])
    ↓
Tiebreakers Page (/dashboard/committee/bulk-rounds/[id]/tiebreakers)
```

## Mock Data Structure

### Tiebreaker Interface
```typescript
interface Tiebreaker {
  id: string;
  round_id: string;
  player_id: string;
  player_name: string;
  position: string;
  original_amount: number;
  status: string; // 'pending', 'active', 'completed', 'cancelled'
  teams_count: number;
  submitted_count: number;
  created_at: string;
  teams: TiebreakerTeam[];
}

interface TiebreakerTeam {
  team_id: string;
  team_name: string;
  bid_amount?: number;
  submitted_at?: string;
  status: string; // 'pending', 'submitted', 'won', 'lost'
}
```

## Design Patterns

All pages follow the existing design system:
- **Glass morphism effects** - `glass` class with backdrop blur
- **Color coding:**
  - Blue (#0066FF) - Primary actions and links
  - Green - Success states, completed items
  - Yellow - Warnings, tiebreakers, active states
  - Red - Errors, cancelled items
  - Gray - Neutral, pending states
- **Responsive design** - Mobile-first with Tailwind breakpoints
- **Consistent spacing** - 8px base unit system
- **Icon usage** - Heroicons for all icons
- **Typography** - Gradient text for headers

## Features to Implement Later

### Tiebreakers Page:
1. **Create Tiebreaker API Integration**
   - Endpoint: `POST /api/rounds/[id]/tiebreakers`
   - Create tiebreaker from contested player

2. **Fetch Tiebreakers API**
   - Endpoint: `GET /api/rounds/[id]/tiebreakers`
   - Replace mock data with real data

3. **Resolve Tiebreaker**
   - Endpoint: `POST /api/tiebreakers/[id]/resolve`
   - Award player to highest bidder
   - Update team budgets

4. **Cancel Tiebreaker**
   - Endpoint: `POST /api/tiebreakers/[id]/cancel`
   - Return player to available pool

5. **Resolve All Tiebreakers**
   - Bulk resolve operation
   - Batch API call

6. **Real-time Updates**
   - WebSocket or polling for live bid updates
   - Auto-refresh when teams submit bids

7. **Notifications**
   - Alert committee when all teams have submitted
   - Warning when tiebreaker has been pending too long

### Bulk Round Details Page:
1. **Add Players Functionality**
   - Complete the add players API integration

2. **Start Round Button**
   - Activate round and start timer

3. **Finalize Round Button**
   - Process all results and resolve tiebreakers

## API Endpoints Needed

```typescript
// Tiebreakers
GET    /api/rounds/[roundId]/tiebreakers
POST   /api/rounds/[roundId]/tiebreakers
GET    /api/tiebreakers/[id]
PATCH  /api/tiebreakers/[id]
DELETE /api/tiebreakers/[id]
POST   /api/tiebreakers/[id]/resolve
POST   /api/tiebreakers/[id]/cancel

// Bulk Rounds
POST   /api/rounds/[roundId]/add-players
POST   /api/rounds/[roundId]/start
POST   /api/rounds/[roundId]/finalize
```

## Testing Notes

To test the tiebreakers page:
1. Navigate to any bulk round: `/dashboard/committee/bulk-rounds/[any-id]`
2. Click "Manage Tiebreakers" button
3. You should see the tiebreakers page with mock data

## Color Reference

- **Primary Blue:** `#0066FF`
- **Hover Blue:** `#0052CC`
- **Success Green:** `bg-green-100` / `text-green-700`
- **Warning Yellow:** `bg-yellow-100` / `text-yellow-700`
- **Error Red:** `bg-red-100` / `text-red-700`
- **Neutral Gray:** `bg-gray-100` / `text-gray-700`

## Notes

- All pages use the `useAuth` hook for authentication
- Committee admin role is required (`user.role === 'committee_admin'`)
- Pages redirect to `/login` if not authenticated
- Pages redirect to `/dashboard` if wrong role
- Loading states are implemented with spinner and message
- All buttons have hover states and transitions
- Disabled buttons show "Coming Soon" tooltip
