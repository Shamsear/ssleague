# Rounds API Fix - Committee Rounds Page

## Issue
Committee rounds page was not showing active rounds because it was using the wrong API that queries the old `auction_rounds` table instead of the new `rounds` table.

## Root Cause
Your system has two auction systems:
1. **OLD**: Live auction system (`auction_rounds` table) - real-time bidding
2. **NEW**: Blind bidding system (`rounds` table) - sealed bids

The committee rounds page was using `/api/rounds` which queries the old `auction_rounds` table, but your active season is using the new blind bidding system with the `rounds` table.

## Solution

### 1. Created New Admin API
**File**: `app/api/admin/rounds/route.ts`

This API handles the blind bidding `rounds` table:

```typescript
// GET /api/admin/rounds?season_id=xxx
// List all rounds with bid statistics

// POST /api/admin/rounds
// Create new round
{
  season_id: "season-id",
  position: "GK",
  max_bids_per_team: 5,
  duration_hours: 2
}
```

### 2. Updated Committee Rounds Page
**File**: `app/dashboard/committee/rounds/page.tsx`

Changes:
- ✅ Changed API endpoint from `/api/rounds` to `/api/admin/rounds`
- ✅ Updated Round interface to match new structure
- ✅ Updated request body for creating rounds

### 3. Table Structure

#### NEW System (`rounds` table):
```sql
CREATE TABLE rounds (
  id UUID PRIMARY KEY,
  season_id VARCHAR NOT NULL,
  position VARCHAR NOT NULL,
  max_bids_per_team INTEGER NOT NULL,
  end_time TIMESTAMP NOT NULL,
  status VARCHAR DEFAULT 'active',
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

#### OLD System (`auction_rounds` table):
```sql
CREATE TABLE auction_rounds (
  id SERIAL PRIMARY KEY,
  season_id VARCHAR,
  round_number INTEGER,
  position VARCHAR,
  round_type VARCHAR,
  base_price INTEGER,
  ...
);
```

## Features

### New Admin Rounds API Features:
1. ✅ **List Rounds**: Get all rounds for a season with bid statistics
2. ✅ **Create Round**: Start a new blind bidding round
3. ✅ **Authentication**: JWT-based auth (admin/committee_admin only)
4. ✅ **Validation**: Prevents multiple active rounds simultaneously
5. ✅ **Statistics**: Returns total bids and teams participating

### Response Format:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "season_id": "season-id",
      "position": "GK",
      "max_bids_per_team": 5,
      "end_time": "2025-01-04T18:00:00Z",
      "status": "active",
      "total_bids": 15,
      "teams_bid": 3,
      "created_at": "2025-01-04T16:00:00Z",
      "updated_at": "2025-01-04T16:00:00Z"
    }
  ]
}
```

## Testing

1. **Start Dev Server**:
   ```bash
   npm run dev
   ```

2. **Go to Committee Dashboard**:
   ```
   http://localhost:3000/dashboard/committee
   ```

3. **Navigate to Rounds Management**

4. **Start a New Round**:
   - Select Position (e.g., GK)
   - Set Duration (e.g., 2 hours)
   - Set Max Bids per Team (e.g., 5)
   - Click "Start Round"

5. **Verify**:
   - Round should appear in the active rounds list
   - Timer should start counting down
   - Teams can now place bids

## Files Modified

1. ✅ Created: `app/api/admin/rounds/route.ts` (NEW API)
2. ✅ Updated: `app/dashboard/committee/rounds/page.tsx` (Committee UI)

## Files NOT Modified (Old System)

- `app/api/rounds/route.ts` - Still queries `auction_rounds` (for old live auction system)

## Result

✅ Committee can now see active rounds
✅ Committee can create new rounds
✅ Rounds are properly stored in Neon database
✅ Teams can bid on active rounds
✅ Round statistics are displayed

---

**Fixed**: January 2025
**Status**: ✅ Complete
