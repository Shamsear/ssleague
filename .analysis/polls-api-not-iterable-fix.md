# Polls API Fix - "polls is not iterable" Error

**Date:** 2026-01-02 12:27  
**Error:** `TypeError: polls is not iterable`  
**Files Fixed:**
- `app/api/polls/route.ts`
- `app/dashboard/committee/polls/page.tsx`

---

## 🐛 Problem

The polls API was throwing an error:
```
Error fetching polls: TypeError: polls is not iterable
    at GET (route.ts:56:28)
```

### Root Cause

The API was using `sql.unsafe()` with string interpolation, which doesn't return a proper array:
```typescript
const polls = await sql.unsafe(`
  SELECT * FROM polls
  ${whereClause}
  ORDER BY created_at DESC
`, params);

// Later...
for (const poll of polls) {  // ❌ Error: polls is not iterable
```

---

## ✅ Solution

### 1. **Fixed SQL Query Building**

Changed from `sql.unsafe()` to proper SQL template literals:

**Before:**
```typescript
let conditions = [];
let params: any = {};

if (season_id) {
  conditions.push('season_id = $season_id');
  params.season_id = season_id;
}

const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
const polls = await sql.unsafe(`SELECT * FROM polls ${whereClause}`, params);
```

**After:**
```typescript
let query = sql`SELECT * FROM polls WHERE 1=1`;

if (season_id) {
  query = sql`${query} AND season_id = ${season_id}`;
}
if (poll_type) {
  query = sql`${query} AND poll_type = ${poll_type}`;
}

query = sql`${query} ORDER BY created_at DESC`;
const polls = await query;  // ✅ Returns proper array
```

### 2. **Added Metadata Filtering**

Added support for filtering by `round_number` and `week_number` stored in metadata:

```typescript
if (round_number) {
  query = sql`${query} AND metadata->>'round_number' = ${round_number}`;
}
if (week_number) {
  query = sql`${query} AND metadata->>'week_number' = ${week_number}`;
}
```

### 3. **Fixed Response Format**

Changed response to use `data` property for consistency:

**Before:**
```typescript
return NextResponse.json({ 
  success: true, 
  polls,  // ❌ Inconsistent with other APIs
  count: polls.length
});
```

**After:**
```typescript
return NextResponse.json({ 
  success: true, 
  data: polls,  // ✅ Consistent format
  count: polls.length
});
```

### 4. **Updated Frontend**

Updated polls page to use `data` property:

```typescript
const pollsData = await pollsRes.json();
setPolls(pollsData.success && pollsData.data ? pollsData.data : []);
```

---

## 🔍 Why It Failed

The `sql.unsafe()` method with parameterized queries doesn't work the same way as SQL template literals in Neon/Postgres.js. The template literal syntax (`sql\`...\``) properly returns an array, while `sql.unsafe()` might return a different result object structure.

---

## 📊 API Query Examples

### Example 1: Get POTD Polls for Round 1
```
GET /api/polls?season_id=SSPSLS16&poll_type=award_potd&round_number=1
```

**SQL Generated:**
```sql
SELECT * FROM polls 
WHERE 1=1 
  AND season_id = 'SSPSLS16' 
  AND poll_type = 'award_potd' 
  AND metadata->>'round_number' = '1'
ORDER BY created_at DESC
```

### Example 2: Get All Active Polls
```
GET /api/polls?season_id=SSPSLS16&status=active
```

**SQL Generated:**
```sql
SELECT * FROM polls 
WHERE 1=1 
  AND season_id = 'SSPSLS16' 
  AND status = 'active'
ORDER BY created_at DESC
```

### Example 3: Get POTW Polls for Week 2
```
GET /api/polls?season_id=SSPSLS16&poll_type=award_potw&week_number=2
```

**SQL Generated:**
```sql
SELECT * FROM polls 
WHERE 1=1 
  AND season_id = 'SSPSLS16' 
  AND poll_type = 'award_potw' 
  AND metadata->>'week_number' = '2'
ORDER BY created_at DESC
```

---

## ✅ Response Format

```json
{
  "success": true,
  "data": [
    {
      "poll_id": "poll_123...",
      "season_id": "SSPSLS16",
      "poll_type": "award_potd",
      "question_en": "Who should win Player of the Day?",
      "options": [...],
      "total_votes": 42,
      "status": "active",
      "metadata": {
        "tournament_id": "SSPSLS16L",
        "award_type": "POTD",
        "round_number": 1
      },
      "created_at": "2026-01-02T09:27:00Z",
      "closes_at": "2026-01-09T09:27:00Z"
    }
  ],
  "count": 1,
  "auto_closed": 0
}
```

---

## 🧪 Testing

### Test Case 1: Fetch Polls
1. Go to `/dashboard/committee/polls`
2. Select a round
3. Check browser console - should see successful API call
4. No more "polls is not iterable" error

### Test Case 2: Check Response
1. Open browser DevTools → Network tab
2. Navigate to polls page
3. Find `/api/polls?...` request
4. Check response - should have `data` array

### Test Case 3: Filter by Round
1. Select different rounds
2. API should filter by `metadata->>'round_number'`
3. Only polls for that round should appear

---

## ✨ Benefits

1. **Fixed Error**: No more "polls is not iterable" error
2. **Proper SQL**: Uses Neon/Postgres.js template literals correctly
3. **Metadata Filtering**: Can filter by round_number and week_number
4. **Consistent API**: Response format matches other APIs (`data` property)
5. **Better Queries**: More efficient SQL generation

---

**Status:** ✅ **FIXED**  
**Testing:** Polls page should now load without errors  
**Note:** Award already given for Round 1, so no candidates will show (expected behavior)
