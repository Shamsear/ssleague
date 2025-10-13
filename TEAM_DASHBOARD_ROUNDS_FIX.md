# Team Dashboard Active Rounds Fix

## Issues Fixed

### 1. **Next.js 15 Async Cookies API** ✅
**Error**: `cookies() should be awaited before using its value`

**Fixed in**: `lib/auth-helper.ts`
- Changed `const cookieStore = cookies();` to `const cookieStore = await cookies();`

### 2. **Database Table Mismatch** ✅
**Problem**: Team dashboard was querying wrong table (`auction_rounds` instead of `rounds`)

**Fixed in**: `app/api/team/dashboard/route.ts`
- Updated query to use `rounds` table (lines 64-88)
- Now matches the admin rounds API and database schema

### 3. **Round ID Type Consistency** ✅
**Problem**: Round IDs are UUIDs (strings) but some code was treating them as numbers

**Fixed in**:
- `app/dashboard/committee/rounds/page.tsx` - Fixed timer state types
- `app/dashboard/team/RegisteredTeamDashboard.tsx` - Fixed Round interface

---

## How Active Rounds Display Works

### Flow:
1. **Committee starts a round** → Creates record in `rounds` table with `status='active'`
2. **Team dashboard fetches data** → Calls `/api/team/dashboard?season_id=<id>`
3. **API queries Neon** → `SELECT * FROM rounds WHERE season_id = ? AND status = 'active'`
4. **Component renders** → Shows active rounds section (line 934-1082 in RegisteredTeamDashboard.tsx)

### Display Locations:

#### Quick Links (Lines 875-887)
```tsx
{activeRounds.length > 0 && (
  <Link href={`/dashboard/team/round/${activeRounds[0].id}`}>
    Current Round
    <span>Active</span>
  </Link>
)}
```

#### Full Active Rounds Section (Lines 934-1082)
Shows for each active round:
- Round position (e.g., "Active Round: GK")
- Timer countdown
- "View Full Round" button
- Current bids table
- Available players count

---

## Troubleshooting Steps

### 1. Restart Dev Server
```bash
# Stop current dev server (Ctrl+C)
npm run dev
```

### 2. Check if Round Exists in Database
Open your Neon database console and run:
```sql
SELECT * FROM rounds 
WHERE status = 'active' 
ORDER BY created_at DESC;
```

### 3. Check Season ID Match
Make sure the `season_id` in the `rounds` table matches the active season in Firestore:
- Firestore: `seasons` collection → active season document ID
- Neon: `rounds.season_id` field

### 4. Browser Console Debug
Open browser DevTools Console and check the network tab:
1. Go to team dashboard
2. Find request to `/api/team/dashboard?season_id=...`
3. Check response → Look for `data.activeRounds` array
4. Should contain rounds if query is working

### 5. Check Active Round in Committee Dashboard
1. Go to `/dashboard/committee/rounds`
2. Verify a round shows in "Active Rounds" section
3. Note the round ID and season_id

---

## Database Schema Reference

### `rounds` Table
```sql
CREATE TABLE rounds (
  id UUID PRIMARY KEY,
  season_id VARCHAR(255),
  position VARCHAR(50),
  max_bids_per_team INTEGER,
  end_time TIMESTAMP,
  status VARCHAR(50), -- 'active', 'completed', 'tiebreaker', 'cancelled'
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### Expected API Response
```json
{
  "success": true,
  "data": {
    "activeRounds": [
      {
        "id": "uuid-string",
        "season_id": "season123",
        "position": "GK",
        "status": "active",
        "end_time": "2025-10-04T20:00:00Z",
        "max_bids_per_team": 5,
        "total_bids": 0,
        "teams_bid": 0
      }
    ],
    ...
  }
}
```

---

## Common Issues

### Issue: "No active rounds" despite round being created
**Cause**: Season ID mismatch between Firestore and Neon
**Solution**: 
1. Check active season ID in Firestore
2. When creating round, use exact same season_id
3. Verify with SQL query above

### Issue: Round shows in committee dashboard but not team dashboard
**Cause**: Team not registered for the season
**Solution**: Ensure team has record in Firestore `team_seasons` collection

### Issue: Changes not reflecting
**Cause**: Next.js build cache
**Solution**: 
1. Stop dev server
2. Delete `.next` folder: `rm -rf .next`
3. Restart: `npm run dev`

---

## Files Modified

1. ✅ `lib/auth-helper.ts` - Added `await` for cookies()
2. ✅ `app/api/team/dashboard/route.ts` - Fixed table name and query
3. ✅ `app/dashboard/committee/rounds/page.tsx` - Fixed timer types
4. ✅ `app/dashboard/team/RegisteredTeamDashboard.tsx` - Fixed Round interface

All changes are backward compatible and should work with existing data!
