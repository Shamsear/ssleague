# Player Release Auction Eligibility Fix

## Problem

When a player was released to free agency, they were NOT marked as auction-eligible, preventing them from appearing in future auction rounds.

### Before Fix

```sql
UPDATE footballplayers
SET team_id = NULL,
    status = 'free_agent',
    contract_id = NULL,
    updated_at = NOW()
WHERE player_id = ${playerId} AND season_id = ${seasonId}
```

**Result:** Player becomes free agent but:
- ❌ `is_sold` remains `true` (still marked as sold)
- ❌ `is_auction_eligible` remains unchanged
- ❌ **Player CANNOT appear in future auctions**

---

## Solution

### After Fix

```sql
UPDATE footballplayers
SET team_id = NULL,
    status = 'free_agent',
    contract_id = NULL,
    is_sold = false,              -- ✅ ADDED
    is_auction_eligible = true,   -- ✅ ADDED
    updated_at = NOW()
WHERE player_id = ${playerId} AND season_id = ${seasonId}
```

**Result:** Player becomes free agent and:
- ✅ `is_sold = false` (no longer sold)
- ✅ `is_auction_eligible = true` (eligible for auction)
- ✅ **Player WILL appear in future auctions**

---

## Auction Round Query

Bulk rounds fetch eligible players using:

```sql
SELECT * FROM footballplayers
WHERE season_id = ${seasonId}
AND is_auction_eligible = true  -- ← Checks this
AND is_sold = false             -- ← And this
```

Released players will now match both conditions!

---

## Complete Flow

### Mid-Season Scenario

1. **Season Start**
   - Create Auction Round 1-10
   - Teams buy players
   - Players marked: `is_sold = true`, `is_auction_eligible = false`

2. **Mid-Season** (e.g., after Round 10)
   - Team releases underperforming Player X
   - Player X updated:
     - `team_id = NULL`
     - `status = 'free_agent'`
     - `is_sold = false` ← **KEY**
     - `is_auction_eligible = true` ← **KEY**
   - Team receives 70% refund

3. **Create Round 11** (Mid-Season Auction)
   - Bulk round creation queries eligible players
   - **Player X appears!** (because `is_sold = false` AND `is_auction_eligible = true`)
   - Other teams can bid on Player X

4. **Round 11 Finalization**
   - Player X sold to new team
   - Updated: `is_sold = true`, `team_id = <new_team>`

---

## Other Transfer Operations

### Transfer (Team A → Team B)
```sql
UPDATE footballplayers
SET team_id = ${newTeamId},
    status = 'active',  -- ← Stays active (sold)
    ...
```
- ✅ `is_sold` remains `true` (still sold)
- ✅ NOT auction-eligible (correct behavior)

### Swap (Player A ↔ Player B)
```sql
-- Both players remain with status = 'active'
```
- ✅ Both `is_sold` remain `true` (still sold)
- ✅ NOT auction-eligible (correct behavior)

---

## Testing Checklist

- [ ] Release a player via `/dashboard/committee/players/transfers`
- [ ] Verify player has `is_sold = false` in database
- [ ] Verify player has `is_auction_eligible = true` in database
- [ ] Create new bulk round
- [ ] Verify released player appears in the round
- [ ] Team can bid on released player
- [ ] Player gets assigned to new team after finalization

---

## Files Changed

- ✅ `lib/player-transfers-neon.ts` (lines 186-196)
  - Added `is_sold = false`
  - Added `is_auction_eligible = true`

---

## Related Features

| Feature | Auction Eligible? | Notes |
|---------|-------------------|-------|
| **Released Player** | ✅ YES | Can be re-auctioned |
| **Transferred Player** | ❌ NO | Stays with new team |
| **Swapped Player** | ❌ NO | Stays with new team |
| **Never Sold Player** | ✅ YES | Available from start |

---

## API Endpoints

- `POST /api/players/release` - Release player (now makes auction-eligible)
- `POST /api/players/transfer` - Transfer player (NOT auction-eligible)
- `POST /api/players/swap` - Swap players (NOT auction-eligible)
- `POST /api/admin/bulk-rounds` - Create bulk round (includes released players)

---

## UI Access

**Committee Admin:**
- Dashboard → "Player Transfers" card
- Path: `/dashboard/committee/players/transfers`
- Tabs: Release | Transfer | Swap
