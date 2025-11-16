# Team Name Resolver System

## Problem

Teams imported from historical seasons (S15 → S1) show **old names** instead of **current names**. This happens because each `team_seasons` document in Firebase stores the team name from that specific season.

**Example:**
- S15: Team was "Warriors"
- S10: Team was "Knights"  
- Current (S16): Team is "Warriors FC"

When viewing S15 data, it shows "Warriors" instead of the current "Warriors FC".

## Solution

The Team Name Resolver system fetches current team names from the Neon database while preserving historical data in Firebase. It includes caching to minimize database queries.

---

## 🎯 Usage Guide

### 1. Server-Side (API Routes, Server Components)

Use the utility functions directly:

```typescript
import { getCurrentTeamName, getCurrentTeamNames, resolveTeamNames } from '@/lib/team-name-resolver';

// Single team name
const teamName = await getCurrentTeamName(firebaseUid);
console.log(teamName); // "Warriors FC"

// Multiple team names (more efficient)
const names = await getCurrentTeamNames([uid1, uid2, uid3]);
console.log(names.get(uid1)); // "Warriors FC"

// Resolve team names in an array of objects
const historicalData = [
  { team_id: 'abc123', team_name: 'Old Name', points: 100 },
  { team_id: 'def456', team_name: 'Another Old Name', points: 90 }
];

const resolved = await resolveTeamNames(historicalData);
// Now team_name fields contain current names
```

### 2. Client-Side (React Components)

Use the custom hooks:

```typescript
import { useResolveTeamName, useResolveTeamNames, useResolvedTeamData } from '@/hooks/useResolveTeamNames';

// Single team name
function TeamDisplay({ firebaseUid }: { firebaseUid: string }) {
  const teamName = useResolveTeamName(firebaseUid);
  
  return <div>{teamName}</div>; // Shows current name
}

// Multiple teams
function TeamsTable({ teamUids }: { teamUids: string[] }) {
  const nameMap = useResolveTeamNames(teamUids);
  
  return (
    <ul>
      {teamUids.map(uid => (
        <li key={uid}>{nameMap.get(uid)}</li>
      ))}
    </ul>
  );
}

// Automatic data resolution
function HistoricalStandings() {
  const [rawData, setRawData] = useState(null);
  
  // Fetch historical data
  useEffect(() => {
    fetch('/api/seasons/historical/standings')
      .then(res => res.json())
      .then(data => setRawData(data));
  }, []);
  
  // Automatically resolve team names
  const { data: resolvedData, isLoading } = useResolvedTeamData(
    rawData,
    'team_id',    // field containing Firebase UID
    'team_name'   // field to update with current name
  );
  
  if (isLoading) return <div>Loading...</div>;
  
  return (
    <table>
      {resolvedData?.map(row => (
        <tr key={row.team_id}>
          <td>{row.team_name}</td> {/* Shows current name! */}
          <td>{row.points}</td>
        </tr>
      ))}
    </table>
  );
}
```

### 3. API Routes

Use the dedicated endpoint:

```typescript
// GET single team name
const response = await fetch('/api/teams/resolve-names?uid=abc123');
const { success, name } = await response.json();

// POST multiple team names
const response = await fetch('/api/teams/resolve-names', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    firebaseUids: ['uid1', 'uid2', 'uid3']
  })
});

const { success, names } = await response.json();
// names = { uid1: "Team A", uid2: "Team B", uid3: "Team C" }
```

---

## 📦 Components

### 1. `lib/team-name-resolver.ts`
Core utility functions with caching (5-minute TTL):
- `getCurrentTeamName(firebaseUid)` - Single team
- `getCurrentTeamNames(firebaseUids[])` - Multiple teams
- `resolveTeamNames(items[], teamIdField, teamNameField)` - Array transformation
- `clearTeamNameCache(uid?)` - Cache management

### 2. `app/api/teams/resolve-names/route.ts`
REST API endpoint:
- `GET /api/teams/resolve-names?uid=xxx` - Single team
- `POST /api/teams/resolve-names` - Multiple teams

### 3. `hooks/useResolveTeamNames.ts`
React hooks for client components:
- `useResolveTeamName(firebaseUid)` - Single team
- `useResolveTeamNames(firebaseUids[])` - Multiple teams
- `useResolvedTeamData(data, teamIdField, teamNameField)` - Auto-resolve

---

## 🚀 Where to Apply

Apply the resolver in these pages/components:

### High Priority (Historical Data Display)
1. ✅ **Historical Season Pages** (`/seasons/[id]`)
   - Standings tables
   - Match results
   - Awards/trophies

2. ✅ **Team Statistics** (`/teams/[id]`)
   - Historical performance
   - All-time records
   - Season-by-season view

3. ✅ **Player Pages** (`/players/[id]`)
   - Transfer history
   - Team associations

4. ✅ **Awards/Trophies** (`/awards`)
   - Winner listings
   - Historical champions

5. ✅ **Leaderboards** (`/leaderboards`)
   - All-time team rankings
   - Season comparisons

### Medium Priority
6. **Fantasy League Historical Data**
7. **Committee Dashboard** - Historical views
8. **News Articles** - Team references

---

## 🔧 Cache Management

The resolver includes a 5-minute cache to minimize database queries:

```typescript
import { clearTeamNameCache } from '@/lib/team-name-resolver';

// Clear specific team (after name change)
clearTeamNameCache(firebaseUid);

// Clear all (after bulk updates)
clearTeamNameCache();
```

**When to clear cache:**
- After team profile update
- After bulk team name migrations
- On team deletion/merge

---

## 📊 Performance

**Without Resolver:**
- 1 Firebase read per team display = expensive

**With Resolver:**
- 1 Neon query per team (cached 5 min)
- Batch queries for multiple teams
- ~95% fewer queries with proper caching

---

## ⚠️ Important Notes

1. **Historical Data Preservation**: The resolver does NOT modify Firebase data. Historical team_name values remain unchanged. Names are resolved at display time.

2. **Fallback Behavior**: If a team is not found in Neon, returns `"Unknown Team"`.

3. **Cache Invalidation**: Cache clears automatically after 5 minutes or manually via `clearTeamNameCache()`.

4. **Batch Operations**: Always use `getCurrentTeamNames([...])` for multiple teams instead of calling `getCurrentTeamName()` repeatedly.

5. **React Hooks**: Client-side hooks use the API route, so they work in browser environments without direct database access.

---

## 🧪 Testing

Test the resolver:

```bash
# Test API endpoint
curl http://localhost:3000/api/teams/resolve-names?uid=YOUR_FIREBASE_UID

# Test batch resolution
curl -X POST http://localhost:3000/api/teams/resolve-names \
  -H "Content-Type: application/json" \
  -d '{"firebaseUids": ["uid1", "uid2"]}'
```

---

## 🔮 Future Enhancements

1. **Historical Name Toggle**: Add UI option to show "Name at that time" vs "Current name"
2. **Name History View**: Display full name change timeline
3. **Redis/Memcached**: Upgrade from in-memory cache to distributed cache
4. **GraphQL**: Add resolver to GraphQL schema if implemented
5. **Bulk Update Tool**: Admin panel to update all team_seasons at once

---

## 📝 Example Implementation

See `app/seasons/[id]/page.tsx` for a complete example of integrating the resolver into historical season display.
