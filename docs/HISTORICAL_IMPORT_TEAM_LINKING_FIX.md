# Historical Import Team Linking Fix

## Problem
The historical import feature allows mapping imported teams to existing teams in the database (via `linked_team_id` dropdown in the preview page). However, this feature was broken because the batch loading functions were not loading the full team data needed for linking.

## Root Cause
In the import API route (`/api/seasons/historical/import/route.ts`), there are two batch loading functions:

1. **`batchLoadForReimport()`** - Used when re-importing existing data
2. **`batchLoadExistingEntities()`** - Used for new imports

### Issue 1: batchLoadForReimport()
This function was only loading team IDs (for the counter) using `select()` which returns minimal data:

```typescript
// BEFORE (broken)
queries.push(
  adminDb.collection('teams')
    .select() // Only returns document IDs!
    .get()
);
```

When processing, it only stored IDs:
```typescript
// BEFORE (broken)
teamIdsSnapshot.forEach((doc: any) => {
  result.allTeamIds.push(doc.id);
  // No team data stored!
});
```

### Issue 2: batchLoadExistingEntities()
This function loaded specific teams by name for matching, but when loading ALL teams for the counter, it also used `select()` without storing the data.

## The Fix

### Fix 1: batchLoadForReimport()
Load FULL team data and store it in the `existingTeams` Map:

```typescript
// AFTER (fixed)
// 2. Get ALL teams with full data (needed for linking)
console.log('   Loading all teams (full data for linking)...');
queries.push(
  adminDb.collection('teams')
    .get() // Get full documents
);

// Process teams - store full data for linking
const teamsSnapshot = results[resultIndex++];
teamsSnapshot.forEach((doc: any) => {
  result.allTeamIds.push(doc.id);
  const data = doc.data();
  // Store by team_name for lookup
  result.existingTeams.set(data.team_name?.toLowerCase() || '', {
    teamId: doc.id,
    doc: data
  });
});
```

### Fix 2: batchLoadExistingEntities()
When loading all teams for the counter, also store their data:

```typescript
// AFTER (fixed)
// 4. Get ALL teams for linking and counter (need full data for team linking)
queries.push(
  adminDb.collection('teams')
    .get() // Get full documents
);

// Process ALL teams (for counter and linking) - merge with existing teams
const allTeamsSnapshot = results[resultIndex++];
allTeamsSnapshot.forEach((doc: any) => {
  const data = doc.data();
  result.allTeamIds.push(doc.id);
  
  // Also add to existingTeams map if not already there (for linking by ID)
  const teamName = data.team_name?.toLowerCase();
  if (teamName && !result.existingTeams.has(teamName)) {
    result.existingTeams.set(teamName, {
      teamId: doc.id,
      doc: data
    });
  }
});
```

## How Team Linking Works

### In the Preview UI
The preview page (`/dashboard/superadmin/historical-seasons/preview`) shows a dropdown for each team:

```tsx
<select
  value={team.linked_team_id || ''}
  onChange={(e) => handleTeamChange(index, 'linked_team_id', e.target.value)}
>
  <option value="">➕ New Team</option>
  {/* Suggested matches based on owner or name similarity */}
  <optgroup label="🎯 Suggested Matches">
    {suggested.map(existingTeam => (
      <option key={existingTeam.teamId} value={existingTeam.teamId}>
        {existingTeam.name} ({existingTeam.owner_name || 'No owner'})
      </option>
    ))}
  </optgroup>
  {/* All other teams */}
  <optgroup label="📋 All Other Teams">
    {/* ... */}
  </optgroup>
</select>
```

### In the Import Logic
When importing (lines 614-628):

```typescript
// Check if manually linked to existing team
let existingTeam = null;
if (team.linked_team_id) {
  // Find the linked team in batch lookup
  const linkedTeam = Array.from(batchLookup.existingTeams.values())
    .find(t => t.teamId === team.linked_team_id);
  
  if (linkedTeam) {
    existingTeam = linkedTeam;
    console.log(`🔗 Manually linked team: "${team.team_name}" → "${existingTeam.doc.team_name}" (${team.linked_team_id})`);
  }
}

if (existingTeam) {
  // Use existing team ID, update seasons, track name changes
  teamId = existingTeam.teamId;
  // ... update logic
}
```

## Benefits of Team Linking

1. **Maintains Continuity**: Same team across multiple historical seasons
2. **Preserves Identity**: Team ID remains constant even if name changes
3. **Tracks History**: Name changes are stored in `name_history` array
4. **Season Tracking**: `seasons` array shows all seasons team participated in
5. **Statistics Aggregation**: Can aggregate stats across all seasons for a team

## Example Use Case

Importing Season 1 data where "Real Madrid FC" played:
- User links imported "Real Madrid FC" to existing team "Real Madrid" (SSPSLT0001)
- Import creates season stats under team ID SSPSLT0001
- Team's `seasons` array is updated: `['S001', 'S002']`
- If name differs, old name added to `name_history`

## Testing
To verify the fix works:
1. Go to `/dashboard/superadmin/historical-seasons/import`
2. Upload historical data Excel file
3. Preview the data
4. For any team, select an existing team from the "Link To" dropdown
5. Verify it shows ✅ Linked
6. Complete the import
7. Check that the team was updated (not created as new)
8. Verify stats are created for the correct team ID

## Files Modified
- `app/api/seasons/historical/import/route.ts`
  - Fixed `batchLoadForReimport()` function (lines 272-320)
  - Fixed `batchLoadExistingEntities()` function (lines 424-510)
