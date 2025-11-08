# Auction Window Architecture

## Overview
The auction system has been refactored to support **multiple auction settings per season**, each tied to a specific **auction window type** (season_start, transfer_window, mid_season, etc.). This allows different rules for different auction contexts.

## Database Schema

### `auction_settings` Table
```sql
CREATE TABLE auction_settings (
  id SERIAL PRIMARY KEY,
  season_id VARCHAR(255) NOT NULL,
  auction_window VARCHAR(50) NOT NULL DEFAULT 'season_start',
  max_rounds INTEGER DEFAULT 25,
  min_balance_per_round INTEGER DEFAULT 30,
  contract_duration INTEGER DEFAULT 2,
  max_squad_size INTEGER DEFAULT 25,
  phase_1_end_round INTEGER DEFAULT 18,
  phase_1_min_balance INTEGER DEFAULT 30,
  phase_2_end_round INTEGER DEFAULT 20,
  phase_2_min_balance INTEGER DEFAULT 30,
  phase_3_min_balance INTEGER DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_season_auction_window UNIQUE (season_id, auction_window)
);
```

### `rounds` Table
```sql
ALTER TABLE rounds 
ADD COLUMN auction_settings_id INTEGER REFERENCES auction_settings(id) ON DELETE SET NULL;
```

## Auction Window Types
- `season_start` - Main season auction (e.g., 25 rounds)
- `transfer_window` - Transfer window auction (e.g., 10 rounds)
- `mid_season` - Mid-season auction (e.g., 5 rounds)
- `winter_window` - Winter transfer window
- `summer_window` - Summer transfer window

## Architecture Flow

### Before (Old System)
```
Round → season_id → Query auction_settings WHERE season_id = X
```
Problem: Only one set of settings per season

### After (New System)
```
Round → auction_settings_id → Direct join to specific auction_settings
```
Benefit: Multiple settings per season, selected at round creation time

## Example Settings

```javascript
// Season Start (Full Auction)
{
  season_id: 'SSPSLS16',
  auction_window: 'season_start',
  max_rounds: 25,
  phase_1_end_round: 18,  // Strict reserve until round 18
  phase_2_end_round: 20,  // Soft reserve until round 20
  phase_3_min_balance: 10, // Flexible after round 20
  max_squad_size: 25
}

// Transfer Window (Shorter)
{
  season_id: 'SSPSLS16',
  auction_window: 'transfer_window',
  max_rounds: 10,
  phase_1_end_round: 7,   // Shorter strict phase
  phase_2_end_round: 9,   // Shorter soft phase
  phase_3_min_balance: 10,
  max_squad_size: 28      // Allow larger squad
}

// Mid-Season (Quick Auction)
{
  season_id: 'SSPSLS16',
  auction_window: 'mid_season',
  max_rounds: 5,
  phase_1_end_round: 3,   // Very short phases
  phase_2_end_round: 4,
  phase_3_min_balance: 10,
  max_squad_size: 30
}
```

## Updated Components

### ✅ Completed

1. **Database Schema**
   - Added `auction_window` column to `auction_settings`
   - Added `auction_settings_id` column to `rounds`
   - Added unique constraint on (`season_id`, `auction_window`)
   - Added FK constraint on `rounds.auction_settings_id`

2. **Auction Settings UI** (`app/dashboard/committee/auction-settings/page.tsx`)
   - Added auction_window dropdown selector
   - Window types: season_start, transfer_window, mid_season, winter_window, summer_window

3. **Auction Settings API** (`app/api/auction-settings/route.ts`)
   - GET accepts `auction_window` query param
   - POST creates/updates settings by (season_id, auction_window)
   - Returns settings specific to window type

4. **Normal Round Creation API** (`app/api/admin/rounds/route.ts`)
   - Accepts `auction_settings_id` instead of `season_id`
   - Fetches `season_id` from auction_settings
   - Stores `auction_settings_id` in rounds table
   - Validates settings exist before creating round

5. **Reserve Calculator** (`lib/reserve-calculator.ts`)
   - Fetches auction settings via round's `auction_settings_id`
   - Uses JOIN to get settings in single query
   - Backward compatible (falls back to season settings if no auction_settings_id)

### 🚧 Remaining Work

1. **Normal Round Creation UI** (`app/dashboard/committee/rounds/page.tsx`)
   - [ ] Add state to fetch available auction_settings
   - [ ] Add dropdown to select auction_settings_id
   - [ ] Update `handleStartRound` to send `auction_settings_id`

2. **Bulk Round Creation API** (`app/api/admin/bulk-rounds/route.ts`)
   - [ ] Accept `auction_settings_id` parameter
   - [ ] Store in rounds table

3. **Bulk Round Creation UI** (`app/dashboard/committee/bulk-rounds/page.tsx`)
   - [ ] Add auction_settings selector
   - [ ] Update submission to include `auction_settings_id`

4. **Normal Tiebreaker Reserve** (`app/api/tiebreakers/[id]/submit/route.ts`)
   - [ ] Already uses `calculateReserve` - should work automatically

5. **Bulk Tiebreaker Reserve** (`app/api/team/bulk-tiebreakers/[id]/bid/route.ts`)
   - [ ] Already uses `calculateReserve` - should work automatically

## Testing

Run the test script to create example settings:
```bash
npx tsx scripts/test-auction-windows.ts
```

This creates:
- Season Start: 25 rounds, phases at 18/20
- Transfer Window: 10 rounds, phases at 7/9  
- Mid-Season: 5 rounds, phases at 3/4

## Migration Notes

- Existing rounds without `auction_settings_id` will use fallback to season settings
- Reserve calculator logs warnings for rounds without `auction_settings_id`
- Backward compatible - old rounds still work

## Benefits

1. **Flexibility**: Different rules for different auction types
2. **Reusability**: Same settings can be used for multiple rounds
3. **Clarity**: Settings are explicitly linked to rounds
4. **Scalability**: Easy to add new auction window types
