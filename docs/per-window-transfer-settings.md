# Per-Window Transfer Settings Implementation

## Overview
Transfer settings are now configured on a **per-transfer-window basis** rather than globally for the entire league. This allows different transfer windows to have different rules (e.g., more transfers allowed in early windows, varying point costs, etc.).

## Changes Made

### 1. Database Migration
**File:** `database/migrations/add-transfer-window-settings.sql`

Added the following columns to the `transfer_windows` table:
- `max_transfers_per_window` (INTEGER, default 3) - Maximum number of transfers allowed during this window
- `points_cost_per_transfer` (INTEGER, default 4) - Fantasy points deducted per transfer
- `transfer_window_start` (TIMESTAMP) - When transfers can start (can differ from window opens_at)
- `transfer_window_end` (TIMESTAMP) - When transfers end (can differ from window closes_at)

**To apply the migration:**
```bash
psql -d your_fantasy_database -f database/migrations/add-transfer-window-settings.sql
```

### 2. Frontend Changes
**File:** `app/dashboard/committee/fantasy/transfers/[leagueId]/page.tsx`

#### New Features:
1. **Window Selector Dropdown** - Added to the "Transfer Settings" tab
   - Shows all available transfer windows with their status and date ranges
   - User must select a window before viewing/editing settings
   
2. **Per-Window Settings** - Settings are now loaded and saved for the selected window
   - When a window is selected, its specific settings are fetched from the API
   - Saving settings updates only the selected window
   - Opening/closing the transfer window affects only the selected window

3. **Auto-Selection** - The first window is automatically selected when the page loads

4. **Empty State** - Shows a helpful message when no window is selected

### 3. Backend API Changes
**File:** `app/api/fantasy/transfers/settings/route.ts`

#### GET Endpoint
- **Old:** `GET /api/fantasy/transfers/settings?league_id=xxx`
- **New:** `GET /api/fantasy/transfers/settings?window_id=xxx`

Returns settings for a specific transfer window including:
- `max_transfers_per_window`
- `points_cost_per_transfer`
- `is_transfer_window_open` (based on window's `is_active` status)
- `transfer_window_start` (falls back to `opens_at` if not set)
- `transfer_window_end` (falls back to `closes_at` if not set)

#### POST Endpoint
- **Changed:** Now requires `window_id` in the request body
- Updates the specified window's settings columns directly in PostgreSQL
- Supports partial updates (only provided fields are updated)

## Usage Flow

### For Committee Admins:

1. **Navigate** to the Transfer Management page
2. **Create** transfer windows in the "Transfer Windows" tab
3. **Switch** to the "Transfer Settings" tab
4. **Select** a transfer window from the dropdown
5. **Configure** settings specific to that window:
   - Maximum transfers allowed
   - Points cost per transfer
   - Optional custom start/end times for transfers
6. **Save** the settings
7. **Toggle** the window open/closed as needed

### Example Use Cases:

**Early Season Flexibility:**
- Window 1: 5 free transfers, 0 points cost
- Window 2: 3 transfers, 2 points cost
- Window 3+: 2 transfers, 4 points cost

**Mid-Season Adjustments:**
- Regular windows: 2 transfers, 4 points
- Special "Wildcard" window: Unlimited transfers, 0 points

**Emergency Windows:**
- Emergency window due to injuries: 5 transfers, 0 points

## Benefits

1. **Flexibility** - Different rules for different phases of the season
2. **Fairness** - Can offer more lenient rules early when teams are figuring things out
3. **Engagement** - Special transfer windows with unique rules can boost participation
4. **Granular Control** - Each window is independently configurable

## Migration Notes

If you have existing transfer windows in your database, they will default to:
- `max_transfers_per_window`: 3
- `points_cost_per_transfer`: 4
- `transfer_window_start`: NULL (will use `opens_at`)
- `transfer_window_end`: NULL (will use `closes_at`)

You can update these via the UI after applying the migration.

## Technical Details

### Data Flow:
1. Frontend loads all transfer windows
2. User selects a window from dropdown
3. Frontend fetches settings for that specific window via `GET /api/fantasy/transfers/settings?window_id=xxx`
4. User edits settings in the form
5. Frontend saves settings via `POST /api/fantasy/transfers/settings` with `window_id` in body
6. Backend updates only the specified window's columns in `transfer_windows` table

### Database Structure:
```sql
transfer_windows (
  window_id VARCHAR(100),
  league_id VARCHAR(100),
  window_name VARCHAR(255),
  opens_at TIMESTAMP,
  closes_at TIMESTAMP,
  is_active BOOLEAN,
  -- New columns:
  max_transfers_per_window INTEGER DEFAULT 3,
  points_cost_per_transfer INTEGER DEFAULT 4,
  transfer_window_start TIMESTAMP,
  transfer_window_end TIMESTAMP
)
```

## Future Enhancements

Potential features to add:
- Bulk settings update (apply same settings to multiple windows)
- Copy settings from one window to another
- Templates for common window configurations
- Per-window transfer history and analytics
