# Committee Team Page Issues

## Issues Identified

### Issue 1: Transfer Summary Shows "Limit Reached" for Everyone ❌

**Location:** `app/dashboard/committee/teams/[id]/page.tsx`
**Component:** `TeamTransferSummary`

**Problem:**
The transfer summary component is correctly showing the transfer limit status from the API. This is NOT a bug - it's showing that teams have used their 2 transfer slots.

**Status:** ✅ **This is correct behavior**

The component shows:
- "Limit Reached" when `transfersUsed >= 2`
- "X Remaining" when `transfersUsed < 2`

If all teams show "Limit Reached", it means they've all used their 2 transfer slots for the season.

**To verify:** Check the `/api/players/transfer-limits` API response for specific teams.

---

### Issue 2: Football Players Not Fetched ❌

**Location:** `app/dashboard/committee/teams/[id]/page.tsx`
**API Used:** `/api/team/[teamId]?season_id=X`

**Problem:**
The committee team detail page uses `/api/team/[teamId]` which fetches football players from **Firebase** `footballplayers` collection. However, the new implementation stores football players in **Neon database** (`team_players` + `footballplayers` tables).

**Current Flow:**
```
Committee Page → /api/team/[teamId] → Firebase footballplayers ❌
```

**Expected Flow:**
```
Committee Page → /api/teams/[id]/football-players → Neon team_players ✅
```

## Solutions

### Solution for Issue 1: Transfer Summary
**No action needed** - This is working as designed. The component correctly displays:
- Transfer slots used (X of 2)
- Remaining slots
- "Limit Reached" badge when appropriate
- Financial impact
- Transaction history

### Solution for Issue 2: Football Players

**Option A: Update the existing API** (Recommended)
Update `/api/team/[teamId]/route.ts` to fetch football players from Neon instead of Firebase.

**Option B: Add separate fetch in committee page**
Add a separate API call to `/api/teams/[id]/football-players` in the committee page.

**Option C: Create new combined API**
Create a new API endpoint specifically for committee that fetches from both sources.

## Recommended Implementation

### Update `/api/team/[teamId]/route.ts`

Replace the Firebase football players fetch:

**Current (Firebase):**
```typescript
const footballPlayersSnapshot = await adminDb
  .collection('footballplayers')
  .where('season_id', '==', seasonId)
  .where('team_id', '==', teamId)
  .get();
```

**New (Neon):**
```typescript
import { neon } from '@neondatabase/serverless';
const auctionSql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);

const footballPlayersData = await auctionSql`
  SELECT 
    tp.player_id,
    tp.purchase_price,
    fp.name,
    fp.position,
    fp.overall_rating,
    fp.team_name as club
  FROM team_players tp
  INNER JOIN footballplayers fp ON tp.player_id = fp.id
  WHERE tp.team_id = ${teamId}
    AND tp.season_id = ${seasonId}
`;

const footballPlayers = footballPlayersData.map(player => ({
  id: player.player_id,
  name: player.name || 'Unknown',
  position: player.position || 'Unknown',
  rating: player.overall_rating || 0,
  value: player.purchase_price,
  is_real_player: false,
}));
```

## Testing Checklist

After implementing the fix:

- [ ] Committee team page loads without errors
- [ ] Football players are displayed in the players list
- [ ] Player count shows correct total (real + football)
- [ ] Filter buttons work (All, Real, Football)
- [ ] Football players show correct data (name, position, rating)
- [ ] Transfer summary still works correctly
- [ ] No duplicate players
- [ ] Performance is acceptable

## Database Schema Reference

### Neon Auction DB

**team_players table:**
- `id` - Serial primary key
- `team_id` - Team identifier
- `player_id` - Football player ID (references footballplayers.id)
- `season_id` - Season identifier
- `purchase_price` - Amount paid
- `acquired_at` - Timestamp

**footballplayers table:**
- `id` - VARCHAR primary key
- `player_id` - Unique player identifier
- `name` - Player name
- `position` - Position code
- `overall_rating` - Rating (0-99)
- `team_id` - Current team (may be outdated)
- `season_id` - Season

### Firebase (Legacy)

**footballplayers collection:**
- Used in old implementation
- Should NOT be used for new features
- May contain outdated data

## Migration Notes

1. **Backward Compatibility:** The fix maintains compatibility with existing code
2. **Data Source:** All football player data now comes from Neon (single source of truth)
3. **Performance:** Neon queries are faster than Firebase for this use case
4. **Consistency:** Ensures committee and public pages show same data

## Related Files

- `app/dashboard/committee/teams/[id]/page.tsx` - Committee team detail page
- `app/api/team/[teamId]/route.ts` - Team API (needs update)
- `app/api/teams/[id]/football-players/route.ts` - New football players API
- `components/TeamTransferSummary.tsx` - Transfer summary component (working correctly)
