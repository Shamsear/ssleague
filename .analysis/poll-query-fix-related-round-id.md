# Poll Query Fix - Related Round ID

**Date:** 2026-01-02 13:04  
**Issue:** Polls created but not showing (duplicate creation allowed)  
**Root Cause:** Schema mismatch between poll storage and query  
**Solution:** Fixed to use `related_round_id` column

---

## 🐛 The Problem

### Symptom:
- Poll was created successfully
- But "Create Poll" button still appeared
- Allowed creating duplicate polls

### Root Cause:
**Storage vs Query Mismatch:**

**Poll Creation** stored in:
```sql
INSERT INTO polls (..., related_round_id, ...)
VALUES (..., ${metadata?.round_number || null}, ...)
```

**Poll Query** looked for:
```javascript
// JavaScript filtering on metadata field
if (metadata.round_number === round_number) { ... }
```

**Result:** Query couldn't find the poll because:
- Data stored in `related_round_id` column
- Query filtered by `metadata` JSON field
- **Mismatch** → Poll not found → Duplicate creation allowed

---

## ✅ The Fix

### 1. **Fixed Poll Query** (`/api/polls/route.ts`)

**Before:**
```typescript
// JavaScript filtering (wrong column)
polls = polls.filter((poll: any) => {
  const metadata = JSON.parse(poll.metadata);
  return metadata.round_number === round_number;
});
```

**After:**
```typescript
// SQL filtering (correct column)
if (round_number) {
  query = sql`${query} AND related_round_id = ${parseInt(round_number)}`;
}
if (week_number) {
  const weekNum = parseInt(week_number);
  const startRound = (weekNum - 1) * 7 + 1;
  const endRound = weekNum * 7;
  query = sql`${query} AND related_round_id >= ${startRound} AND related_round_id <= ${endRound}`;
}
```

### 2. **Fixed Poll Creation** (`/api/polls/create/route.ts`)

**Issue:** Week-based polls (POTW, TOW) had `related_round_id = null`

**Before:**
```typescript
related_round_id: ${metadata?.round_number || null}
// For POTW: metadata.round_number doesn't exist → null
```

**After:**
```typescript
// Calculate related_round_id for both rounds and weeks
let relatedRoundId = null;
if (metadata?.round_number) {
  relatedRoundId = metadata.round_number;  // POTD, TOD
} else if (metadata?.week_number) {
  relatedRoundId = (metadata.week_number - 1) * 7 + 1;  // POTW, TOW (first round of week)
}
```

---

## 📊 How It Works Now

### POTD (Round-Based):
```
Round 1 → related_round_id = 1
Round 2 → related_round_id = 2
...
```

**Query:**
```sql
SELECT * FROM polls 
WHERE related_round_id = 1
```

### POTW (Week-Based):
```
Week 1 (Rounds 1-7)   → related_round_id = 1
Week 2 (Rounds 8-14)  → related_round_id = 8
Week 3 (Rounds 15-21) → related_round_id = 15
...
```

**Query:**
```sql
SELECT * FROM polls 
WHERE related_round_id >= 1 AND related_round_id <= 7
```

---

## 🔄 Data Flow

### Creating POTW for Week 1:

**Frontend:**
```javascript
metadata: {
  tournament_id: "SSPSLS16L",
  award_type: "POTW",
  week_number: 1
}
```

**Backend Calculation:**
```javascript
relatedRoundId = (1 - 1) * 7 + 1 = 1
```

**Database:**
```sql
INSERT INTO polls (related_round_id, ...)
VALUES (1, ...)
```

**Query:**
```sql
SELECT * FROM polls
WHERE related_round_id >= 1 AND related_round_id <= 7
```

**Result:** ✅ Poll found!

---

## 🎯 Week to Round Mapping

| Week | Rounds | related_round_id | Query Range |
|------|--------|------------------|-------------|
| 1 | 1-7 | 1 | 1-7 |
| 2 | 8-14 | 8 | 8-14 |
| 3 | 15-21 | 15 | 15-21 |
| 4 | 22-28 | 22 | 22-28 |

**Formula:**
```javascript
firstRoundOfWeek = (week - 1) * 7 + 1
lastRoundOfWeek = week * 7
```

---

## 🐛 Existing Polls Issue

### Problem:
Polls created **before** this fix have:
- POTD/TOD: `related_round_id = round_number` ✅ (works)
- POTW/TOW: `related_round_id = null` ❌ (broken)

### Solution:
**Option 1: Update Existing Polls**
```sql
-- Update POTW polls to have correct related_round_id
UPDATE polls
SET related_round_id = 
  CASE 
    WHEN poll_type = 'award_potw' THEN 
      ((metadata->>'week_number')::int - 1) * 7 + 1
    WHEN poll_type = 'award_tow' THEN 
      ((metadata->>'week_number')::int - 1) * 7 + 1
    ELSE related_round_id
  END
WHERE poll_type IN ('award_potw', 'award_tow')
  AND related_round_id IS NULL;
```

**Option 2: Delete and Recreate**
- Delete broken polls
- Create new ones with correct schema

---

## ✅ Benefits

1. **Duplicate Prevention**: Polls are now found correctly
2. **Consistent Schema**: All polls use `related_round_id`
3. **Efficient Queries**: SQL filtering instead of JavaScript
4. **Week Support**: POTW/TOW polls work correctly

---

## 🧪 Testing

### Test Case 1: Create POTD for Round 1
1. Go to polls page
2. Select Round 1, POTD
3. Create poll
4. Refresh page
5. Should see "✅ Poll Already Created"
6. Cannot create duplicate ✅

### Test Case 2: Create POTW for Week 1
1. Select Week 1, POTW
2. Create poll
3. Refresh page
4. Should see existing poll
5. Cannot create duplicate ✅

### Test Case 3: Different Rounds/Weeks
1. Create poll for Round 1
2. Switch to Round 2
3. Should see "Create Poll" button
4. Can create separate poll ✅

---

## 📝 Summary

**Problem:**
- Polls stored in `related_round_id`
- Queries looked in `metadata`
- Polls not found → Duplicates allowed

**Solution:**
- Query by `related_round_id` column
- Calculate round ID for weeks
- Polls found correctly → Duplicates prevented

**Result:**
- ✅ One poll per round/week
- ✅ Efficient SQL queries
- ✅ Works for all poll types

---

**Status:** ✅ **FIXED**  
**Impact:** Duplicate prevention now works  
**Action Needed:** Update existing POTW/TOW polls (if any)
