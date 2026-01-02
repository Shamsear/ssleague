# Multi-Season Contract Support - Implementation

**Date:** 2026-01-01 20:32  
**File:** `app/api/contracts/assign-bulk/route.ts`  
**Feature:** Support for mid-season contracts spanning multiple seasons

---

## 🎯 Problem Statement

When a player is assigned with a contract like **16.5 → 18.5** (mid-season 16 to mid-season 18), the system should:

1. **Season 16 (SSPSLS16)**: Update existing entry with contract 16.5 → 18.5
2. **Season 17 (SSPSLS17)**: Update existing entry with contract 16.5 → 18.5
3. **Season 18 (SSPSLS18)**: **Create NEW entry** (auto-registered) with contract 16.5 → 18.5

Previously, the system only handled the start and end seasons (16 and 18), missing season 17.

---

## ✅ Solution Implemented

### 1. **Helper Function: `getContractSeasons()`**

Added a helper function that calculates ALL seasons covered by a contract:

```typescript
function getContractSeasons(contractStart: string, contractEnd: string): string[] {
  const seasons: string[] = [];
  
  // Extract season numbers and check for mid-season (.5)
  const startMatch = contractStart.match(/^(.+?)(\d+)(\.5)?$/);
  const endMatch = contractEnd.match(/^(.+?)(\d+)(\.5)?$/);
  
  if (!startMatch || !endMatch) {
    console.warn(`Invalid season format: ${contractStart} -> ${contractEnd}`);
    return [contractStart, contractEnd];
  }
  
  const prefix = startMatch[1];
  const startNum = parseInt(startMatch[2]);
  const endNum = parseInt(endMatch[2]);
  
  // Generate all seasons in the range
  for (let i = startNum; i <= endNum; i++) {
    seasons.push(`${prefix}${i}`);
  }
  
  return seasons;
}
```

**Examples:**
- `SSPSLS16.5 → SSPSLS18.5` returns: `['SSPSLS16', 'SSPSLS17', 'SSPSLS18']`
- `SSPSLS16 → SSPSLS17` returns: `['SSPSLS16', 'SSPSLS17']`
- `SSPSLS16 → SSPSLS18` returns: `['SSPSLS16', 'SSPSLS17', 'SSPSLS18']`

### 2. **Updated Player Assignment Logic**

The player processing now:

1. **Uses individual player contracts** if provided, otherwise falls back to bulk contract
2. **Calculates all seasons** covered by the contract
3. **Loops through each season** and either updates existing or creates new entry

```typescript
// Use individual player's contract if provided
const playerContractStart = player.contractStartSeason || startSeason;
const playerContractEnd = player.contractEndSeason || endSeason;

// Get ALL seasons covered by this contract
const contractSeasons = getContractSeasons(playerContractStart, playerContractEnd);
console.log(`  Contract covers ${contractSeasons.length} seasons:`, contractSeasons);

// Update or create entry for EACH season in the contract
for (const seasonId of contractSeasons) {
  const seasonCompositeId = `${playerId}_${seasonId}`;
  
  // Check if season record exists
  const existing = await sql`
    SELECT id FROM player_seasons
    WHERE id = ${seasonCompositeId}
    LIMIT 1
  `;

  if (existing.length > 0) {
    // Update existing season entry
    await sql`UPDATE player_seasons SET ...`;
    console.log(`  ✅ Updated existing entry for season ${seasonId}`);
  } else {
    // Create new record for this season (auto-registration)
    await sql`INSERT INTO player_seasons ...`;
    console.log(`  ✅ Created new entry for season ${seasonId} (auto-registered)`);
  }
}
```

---

## 📊 Example Scenarios

### Scenario 1: Contract 16.5 → 18.5

**Input:**
- Player: John Doe
- Contract: SSPSLS16.5 → SSPSLS18.5

**Result:**
```
Processing player (Neon): John Doe, ID: 123, Contract: SSPSLS16.5 → SSPSLS18.5
  Contract covers 3 seasons: ['SSPSLS16', 'SSPSLS17', 'SSPSLS18']
  ✅ Updated existing entry for season SSPSLS16
  ✅ Updated existing entry for season SSPSLS17
  ✅ Created new entry for season SSPSLS18 (auto-registered)
```

**Database State:**
- `player_seasons` table has 3 entries:
  - `123_SSPSLS16`: contract_start=16.5, contract_end=18.5, contract_length=3
  - `123_SSPSLS17`: contract_start=16.5, contract_end=18.5, contract_length=3
  - `123_SSPSLS18`: contract_start=16.5, contract_end=18.5, contract_length=3, is_auto_registered=true

### Scenario 2: Contract 16 → 17

**Input:**
- Player: Jane Smith
- Contract: SSPSLS16 → SSPSLS17

**Result:**
```
Processing player (Neon): Jane Smith, ID: 456, Contract: SSPSLS16 → SSPSLS17
  Contract covers 2 seasons: ['SSPSLS16', 'SSPSLS17']
  ✅ Updated existing entry for season SSPSLS16
  ✅ Updated existing entry for season SSPSLS17
```

**Database State:**
- `player_seasons` table has 2 entries:
  - `456_SSPSLS16`: contract_start=16, contract_end=17, contract_length=2
  - `456_SSPSLS17`: contract_start=16, contract_end=17, contract_length=2

### Scenario 3: Contract 16.5 → 19.5 (3 full seasons)

**Input:**
- Player: Bob Johnson
- Contract: SSPSLS16.5 → SSPSLS19.5

**Result:**
```
Processing player (Neon): Bob Johnson, ID: 789, Contract: SSPSLS16.5 → SSPSLS19.5
  Contract covers 4 seasons: ['SSPSLS16', 'SSPSLS17', 'SSPSLS18', 'SSPSLS19']
  ✅ Updated existing entry for season SSPSLS16
  ✅ Updated existing entry for season SSPSLS17
  ✅ Created new entry for season SSPSLS18 (auto-registered)
  ✅ Created new entry for season SSPSLS19 (auto-registered)
```

---

## 🔍 Key Features

### 1. **Individual Player Contracts**
Each player can now have their own contract duration:
```typescript
const playerContractStart = player.contractStartSeason || startSeason;
const playerContractEnd = player.contractEndSeason || endSeason;
```

### 2. **Automatic Season Creation**
If a season doesn't exist in `player_seasons`, it's automatically created with:
- `is_auto_registered: true`
- Same star rating as current season
- Base points calculated from star rating
- All stats initialized to 0

### 3. **Contract Length Calculation**
The `contract_length` field now accurately reflects the number of seasons:
```typescript
contract_length = ${contractSeasons.length}
```

### 4. **Detailed Logging**
Console logs show exactly what's happening:
```
Processing player (Neon): John Doe, ID: 123, Contract: SSPSLS16.5 → SSPSLS18.5
  Contract covers 3 seasons: ['SSPSLS16', 'SSPSLS17', 'SSPSLS18']
  ✅ Updated existing entry for season SSPSLS16
  ✅ Updated existing entry for season SSPSLS17
  ✅ Created new entry for season SSPSLS18 (auto-registered)
```

---

## 🧪 Testing

### Test Case 1: Mid-Season to Mid-Season
```
Contract: 16.5 → 18.5
Expected Seasons: 16, 17, 18
Expected Behavior: Update 16, Update 17, Create 18
```

### Test Case 2: Full Season to Full Season
```
Contract: 16 → 18
Expected Seasons: 16, 17, 18
Expected Behavior: Update 16, Update 17, Create 18
```

### Test Case 3: Mid-Season to Full Season
```
Contract: 16.5 → 18
Expected Seasons: 16, 17, 18
Expected Behavior: Update 16, Update 17, Create 18
```

### Test Case 4: Single Season
```
Contract: 16 → 16
Expected Seasons: 16
Expected Behavior: Update 16
```

---

## 📝 Database Schema

Each `player_seasons` entry now contains:
```sql
{
  id: "123_SSPSLS16",
  season_id: "SSPSLS16",
  player_id: "123",
  team_id: "SSPSLT0001",
  contract_id: "contract_123_SSPSLS16.5_1735757556000",
  contract_start_season: "SSPSLS16.5",  -- Mid-season start
  contract_end_season: "SSPSLS18.5",    -- Mid-season end
  contract_length: 3,                    -- Covers 3 seasons
  is_auto_registered: true,              -- For seasons 18+
  status: "active",
  ...
}
```

---

## ✅ Benefits

1. **Complete Season Coverage**: All seasons in a contract are now properly tracked
2. **Accurate Contract Length**: `contract_length` reflects actual number of seasons
3. **Auto-Registration**: Future seasons are automatically created
4. **Flexible Contracts**: Supports any contract duration (1, 2, 3+ seasons)
5. **Mid-Season Support**: Properly handles .5 season notation
6. **Individual Contracts**: Each player can have different contract terms

---

## 🚀 Next Steps

1. **Test with real data**: Assign a player with 16.5 → 18.5 contract
2. **Verify database**: Check that all 3 season entries are created/updated
3. **Check UI**: Ensure player shows up in all relevant seasons
4. **Monitor logs**: Confirm console output shows all seasons being processed

---

**Status:** ✅ **COMPLETE**  
**Ready for Testing:** Yes  
**Breaking Changes:** None (backward compatible)
