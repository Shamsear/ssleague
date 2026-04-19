# Bulk Tiebreaker vs Bulk Round Finalization Comparison

## Overview
This document compares the operations performed by bulk tiebreaker finalization vs bulk round finalization to ensure consistency.

---

## BULK ROUND FINALIZATION
**File:** `app/api/admin/bulk-rounds/[id]/finalize/route.ts`

### Operations Performed:

#### 1. **Slot Validation** ✅
- Checks team's `football_total_slots` vs `football_players_count`
- Skips assignment if no slots available
- Updates local slot count tracker during batch processing

#### 2. **Database Updates (Neon)**
- **round_players table:**
  - Sets `winning_team_id`, `winning_bid`, `status = 'sold'`, `bid_count`
  
- **round_bids table:**
  - Marks winning bid with `is_winning = true`
  
- **team_players table:**
  - Inserts/updates with `team_id`, `player_id`, `season_id`, `round_id`, `purchase_price`, `acquired_at`
  - Uses `ON CONFLICT` to handle duplicates
  
- **footballplayers table:**
  - Sets `is_sold = true`, `team_id`, `acquisition_value`, `status = 'active'`
  - Sets contract fields: `contract_id`, `contract_start_season`, `contract_end_season`, `contract_length`
  - Sets `season_id`, `round_id`, `updated_at`
  
- **teams table:**
  - Increments `football_spent` by winning amount
  - Decrements `football_budget` by winning amount
  - Increments `football_players_count` by 1
  - Only if new assignment (checks `team_players` first)

#### 3. **Firebase Updates**
- **team_seasons document:**
  - Handles both single and dual currency systems
  - Decrements `football_budget` (dual) or `budget` (single)
  - Increments `football_spent` (dual) or `total_spent` (single)
  - Increments `players_count`
  - Updates `position_counts` for player's position
  - Sets `updated_at`

#### 4. **Transaction Logging** ✅
- Calls `logAuctionWin()` with:
  - `firebase_uid` (from teams table)
  - `season_id`
  - `player_name`
  - `player_id`
  - `'football'` type
  - `winning_amount`
  - `current_budget`
  - `round_id`

#### 5. **Real-time Broadcasting** ✅
- `broadcastSquadUpdate()` - notifies team of player acquisition
- `broadcastWalletUpdate()` - notifies team of balance change
- `broadcastRoundUpdate()` - notifies all about round completion

#### 6. **News Generation** ✅
- Triggers `'auction_highlights'` news type
- Includes all allocations, stats, conflicts

#### 7. **FCM Notifications** ✅
- Sends push notification to all teams in season

---

## BULK TIEBREAKER FINALIZATION
**File:** `lib/finalize-bulk-tiebreaker.ts`

### Operations Performed:

#### 1. **Slot Validation** ✅
- Checks winner's `football_total_slots` vs `football_players_count`
- Returns error if no slots available
- Logs slot check details

#### 2. **Database Updates (Neon)**
- **round_players table:**
  - Sets `winning_team_id`, `winning_bid`, `status = 'sold'`
  
- **footballplayers table:**
  - Sets `is_sold = true`, `team_id`, `acquisition_value`, `status = 'active'`
  - Sets contract fields: `contract_id`, `contract_start_season`, `contract_end_season`, `contract_length`
  - Sets `season_id`, `round_id`, `updated_at`
  
- **team_players table:**
  - Checks for existing entry first
  - Updates if exists, inserts if new
  - Sets `team_id`, `player_id`, `season_id`, `round_id`, `purchase_price`, `acquired_at`
  
- **bulk_tiebreakers table:**
  - Sets `status = 'resolved'`, `resolved_at`, `updated_at`
  
- **tiebreakers table:**
  - Sets `status = 'resolved'`, `winning_team_id`, `winning_bid`, `updated_at`
  
- **teams table:**
  - Increments `football_spent` by winning amount
  - Decrements `football_budget` by winning amount
  - Increments `football_players_count` by 1
  - Only if new assignment (checks `team_players` first)
  
- **rounds table:**
  - Sets `status = 'completed'` if all tiebreakers resolved

#### 3. **Firebase Updates**
- **team_seasons document:**
  - Decrements `football_budget` by winning amount
  - Increments `football_spent` by winning amount
  - Updates `position_counts` for player's position
  - Increments `players_count`
  - Sets `updated_at`
  - Only if new assignment

#### 4. **Transaction Logging** ✅
- Calls `logAuctionWin()` with:
  - `firebase_uid` (from teams table)
  - `season_id`
  - `player_name`
  - `player_id`
  - `'football'` type
  - `winning_amount`
  - `current_budget`
  - `round_id`

#### 5. **Real-time Broadcasting** ❌ MISSING
- Does NOT call `broadcastSquadUpdate()`
- Does NOT call `broadcastWalletUpdate()`
- Does NOT call `broadcastRoundUpdate()`

#### 6. **News Generation** ✅
- Triggers `'last_person_standing'` news type
- Includes winner details, context

#### 7. **FCM Notifications** ❌ MISSING
- Does NOT send push notifications

---

## ISSUES FOUND

### 1. ❌ Missing Real-time Broadcasting in Tiebreaker Finalization
**Impact:** Teams don't get real-time updates when they win a tiebreaker
**Fix Needed:** Add `broadcastSquadUpdate()` and `broadcastWalletUpdate()` calls

### 2. ❌ Missing FCM Notifications in Tiebreaker Finalization
**Impact:** Teams don't get push notifications for tiebreaker wins
**Fix Needed:** Add `sendNotificationToSeason()` or individual team notification

### 3. ⚠️ Different Firebase Update Logic
**Bulk Round:** Handles both single and dual currency systems
**Tiebreaker:** Only handles dual currency system (assumes `football_budget` exists)
**Fix Needed:** Make tiebreaker finalization handle both currency systems

### 4. ❌ Missing `round_bids` Update in Tiebreaker
**Bulk Round:** Marks winning bid with `is_winning = true`
**Tiebreaker:** Does NOT update `round_bids` table
**Fix Needed:** Add `round_bids` update to mark winning bid

---

## RECOMMENDATIONS

### Priority 1: Add Missing Real-time Features to Tiebreaker Finalization
```typescript
// After successful assignment, add:
await broadcastSquadUpdate(seasonId, winnerTeamId, {
  player_id: playerId,
  player_name: playerName,
  action: 'acquired',
  price: winningAmount,
});

await broadcastWalletUpdate(seasonId, winnerTeamId, {
  new_balance: newFootballBudget,
  amount_spent: winningAmount,
  currency_type: 'football',
});
```

### Priority 2: Add FCM Notification
```typescript
await sendNotificationToSeason(
  {
    title: '🏆 Tiebreaker Won!',
    body: `${teamName} won ${playerName} for £${winningAmount}!`,
    url: `/dashboard/team/squad`,
    icon: '/logo.png',
    data: {
      type: 'tiebreaker_won',
      playerId,
      teamId: winnerTeamId,
      amount: winningAmount.toString()
    }
  },
  seasonId
);
```

### Priority 3: Handle Both Currency Systems
```typescript
const currencySystem = teamSeasonData?.currency_system || 'single';
const isDualCurrency = currencySystem === 'dual';

const updateData: any = {
  total_spent: (teamSeasonData?.total_spent || 0) + winningAmount,
  players_count: (teamSeasonData?.players_count || 0) + 1,
  position_counts: newPositionCounts,
  updated_at: new Date()
};

if (isDualCurrency) {
  updateData.football_budget = currentFootballBudget - winningAmount;
  updateData.football_spent = currentFootballSpent + winningAmount;
} else {
  updateData.budget = currentBudget - winningAmount;
}
```

### Priority 4: Mark Winning Bid in round_bids
```typescript
await sql`
  UPDATE round_bids
  SET is_winning = true
  WHERE round_id = ${roundId}
  AND player_id = ${playerId}
  AND team_id = ${winnerTeamId}
`;
```

---

## SUMMARY

Both finalization processes are mostly consistent, but tiebreaker finalization is missing:
1. Real-time broadcasting (squad and wallet updates)
2. FCM push notifications
3. Single currency system support
4. `round_bids` table update

All other operations (slot validation, database updates, transaction logging, news generation) are properly implemented in both.
