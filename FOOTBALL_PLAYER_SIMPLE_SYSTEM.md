# Football Player Simple Transfer System

## Overview

Football players now have a **simplified transfer system** separate from the complex real player system:

- **Swap**: Exchange team_ids between two players with progressive fees
  - First 3 swaps: **FREE**
  - 4th swap: **100 fee** (per team)
  - 5th swap: **125 fee** (per team)
- **Release**: Free a player from their team (always free)
- **No value changes, no stat upgrades**

## What Was Implemented

### 1. New API Endpoints

#### `/api/players/simple-swap` (POST)
Simple swap for football players - exchanges team_ids with progressive fees.

**Request Body:**
```json
{
  "player_a_id": "string",
  "player_b_id": "string",
  "season_id": "string",
  "swapped_by": "string",
  "swapped_by_name": "string"
}
```

**What it does:**
- Fetches both players
- Validates they're from different teams
- Gets swap count for both teams
- Calculates fees based on swap count:
  - Swaps 1-3: FREE
  - Swap 4: 100 fee
  - Swap 5: 125 fee
- Validates both teams have sufficient football_budget
- Swaps their team_ids in a transaction
- Deducts fees from football_budget
- Increments football_swap_count for both teams
- No value or stat changes

#### `/api/players/football-swap-limits` (GET)
Get swap count and next swap fee for a team.

**Query Parameters:**
- `team_id`: Team ID
- `season_id`: Season ID

**Response:**
```json
{
  "success": true,
  "data": {
    "swaps_used": 2,
    "next_swap_number": 3,
    "next_swap_fee": 0,
    "football_budget": 500,
    "can_afford_next_swap": true,
    "swap_history": [
      { "swap": 1, "fee": 0, "status": "used" },
      { "swap": 2, "fee": 0, "status": "used" },
      { "swap": 3, "fee": 0, "status": "available" },
      { "swap": 4, "fee": 100, "status": "available" },
      { "swap": 5, "fee": 125, "status": "available" }
    ]
  }
}
```

#### `/api/players/release` (POST)
Release a player (set team_id to null).

**Request Body:**
```json
{
  "player_id": "string",
  "player_type": "real" | "football",
  "season_id": "string",
  "released_by": "string",
  "released_by_name": "string"
}
```

**What it does:**
- Fetches the player
- Sets team_id to NULL
- Player becomes a free agent

### 2. New UI Component

#### `FootballPlayerForm.tsx`
A simplified form for football player operations with two modes:

**Swap Mode:**
- Select Player A
- Select Player B (from different team)
- Click "Swap Players"
- Done!

**Release Mode:**
- Select a player
- Click "Release Player"
- Player becomes free agent

### 3. Updated Transfer Page

The `/dashboard/committee/players/transfers` page now:

- Shows **different UIs** based on player type:
  - **Real Players**: Complex system with Transfer/Swap tabs, fees, upgrades
  - **Football Players**: Simple form with Swap/Release buttons

- Tabs are **hidden** for football players (they don't need them)

## How It Works

### For Real Players (Unchanged)
```
👤 Real Players selected
├── Tab: Transfer (Sale)
│   ├── Value increases (115%-150%)
│   ├── 10% committee fee
│   ├── Star rating upgrades
│   └── Salary recalculation
└── Tab: Swap
    ├── Fixed committee fees
    ├── Optional cash (30% limit)
    ├── Star rating upgrades
    └── Salary recalculation
```

### For Football Players (New)
```
⚽ Football Players selected
├── Button: Swap Players
│   ├── Shows swap count for each team
│   ├── Shows next swap fee (0, 100, or 125)
│   ├── Validates football_budget
│   └── Swaps team_ids + deducts fees
└── Button: Release Player
    └── Set team_id to NULL (always free)
```

## User Flow

### Swapping Football Players

1. Click "⚽ Football Players" button
2. Click "🔄 Swap Players" button
3. Select Player A from dropdown
   - See Team A's swap count and next fee
4. Select Player B from dropdown (different team)
   - See Team B's swap count and next fee
5. Review the fee preview:
   - Shows each team's fee
   - Shows total fees
   - Warns if insufficient funds
6. Click "🔄 Swap Players"
7. Confirm the swap (shows fees in confirmation)
8. Done! Players have exchanged teams and fees are deducted

### Releasing Football Players

1. Click "⚽ Football Players" button
2. Click "🆓 Release Player" button
3. Select a player from dropdown
4. Click "🆓 Release Player"
5. Confirm the release
6. Done! Player is now a free agent

## Database Changes

### What Changes:
- `footballplayers.team_id` - Updated to new team or NULL
- `team_seasons.football_budget` - Decreased by swap fee
- `team_seasons.football_swap_count` - Incremented by 1

### What Doesn't Change:
- `footballplayers.auction_value` - Stays the same
- `footballplayers.star_rating` - Stays the same
- `footballplayers.points` - Stays the same
- `footballplayers.salary_per_match` - Stays the same
- `realplayer` table - Never touched (master data)

## Key Differences from Real Player System

| Feature | Real Players | Football Players |
|---------|-------------|------------------|
| **Transfer (Sale)** | ✅ Yes (with fees) | ❌ No |
| **Swap** | ✅ Yes (with fees & upgrades) | ✅ Yes (progressive fees: 0/0/0/100/125) |
| **Release** | ❌ No | ✅ Yes |
| **Value Changes** | ✅ Yes (115%-150%) | ❌ No |
| **Committee Fees** | ✅ Yes (10% or fixed) | ✅ Yes (0/0/0/100/125 per swap) |
| **Star Upgrades** | ✅ Yes | ❌ No |
| **Salary Changes** | ✅ Yes | ❌ No |
| **Budget Updates** | ✅ Yes | ✅ Yes (football_budget only) |
| **Transfer Limits** | ✅ Yes (2 per season) | ✅ Yes (5 swaps per season) |
| **Transaction Logging** | ✅ Yes (detailed) | ⚠️ Minimal |

## Files Created/Modified

### New Files:
1. `app/api/players/simple-swap/route.ts` - Simple swap API with progressive fees
2. `app/api/players/football-swap-limits/route.ts` - Get swap count and fees
3. `app/api/players/release/route.ts` - Release player API
4. `app/dashboard/committee/players/transfers/FootballPlayerForm.tsx` - Simple UI with fee display

### Modified Files:
1. `app/dashboard/committee/players/transfers/page.tsx` - Added conditional rendering
2. `app/dashboard/committee/players/transfers/TransferFormV2.tsx` - Added key prop
3. `app/dashboard/committee/players/transfers/SwapFormV2.tsx` - Added key prop

## Testing

### Test Swap:
1. Go to `/dashboard/committee/players/transfers`
2. Click "⚽ Football Players"
3. Select two players from different teams
4. Check swap counts and fees displayed
5. Swap them
6. Verify team_ids changed in database
7. Verify values/stats stayed the same
8. Verify football_budget decreased by fee
9. Verify football_swap_count incremented
10. Repeat 3 times to test free swaps
11. Do 4th swap to test 100 fee
12. Do 5th swap to test 125 fee

### Test Release:
1. Go to `/dashboard/committee/players/transfers`
2. Click "⚽ Football Players"
3. Click "🆓 Release Player"
4. Select a player
5. Release them
6. Verify team_id is NULL in database

## Future Enhancements

Possible additions if needed:
1. Transaction logging for swaps/releases
2. News generation for football player movements
3. Undo functionality
4. Bulk swap operations
5. Free agent re-signing

## Summary

Football players now have a **simple, eFootball-style** transfer system with progressive fees:
- ✅ Swap = Exchange team_ids with fees (0/0/0/100/125)
- ✅ Release = Set team_id to NULL (always free)
- ✅ Swap limit tracking (5 per season)
- ✅ Budget validation (football_budget)
- ❌ No value changes, no stat upgrades

Real players keep their **complex fantasy league** system:
- ✅ Transfers with fees and value increases
- ✅ Swaps with fees and upgrades
- ✅ Full economic management
- ✅ Transfer limits (2 per season)

Both systems coexist peacefully! 🎉

## Fee Structure Summary

| Swap # | Fee per Team | Total (both teams) |
|--------|-------------|-------------------|
| 1st | FREE | 0 |
| 2nd | FREE | 0 |
| 3rd | FREE | 0 |
| 4th | 100 | 200 |
| 5th | 125 | 250 |

**Total cost for 5 swaps per team: 225**
