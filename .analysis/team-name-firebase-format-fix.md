# Team Name Lookup Fix - Firebase Season ID Format

**Date:** 2026-01-01 20:38  
**Issue:** Team name lookup failing with "Unknown Team" error  
**Root Cause:** Firebase uses base season IDs without `.5` suffix

---

## 🐛 Problem

The team name lookup was failing with:
```
Could not fetch team name from Neon for SSPSLT0009: Error [NeonDbError]: relation "teams" does not exist
Team SSPSLT0009: Unknown Team
```

### Two Issues Found:

1. **Neon Fallback Failed**: Tried to query `teams` table which doesn't exist in Neon
2. **Firebase Lookup Failed**: Used `SSPSLT0009_SSPSLS16.5` but Firebase uses `SSPSLT0009_SSPSLS16`

---

## ✅ Solution

### 1. Removed Neon Fallback
Since the `teams` table doesn't exist in Neon database, removed that fallback entirely.

### 2. Strip `.5` for Firebase Lookups
Firebase `team_seasons` documents use base season IDs:
- ❌ `SSPSLT0009_SSPSLS16.5` (doesn't exist)
- ✅ `SSPSLT0009_SSPSLS16` (correct format)

```typescript
// Extract base season (remove .5 if present) for Firebase lookup
const basePlayerSeason = playerContractStart.replace('.5', '');
const baseStartSeason = startSeason.replace('.5', '');

// Try with player's contract season first (without .5)
let teamSeasonDocId = `${teamId}_${basePlayerSeason}`;
```

### 3. Added team_code Fallback
```typescript
teamName = teamData?.team_name || teamData?.username || teamData?.team_code || 'Unknown Team';
```

### 4. Better Error Logging
```typescript
console.warn(`⚠️  Could not find team_seasons document for team ${teamId} (tried: ${teamSeasonDocId})`);
```

---

## 📊 Example

### Before Fix
```
Contract: SSPSLS16.5 → SSPSLS18.5
Lookup: SSPSLT0009_SSPSLS16.5 ❌ Not found
Fallback to Neon: teams table ❌ Doesn't exist
Result: "Unknown Team" ❌
```

### After Fix
```
Contract: SSPSLS16.5 → SSPSLS18.5
Extract base: SSPSLS16.5 → SSPSLS16
Lookup: SSPSLT0009_SSPSLS16 ✅ Found
Result: "Team Name" ✅
```

---

## 🔍 Firebase Document Structure

Firebase `team_seasons` documents are structured as:
```
Collection: team_seasons
Document ID: {teamId}_{baseSeasonId}

Examples:
- SSPSLT0009_SSPSLS16 ✅
- SSPSLT0009_SSPSLS17 ✅
- SSPSLT0009_SSPSLS18 ✅

NOT:
- SSPSLT0009_SSPSLS16.5 ❌
- SSPSLT0009_SSPSLS17.5 ❌
```

---

## ✅ Result

Now when assigning a player with contract `16.5 → 18.5`:
```
Team SSPSLT0009: [Actual Team Name] ✅
Processing player (Neon): Rajish, ID: sspslpsl0059, Contract: SSPSLS16.5 → SSPSLS18.5
  Contract covers 3 seasons: [ 'SSPSLS16', 'SSPSLS17', 'SSPSLS18' ]
  ✅ Updated existing entry for season SSPSLS16
  ✅ Updated existing entry for season SSPSLS17
  ✅ Created new entry for season SSPSLS18 (auto-registered)
```

The team name will be correctly fetched and stored in all `player_seasons` entries.

---

**Status:** ✅ **FIXED**  
**Error:** Eliminated  
**Team Names:** Now correctly fetched from Firebase
