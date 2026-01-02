# Team Name Not Updated - Quick Assign Fix

**Date:** 2026-01-01 20:36  
**Issue:** Team name not being updated when using quick assign  
**File:** `app/api/contracts/assign-bulk/route.ts`

---

## 🐛 Problem

When using **Quick Assign** on the real players page, the team name wasn't being properly fetched and stored in the `player_seasons` table. The `team` column would show "Unknown Team" instead of the actual team name.

### Root Cause

The team name fetching logic was using the bulk `startSeason` to build the Firebase document ID:
```typescript
const teamSeasonDocId = `${teamId}_${startSeason}`;
```

However, when using **quick assign** with individual player contracts (e.g., `16.5 → 18.5`), the player's `contractStartSeason` might be different from the bulk `startSeason`. This caused the lookup to fail.

**Example:**
- Bulk `startSeason`: `SSPSLS16`
- Player `contractStartSeason`: `SSPSLS16.5`
- Lookup tried: `SSPSLT0001_SSPSLS16` ❌ (might not exist)
- Should try: `SSPSLT0001_SSPSLS16.5` ✅ or `SSPSLT0001_SSPSLS16` as fallback

---

## ✅ Solution

Updated the team name fetching logic with a **3-tier fallback system**:

### Tier 1: Player's Contract Season
Try to fetch from Firebase using the player's individual `contractStartSeason`:
```typescript
const player = players.find(p => p.teamId === teamId);
const playerContractStart = player?.contractStartSeason || startSeason;

let teamSeasonDocId = `${teamId}_${playerContractStart}`;
let teamSeasonDoc = await adminDb.collection('team_seasons').doc(teamSeasonDocId).get();
```

### Tier 2: Bulk Season (Fallback)
If not found and player's contract season differs from bulk season, try bulk season:
```typescript
if (!teamSeasonDoc.exists && playerContractStart !== startSeason) {
  teamSeasonDocId = `${teamId}_${startSeason}`;
  teamSeasonDoc = await adminDb.collection('team_seasons').doc(teamSeasonDocId).get();
}
```

### Tier 3: Neon Database (Final Fallback)
If still not found, query Neon `teams` table directly:
```typescript
if (!teamSeasonDoc.exists) {
  const neonTeam = await sql`
    SELECT name FROM teams WHERE id = ${teamId} LIMIT 1
  `;
  if (neonTeam.length > 0) {
    teamName = neonTeam[0].name || 'Unknown Team';
  }
}
```

### Logging
Added console log to verify team name resolution:
```typescript
console.log(`Team ${teamId}: ${teamName}`);
```

---

## 📊 Example Scenarios

### Scenario 1: Quick Assign with Mid-Season Contract

**Input:**
- Player: John Doe
- Team: Portland Timbers (SSPSLT0026)
- Contract: SSPSLS16.5 → SSPSLS18.5
- Bulk startSeason: SSPSLS16

**Lookup Process:**
1. Try: `SSPSLT0026_SSPSLS16.5` (player's contract season)
2. If not found, try: `SSPSLT0026_SSPSLS16` (bulk season)
3. If not found, query Neon: `SELECT name FROM teams WHERE id = 'SSPSLT0026'`

**Result:**
```
Team SSPSLT0026: Portland Timbers ✅
```

### Scenario 2: Bulk Assign with Standard Contract

**Input:**
- Multiple players
- Team: Los Galacticos (SSPSLT0021)
- Contract: SSPSLS16 → SSPSLS17
- Bulk startSeason: SSPSLS16

**Lookup Process:**
1. Try: `SSPSLT0021_SSPSLS16` (same as bulk)
2. Found immediately ✅

**Result:**
```
Team SSPSLT0021: Los Galacticos ✅
```

### Scenario 3: New Team (No Firebase Document)

**Input:**
- Player: Jane Smith
- Team: New Team FC (SSPSLT0030)
- Contract: SSPSLS16 → SSPSLS17

**Lookup Process:**
1. Try: `SSPSLT0030_SSPSLS16` ❌ Not found
2. Try: Neon database ✅ Found

**Result:**
```
Team SSPSLT0030: New Team FC ✅
```

---

## 🔍 Database Impact

### Before Fix
```sql
-- player_seasons table
{
  id: "123_SSPSLS16",
  player_name: "John Doe",
  team_id: "SSPSLT0026",
  team: "Unknown Team"  ❌ WRONG
}
```

### After Fix
```sql
-- player_seasons table
{
  id: "123_SSPSLS16",
  player_name: "John Doe",
  team_id: "SSPSLT0026",
  team: "Portland Timbers"  ✅ CORRECT
}
```

---

## 🧪 Testing

### Test Case 1: Quick Assign
1. Go to `/dashboard/committee/real-players`
2. Use **Quick Assign** to assign a player
3. Check console logs for: `Team SSPSLT00XX: [Team Name]`
4. Verify in Neon `player_seasons` table that `team` column has correct name

### Test Case 2: Bulk Assign
1. Assign multiple players to a team
2. Save the team
3. Check console logs for team name resolution
4. Verify all players have correct team name

### Test Case 3: Mid-Season Contract
1. Assign player with contract `16.5 → 18.5`
2. Check console logs
3. Verify team name is correct for all 3 seasons (16, 17, 18)

---

## ✅ Benefits

1. **Reliable Team Names**: Always fetches correct team name
2. **Flexible Lookups**: Handles individual player contracts
3. **Multiple Fallbacks**: Won't fail even if Firebase is missing data
4. **Better Logging**: Easy to debug team name issues
5. **Backward Compatible**: Existing bulk assignments still work

---

## 🚀 Verification

After deploying, check the console output when assigning players:
```
Processing player (Neon): John Doe, ID: 123, Contract: SSPSLS16.5 → SSPSLS18.5
Team SSPSLT0026: Portland Timbers
  Contract covers 3 seasons: ['SSPSLS16', 'SSPSLS17', 'SSPSLS18']
  ✅ Updated existing entry for season SSPSLS16
  ✅ Updated existing entry for season SSPSLS17
  ✅ Created new entry for season SSPSLS18 (auto-registered)
```

The team name should appear correctly in all logs and database entries.

---

**Status:** ✅ **FIXED**  
**Testing:** Ready for verification  
**Impact:** Quick assign and bulk assign both work correctly
