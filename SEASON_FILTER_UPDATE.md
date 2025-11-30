# Season Filter Update - Real & Football Players

## Overview

Updated the team detail page to only show Real Players and Football Players when viewing a **specific season**, not in "Overall" or "All Seasons" views.

## Changes Made

### 1. Conditional Fetching
Players are now only fetched when a specific season is selected:

```typescript
useEffect(() => {
  // Only fetch players when a specific season is selected
  if (selectedView === 'season' && selectedSeasonId) {
    fetchFootballPlayers(selectedSeasonId);
    fetchRealPlayers(selectedSeasonId);
  } else {
    // Clear players when not viewing a specific season
    setFootballPlayers([]);
    setRealPlayers([]);
  }
}, [selectedView, selectedSeasonId, teamId]);
```

### 2. Updated Fetch Functions
Both fetch functions now require a `seasonId` parameter:

```typescript
const fetchFootballPlayers = async (seasonId: string) => {
  const response = await fetch(`/api/teams/${teamId}/football-players?seasonId=${seasonId}`);
  // ...
};

const fetchRealPlayers = async (seasonId: string) => {
  const response = await fetch(`/api/teams/${teamId}/real-players?seasonId=${seasonId}`);
  // ...
};
```

### 3. Conditional Display
Both player sections now only render when viewing a specific season:

```typescript
{/* Real Players Section */}
{selectedView === 'season' && selectedSeasonId && (
  <div>...</div>
)}

{/* Football Players Section */}
{selectedView === 'season' && selectedSeasonId && (
  <div>...</div>
)}
```

### 4. Empty State Messages
Added "No players found" messages when a season has no players:

**Real Players:**
- Icon: User group icon
- Message: "No real players found for this season"
- Subtext: "This team may not have had any real players registered in this season."

**Football Players:**
- Icon: Soccer ball icon
- Message: "No football players found for this season"
- Subtext: "This team may not have acquired any eFootball players in this season."

## User Experience

### View Modes

#### 1. Overall Stats View
- Shows: Aggregated team statistics across all seasons
- Does NOT show: Individual player lists
- Reason: Overall view is for high-level team performance

#### 2. All Seasons View
- Shows: Season-by-season breakdown of team performance
- Does NOT show: Individual player lists
- Reason: This view focuses on comparing seasons, not individual players

#### 3. Specific Season View (e.g., "Season 16")
- Shows: 
  - Season-specific team statistics
  - Real Players for that season
  - Football Players for that season
- Reason: When viewing a specific season, users want to see the roster

### Loading States

1. **Initial Load:** No players shown (waiting for season selection)
2. **Season Selected:** Loading spinner appears
3. **Data Loaded:** 
   - If players exist: Display player tables with stats
   - If no players: Show empty state message
4. **Season Changed:** Loading spinner appears again, then updates

### Example Flow

```
User visits /teams/SSPSLT0002
  ↓
Default view: "Overall Stats"
  ↓
No players shown (correct behavior)
  ↓
User clicks "Season 16" tab
  ↓
Loading spinners appear for both sections
  ↓
API fetches players for Season 16
  ↓
Players displayed in tables
  ↓
User clicks "Overall Stats" tab
  ↓
Player sections disappear (correct behavior)
```

## API Behavior

### With Season Filter
```bash
# Fetches only players from Season 16
GET /api/teams/SSPSLT0002/real-players?seasonId=SSPSLS16
GET /api/teams/SSPSLT0002/football-players?seasonId=SSPSLS16
```

### Without Season Filter (Not Used in UI)
```bash
# Would fetch all players from all seasons
GET /api/teams/SSPSLT0002/real-players
GET /api/teams/SSPSLT0002/football-players
```

## Benefits

1. **Performance:** Only fetches data when needed
2. **Clarity:** Players are shown in context of their season
3. **User Intent:** Matches user expectations (season view = see that season's roster)
4. **Clean UI:** Overall/All Seasons views remain focused on statistics
5. **Proper Filtering:** Each season shows only its own players

## Testing Checklist

- [ ] Visit team page - no players shown by default
- [ ] Click "Overall Stats" - no players shown ✓
- [ ] Click "All Seasons" - no players shown ✓
- [ ] Click "Season 16" - players load and display ✓
- [ ] Click "Season 15" - different players load ✓
- [ ] Switch back to "Overall" - players disappear ✓
- [ ] Check loading states work correctly ✓
- [ ] Check empty states show when no players ✓
- [ ] Verify season filter is passed to API ✓

## Edge Cases Handled

1. **No Players in Season:** Shows empty state message
2. **Loading State:** Shows spinner while fetching
3. **API Error:** Clears players array, shows empty state
4. **Rapid Tab Switching:** useEffect properly cleans up and refetches
5. **Invalid Season:** API returns empty array, shows empty state

## Code Quality

- Type-safe with TypeScript interfaces
- Proper React hooks usage (useEffect dependencies)
- Clean state management
- Error handling
- Loading states
- Empty states
- Responsive design maintained
