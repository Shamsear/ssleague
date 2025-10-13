# Season ID Implementation in realplayerstats Collection

## Overview
The `realplayerstats` collection stores season-specific statistics for each player. Each document MUST include a `season_id` field to properly identify which season the stats belong to.

## Implementation Status: ✅ COMPLETE

All historical season creation and update endpoints properly save `season_id` to the `realplayerstats` collection.

---

## Import Routes

### 1. Individual Season Import Route
**File:** `app/api/seasons/historical/[id]/import/route.ts`

**Line 324:** When creating/updating season-specific stats:
```typescript
const statsData: any = {
  player_id: playerId,
  player_name: row.name || currentPlayerData?.name || '',
  season_id: seasonId,  // ✅ Correctly saved
  category: row.category || '',
  team: row.team || row.team_name || '',
  team_id: row.team_id || null,
  // ... other fields
};
```

**Query to prevent duplicates (Lines 303-307):**
```typescript
const existingStatsQuery = await adminDb.collection('realplayerstats')
  .where('player_id', '==', playerId)
  .where('season_id', '==', seasonId)  // ✅ Uses season_id to find existing records
  .limit(1)
  .get();
```

---

### 2. Batch Season Import Route
**File:** `app/api/seasons/historical/import/route.ts`

**Line 479:** When creating/updating season-specific stats:
```typescript
const statsDoc = {
  player_id: playerId,
  player_name: player.name,
  season_id: seasonId,  // ✅ Correctly saved
  team: player.team,
  team_id: teamMap.get(player.team) || null,
  category: player.category,
  stats: newStats,
  // ... other fields
};
```

**Query to prevent duplicates (Lines 461-465):**
```typescript
const existingStatsQuery = await adminDb.collection('realplayerstats')
  .where('player_id', '==', playerId)
  .where('season_id', '==', seasonId)  // ✅ Uses season_id to find existing records
  .limit(1)
  .get();
```

---

## Frontend Usage

### Player Detail Page
**File:** `app/dashboard/players/[id]/page.tsx`

**Data Fetching (Lines 127-136):**
```typescript
// Fetch all season stats from realplayerstats collection
const statsRef = collection(db, 'realplayerstats');
const statsQuery = query(statsRef, where('player_id', '==', playerId));
const statsSnapshot = await getDocs(statsQuery);
```

**Data Mapping (Lines 157-166):**
```typescript
return {
  id: statsDoc.id,
  ...permanentPlayerData,
  season_id: statsData.season_id,  // ✅ Retrieved from document
  season_name: seasonName,
  team: statsData.team,
  team_id: statsData.team_id,
  category: statsData.category,
  stats: statsData.stats
} as PlayerData;
```

**Season Tab Identification (Line 430):**
```typescript
// Use season_id (not document id) as the unique identifier
const seasonId = seasonData.season_id || seasonData.id;
const isSelected = selectedView === 'season' && selectedSeasonId === seasonId;
```

---

## Database Structure

### realplayerstats Collection
Each document contains:

```typescript
{
  // Firestore Document ID (auto-generated)
  
  // Core identifiers
  player_id: string,        // Links to realplayers collection
  player_name: string,      // Denormalized for easier queries
  season_id: string,        // ✅ Links to seasons collection
  
  // Season-specific data
  team: string,
  team_id: string,
  category: string,
  
  // Flattened stats (for queries)
  matches_played: number,
  matches_won: number,
  goals_scored: number,
  // ... other stat fields
  
  // Nested stats (backward compatibility)
  stats: {
    matches_played: number,
    matches_won: number,
    // ... all stats nested
  },
  
  // Timestamps
  created_at: Timestamp,
  updated_at: Timestamp
}
```

---

## Composite Index

**File:** `firestore.indexes.json`

Required composite index for efficient queries:
```json
{
  "collectionGroup": "realplayerstats",
  "queryScope": "COLLECTION",
  "fields": [
    {
      "fieldPath": "player_id",
      "order": "ASCENDING"
    },
    {
      "fieldPath": "season_id",
      "order": "ASCENDING"
    }
  ]
}
```

---

## Data Integrity

### Preventing Duplicates
Both import routes use a query to check for existing records:
```typescript
const existingStatsQuery = await adminDb.collection('realplayerstats')
  .where('player_id', '==', playerId)
  .where('season_id', '==', seasonId)
  .limit(1)
  .get();
```

This ensures:
- ✅ Only one document per player-season combination
- ✅ Updates existing documents instead of creating duplicates
- ✅ Proper data integrity across imports

### Maintenance Script
**File:** `scripts/fix-missing-season-ids.js`

A maintenance script exists to:
- Detect documents missing `season_id`
- Attempt to infer the correct `season_id`
- Update documents with the correct value

**Usage:**
```bash
# Dry run (preview changes)
node scripts/fix-missing-season-ids.js --dry-run

# Apply fixes
node scripts/fix-missing-season-ids.js
```

---

## Verification

### Check Current Data
All 188 documents in the `realplayerstats` collection currently have `season_id` properly set (verified via script).

### Query Examples

**Get all stats for a specific player:**
```typescript
const statsQuery = query(
  collection(db, 'realplayerstats'),
  where('player_id', '==', playerId)
);
```

**Get stats for a specific player in a specific season:**
```typescript
const statsQuery = query(
  collection(db, 'realplayerstats'),
  where('player_id', '==', playerId),
  where('season_id', '==', seasonId)
);
```

**Get all players in a specific season:**
```typescript
const statsQuery = query(
  collection(db, 'realplayerstats'),
  where('season_id', '==', seasonId)
);
```

---

## Summary

✅ **All historical season creation and update operations correctly save `season_id`**
- Individual season import route: Line 324
- Batch season import route: Line 479
- Both routes include duplicate prevention logic
- Frontend correctly retrieves and uses `season_id`
- Composite index supports efficient queries
- Maintenance script available if needed

The implementation is complete and functioning correctly.
