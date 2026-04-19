# Team Slots Page Fix - Player Count Display

Date: April 18, 2026

## 🐛 ISSUE

The committee team-slots page (`/dashboard/committee/team-slots`) was not showing current player counts correctly. It was reading from Firebase `team_seasons.football_players_count` which was not updated.

## 🔍 ROOT CAUSE

The page was fetching player counts from Firebase:
```typescript
const currentPlayers = tsData.football_players_count || 0  // ❌ Firebase (outdated)
```

But we updated the counts in Neon database:
```sql
UPDATE teams SET football_players_count = ...  -- ✅ Neon (accurate)
```

## ✅ SOLUTION

### 1. Created API Endpoint

**File**: `app/api/committee/team-slots/route.ts`

New endpoint that fetches team data from Neon database:
```typescript
POST /api/committee/team-slots
{
  "season_id": "SSPSLS17"
}

Response:
{
  "success": true,
  "teams": [
    {
      "id": "team-id",
      "name": "Team Name",
      "football_players_count": 24,  // From Neon
      "football_base_slots": 25,
      "football_purchased_slots": 0,
      "football_total_slots": 25
    }
  ]
}
```

### 2. Updated Team Slots Page

**File**: `app/dashboard/committee/team-slots/page.tsx`

Changed to fetch player counts from Neon via API:
```typescript
// Fetch current player counts from Neon database
const response = await fetchWithTokenRefresh('/api/committee/team-slots', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ season_id: seasonId })
})

const neonData = response.ok ? await response.json() : { teams: [] }
const neonTeamsMap = new Map(neonData.teams?.map((t: any) => [t.id, t.football_players_count]) || [])

// Get current player count from Neon (source of truth)
const currentPlayers = neonTeamsMap.get(teamId) || 0
```

## 📊 DATA FLOW

### Before (Broken)
```
Team Slots Page
    ↓
Firebase team_seasons.football_players_count (outdated/missing)
    ↓
Shows 0 players ❌
```

### After (Fixed)
```
Team Slots Page
    ↓
API: /api/committee/team-slots
    ↓
Neon teams.football_players_count (accurate)
    ↓
Shows actual player count ✅
```

## 🎯 BENEFITS

1. **Accurate Data**: Shows real-time player counts from Neon
2. **Single Source of Truth**: Neon database is authoritative for player counts
3. **No Sync Issues**: No need to keep Firebase in sync
4. **Better Performance**: Single API call fetches all team data

## 🔄 WHAT NOW DISPLAYS

The team-slots page will now correctly show:
- **Current Players**: Actual count from Neon (22-25 for SSPSLS17 teams)
- **Base Slots**: 25 (default)
- **Purchased Slots**: 0 (default, can be modified)
- **Total Slots**: 25 (base + purchased)
- **Available Slots**: Calculated correctly (total - current)

## 📝 EXAMPLE OUTPUT

```
Team Name          | Current | Base | Purchased | Total | Available
-------------------|---------|------|-----------|-------|----------
Blue Strikers      |   22    |  25  |     0     |  25   |    3
FC Barcelona       |   24    |  25  |     0     |  25   |    1
Legends FC         |   25    |  25  |     0     |  25   |    0
Manchester United  |   23    |  25  |     0     |  25   |    2
```

## ✅ VERIFICATION

To verify the fix:
1. Navigate to `/dashboard/committee/team-slots`
2. Check that "Current Players" column shows actual counts (not 0)
3. Verify "Available Slots" is calculated correctly
4. Try adding/removing slots - should work with accurate counts

## 🚀 STATUS

**Fixed**: ✅ COMPLETE

The team-slots page now fetches accurate player counts from the Neon database.

---

## 📚 Related Files

- `app/dashboard/committee/team-slots/page.tsx` - Updated to use API
- `app/api/committee/team-slots/route.ts` - New API endpoint
- `scripts/update-football-players-count.js` - Script that updated Neon counts
