# Adding Player Linking Feature to Historical Import

## Problem
Players with name variations (like "Aashiq" vs "Ashiq" or "Abdul Rouf" vs "Abdulrouf") get created as duplicates because there's no way to manually link them to existing players during import preview.

## Current State
- ✅ Teams have a "Link To" dropdown to manually link to existing teams
- ❌ Players do NOT have this feature
- ✅ Fixed: Batch loading now loads all players for automatic matching
- ⚠️ Issue: Automatic matching only works for exact name matches

## Solution: Add Player Linking Dropdown

Similar to team linking, add a dropdown in the players table to manually link imported players to existing players.

---

## Implementation Steps

### Step 1: Update PlayerData Interface

**File**: `app/dashboard/superadmin/historical-seasons/preview/page.tsx` (line 29-51)

```typescript
interface PlayerData {
  name: string;
  team: string;
  category: string;
  goals_scored: number | null;
  // ... other fields ...
  
  // ADD THIS:
  linked_player_id?: string; // Optional: link to existing player
}
```

### Step 2: Add Auto-Linking Logic for Players

**File**: `app/dashboard/superadmin/historical-seasons/preview/page.tsx` (after line 196)

```typescript
// Auto-link players based on similar name matching
const autoLinkPlayers = useCallback((playersData: PlayerData[], existingPlayersData: ExistingEntities['players']) => {
  return playersData.map(player => {
    // Priority 1: Exact name match
    const exactNameMatch = existingPlayersData.find(
      ep => ep.name && player.name && ep.name.toLowerCase() === player.name.toLowerCase()
    );
    
    if (exactNameMatch) {
      console.log(`🔗 Auto-linked player "${player.name}" to existing player "${exactNameMatch.name}" (exact match)`);
      return { ...player, linked_player_id: exactNameMatch.player_id || exactNameMatch.id };
    }
    
    // Priority 2: Normalized name match (removes spaces, special chars)
    const normalizedMatch = existingPlayersData.find(ep => {
      if (!player.name || !ep.name) return false;
      const normalized1 = normalizePlayerName(player.name);
      const normalized2 = normalizePlayerName(ep.name);
      return normalized1 === normalized2 && normalized1.length > 0;
    });
    
    if (normalizedMatch) {
      console.log(`🔗 Auto-linked player "${player.name}" to existing player "${normalizedMatch.name}" (normalized match)`);
      return { ...player, linked_player_id: normalizedMatch.player_id || normalizedMatch.id };
    }
    
    // Priority 3: High similarity match (>90% for auto-linking)
    const similarNameMatch = existingPlayersData.find(ep => {
      if (!player.name || !ep.name) return false;
      const similarity = calculateSimilarity(player.name.toLowerCase(), ep.name.toLowerCase());
      return similarity > 0.9; // 90% threshold
    });
    
    if (similarNameMatch) {
      console.log(`🔗 Auto-linked player "${player.name}" to existing player "${similarNameMatch.name}" (similarity: ${(calculateSimilarity(player.name.toLowerCase(), similarNameMatch.name.toLowerCase()) * 100).toFixed(0)}%)`);
      return { ...player, linked_player_id: similarNameMatch.player_id || similarNameMatch.id };
    }
    
    console.log(`ℹ️  Player "${player.name}" not auto-linked - will create as new player unless manually linked`);
    return player; // No match, keep as new player
  });
}, []);

// Normalize player name by removing spaces and special characters
const normalizePlayerName = (name: string): string => {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '') // Remove all spaces
    .replace(/[^a-z0-9]/g, ''); // Remove special characters
};
```

### Step 3: Call Auto-Link in useEffect

**File**: `app/dashboard/superadmin/historical-seasons/preview/page.tsx` (line 345, after team auto-linking)

```typescript
// Auto-link teams based on existing data
const autoLinkedTeams = autoLinkTeams(teams, result.data.teams);
if (JSON.stringify(autoLinkedTeams) !== JSON.stringify(teams)) {
  setTeams(autoLinkedTeams);
  console.log('✅ Auto-linked teams based on owner/name matching');
  
  // Update player team names to match linked teams
  const updatedPlayers = syncPlayerTeamNames(players, teams, autoLinkedTeams, result.data.teams);
  if (JSON.stringify(updatedPlayers) !== JSON.stringify(players)) {
    setPlayers(updatedPlayers);
    console.log('✅ Updated player team names to match linked teams');
  }
}

// ADD THIS: Auto-link players based on existing data
const autoLinkedPlayers = autoLinkPlayers(players, result.data.players);
if (JSON.stringify(autoLinkedPlayers) !== JSON.stringify(players)) {
  setPlayers(autoLinkedPlayers);
  console.log('✅ Auto-linked players based on name matching');
}
```

### Step 4: Add handlePlayerChange Support for linked_player_id

**File**: `app/dashboard/superadmin/historical-seasons/preview/page.tsx` (line 410)

```typescript
const handlePlayerChange = useCallback((index: number, field: keyof PlayerData, value: any) => {
  setPlayers(prev => {
    const newPlayers = [...prev];
    (newPlayers[index] as any)[field] = value;
    return newPlayers;
  });
}, []);
```

This already supports any field, so no changes needed!

### Step 5: Add "Link To" Column in Players Table

**File**: `app/dashboard/superadmin/historical-seasons/preview/page.tsx` (line 1385-1410)

**Add column header after "Name":**

```typescript
<thead className=\"bg-white/10\">
  <tr>
    <th className=\"px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider\">Name</th>
    {/* ADD THIS: */}
    <th className=\"px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider\">Link To</th>
    <th className=\"px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider\">Team</th>
    <th className=\"px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider\">Category</th>
    {/* ... rest of columns ... */}
  </tr>
</thead>
```

**Add dropdown cell after player name (line ~1426):**

```typescript
<td className=\"px-4 py-3\">
  <input
    type=\"text\"
    value={player.name}
    onChange={(e) => handlePlayerChange(index, 'name', e.target.value)}
    className={`w-full bg-transparent border-none outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-2 py-1 ${
      validationErrors.has(`player-${index}-name`) ? 'border-red-500 bg-red-50' : ''
    }`}
    placeholder=\"Player name\"
  />
</td>

{/* ADD THIS: Player linking dropdown */}
<td className=\"px-4 py-3\">
  <select
    value={player.linked_player_id || ''}
    onChange={(e) => handlePlayerChange(index, 'linked_player_id', e.target.value)}
    className={`w-48 border outline-none focus:bg-white/50 focus:border focus:border-[#0066FF] rounded px-2 py-1 text-xs ${
      player.linked_player_id ? 'bg-blue-50 border-blue-300' : 'bg-transparent border-gray-300'
    }`}
  >
    <option value=\"\">➕ New Player</option>
    {existingEntities?.players && existingEntities.players.length > 0 && (
      <>
        {/* Suggested matches (similar names) */}
        {(() => {
          const suggested = existingEntities.players.filter(existingPlayer => {
            if (!existingPlayer.name || !player.name) return false;
            
            // Exact match
            if (existingPlayer.name.toLowerCase() === player.name.toLowerCase()) {
              return true;
            }
            
            // Normalized match (no spaces/special chars)
            const norm1 = normalizePlayerName(existingPlayer.name);
            const norm2 = normalizePlayerName(player.name);
            if (norm1 === norm2 && norm1.length > 0) {
              return true;
            }
            
            // Substring match (first 4 characters)
            const similarName = existingPlayer.name.toLowerCase().includes(player.name.toLowerCase().substring(0, 4)) ||
                               player.name.toLowerCase().includes(existingPlayer.name.toLowerCase().substring(0, 4));
            return similarName;
          });
          
          if (suggested.length > 0) {
            return (
              <>
                <optgroup label=\"🎯 Suggested Matches\">
                  {suggested.map(existingPlayer => (
                    <option 
                      key={existingPlayer.player_id || existingPlayer.id} 
                      value={existingPlayer.player_id || existingPlayer.id}
                    >
                      {existingPlayer.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label=\"📋 All Other Players\">
                  {existingEntities.players
                    .filter(p => !suggested.some(s => (s.player_id || s.id) === (p.player_id || p.id)))
                    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
                    .map(existingPlayer => (
                      <option 
                        key={existingPlayer.player_id || existingPlayer.id} 
                        value={existingPlayer.player_id || existingPlayer.id}
                      >
                        {existingPlayer.name}
                      </option>
                    ))}
                </optgroup>
              </>
            );
          } else {
            // No suggested matches, show all players
            return existingEntities.players
              .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
              .map(existingPlayer => (
                <option 
                  key={existingPlayer.player_id || existingPlayer.id} 
                  value={existingPlayer.player_id || existingPlayer.id}
                >
                  {existingPlayer.name}
                </option>
              ));
          }
        })()}
      </>
    )}
    {(!existingEntities?.players || existingEntities.players.length === 0) && (
      <option disabled>No existing players</option>
    )}
  </select>
  {player.linked_player_id && (
    <div className=\"text-xs text-green-600 mt-1 font-medium\">
      ✅ Linked • Change if needed
    </div>
  )}
</td>
```

### Step 6: Update Import API to Handle linked_player_id

The import API already handles player linking! Check the fix we just applied:

**File**: `app/api/seasons/historical/import/route.ts` (line 1271)

```typescript
// Get existing player by name or create new one (using batch lookup - no Firebase read!)
const { playerId, isNew: isNewPlayer, playerDoc } = getOrCreatePlayerByName(normalizedPlayerName, batchLookup);
```

**TO ADD manual linking support, update line 1271:**

```typescript
// Check if manually linked to existing player first
let playerId, isNewPlayer, playerDoc;

if (player.linked_player_id) {
  // Manual link - use the specified player ID
  const linkedPlayer = Array.from(batchLookup.existingPlayers.values())
    .find(p => p.playerId === player.linked_player_id);
  
  if (linkedPlayer) {
    playerId = linkedPlayer.playerId;
    isNewPlayer = false;
    playerDoc = linkedPlayer.doc;
    console.log(`🔗 Manually linked player: "${player.name}" → "${linkedPlayer.doc.name}" (${player.linked_player_id})`);
  } else {
    // Linked player not found, fall back to auto-match
    const result = getOrCreatePlayerByName(normalizedPlayerName, batchLookup);
    playerId = result.playerId;
    isNewPlayer = result.isNew;
    playerDoc = result.playerDoc;
  }
} else {
  // Auto-match by name
  const result = getOrCreatePlayerByName(normalizedPlayerName, batchLookup);
  playerId = result.playerId;
  isNewPlayer = result.isNew;
  playerDoc = result.playerDoc;
}
```

---

## Expected Behavior After Implementation

### Scenario 1: Exact Name Match (Auto-Linked)
```
Import: "Aashiq" 
Existing: "Aashiq" (sspslpsl0123)
Result: ✅ Auto-linked → Uses sspslpsl0123
```

### Scenario 2: Name Variation (Auto-Suggested)
```
Import: "Ashiq"
Existing: "Aashiq" (sspslpsl0123)
Result: 🎯 Shows in "Suggested Matches" dropdown → User selects → Uses sspslpsl0123
```

### Scenario 3: Normalized Match (Auto-Linked)
```
Import: "Abdul Rouf"
Existing: "Abdulrouf" (sspslpsl0124)
Result: ✅ Auto-linked (normalized match) → Uses sspslpsl0124
```

### Scenario 4: No Match (New Player)
```
Import: "John Doe"
Existing: No matches
Result: ➕ Creates new player → Generates sspslpsl0200
```

---

## Quick Alternative: Use Bulk Find & Replace

If you don't want to implement the full feature yet, use the existing **Bulk Find & Replace** feature:

1. Go to preview page
2. Click "🔄 Bulk Find & Replace" button
3. Enter variations:
   - Find: "Ashiq" → Replace: "Aashiq"
   - Find: "Abdulrouf" → Replace: "Abdul Rouf"
4. Apply changes
5. Import (will now match existing players)

This normalizes names before the automatic matching kicks in.

---

## Testing

1. **Create Test Data**:
   - Import Season 15 with player "Aashiq"
   - Import Season 16 with player "Ashiq" (different spelling)

2. **Test Auto-Linking**:
   - Should show "Ashiq" in "🎯 Suggested Matches" for "Aashiq"
   - Select it manually
   - Import
   - Verify logs show: `🔗 Manually linked player: "Ashiq" → "Aashiq"`

3. **Verify in Database**:
   - Check `/players` page
   - Should see ONE "Aashiq" with stats from both seasons
   - No duplicate "Ashiq" entry

---

## Files to Modify

1. ✅ `app/dashboard/superadmin/historical-seasons/preview/page.tsx`
   - Add `linked_player_id` to interface
   - Add `autoLinkPlayers()` function
   - Add "Link To" column in players table
   - Call auto-linking in useEffect

2. ✅ `app/api/seasons/historical/import/route.ts`
   - Add manual linking check before auto-match (line 1271)

---

## Benefits

1. **Automatic**: Most players auto-link based on exact/normalized name match
2. **Manual Override**: Can manually link variations (Ashiq → Aashiq)
3. **Smart Suggestions**: Dropdown shows likely matches first
4. **No Duplicates**: Prevents creating duplicate players for name variations
5. **Audit Trail**: Logs show which players were linked and how
