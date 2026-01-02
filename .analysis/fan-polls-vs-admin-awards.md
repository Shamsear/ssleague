# Fan Polls vs Admin Awards - Separation

**Date:** 2026-01-02 12:30  
**Issue:** Polls blocked when admin award already given  
**Solution:** Added `skip_award_check` parameter to separate fan polls from admin awards

---

## 🎯 Problem

The polls management page was showing "No candidates available" when an admin award had already been given for a round/week. However, **polls are for fan voting** and should be **independent** from admin awards.

### Example:
- Admin gives POTD award to "Mohamed Roshan" for Round 1
- Fans should still be able to vote in a poll for Round 1
- But the system was blocking poll creation because award already exists

---

## ✅ Solution

### 1. **Added `skip_award_check` Parameter**

Modified `/api/awards/eligible` to accept a new parameter:

```typescript
const skipAwardCheck = searchParams.get('skip_award_check') === 'true';
```

### 2. **Conditional Award Checking**

Wrapped existing award checks with the `skipAwardCheck` condition:

**Before:**
```typescript
// Always check if award exists
const existingAward = await sql`
  SELECT player_id, player_name FROM awards
  WHERE tournament_id = ${tournamentId}
    AND award_type = 'POTD'
    AND round_number = ${parseInt(roundNumber)}
`;

if (existingAward.length > 0) {
  return NextResponse.json({
    success: true,
    data: [],  // ❌ No candidates for polls
    message: 'Award already given for this round'
  });
}
```

**After:**
```typescript
// Skip award check for fan polls
if (!skipAwardCheck) {
  const existingAward = await sql`
    SELECT player_id, player_name FROM awards
    WHERE tournament_id = ${tournamentId}
      AND award_type = 'POTD'
      AND round_number = ${parseInt(roundNumber)}
  `;

  if (existingAward.length > 0) {
    return NextResponse.json({
      success: true,
      data: [],
      message: 'Award already given for this round'
    });
  }
}
// ✅ Continue to fetch candidates for polls
```

### 3. **Updated Polls Page**

Modified the polls page to pass `skip_award_check=true`:

```typescript
const candidateParams = new URLSearchParams({
  tournament_id: tournamentId,
  season_id: userSeasonId,
  award_type: activeTab,
  skip_award_check: 'true', // ✅ Allow candidates even if admin award was given
});
```

---

## 📊 Use Cases

### Use Case 1: Admin Awards Page
```
GET /api/awards/eligible?tournament_id=...&award_type=POTD&round_number=1
```
- **Without `skip_award_check`**: Checks if award exists
- **If award exists**: Returns empty candidates (prevents duplicate awards)
- **Purpose**: Prevent admins from giving the same award twice

### Use Case 2: Fan Polls Page
```
GET /api/awards/eligible?tournament_id=...&award_type=POTD&round_number=1&skip_award_check=true
```
- **With `skip_award_check=true`**: Skips award existence check
- **Even if award exists**: Returns candidates for fan voting
- **Purpose**: Allow fans to vote independently of admin decisions

---

## 🔄 Flow Comparison

### Admin Awards Flow
```
1. Admin goes to /dashboard/committee/awards
2. Selects Round 1, POTD
3. API checks: Award already given? → YES
4. Result: No candidates shown ✅ (correct - prevents duplicates)
```

### Fan Polls Flow
```
1. Admin goes to /dashboard/committee/polls
2. Selects Round 1, POTD
3. API checks: Award already given? → SKIPPED (skip_award_check=true)
4. Result: Candidates shown ✅ (correct - allows fan voting)
```

---

## 📝 Award Types Affected

All award types now support `skip_award_check`:

| Award Type | Description | Admin Award | Fan Poll |
|------------|-------------|-------------|----------|
| **POTD** | Player of the Day | Blocked if exists | Always allowed |
| **POTW** | Player of the Week | Blocked if exists | Always allowed |
| **TOD** | Team of the Day | Blocked if exists | Always allowed |
| **TOW** | Team of the Week | Blocked if exists | Always allowed |
| **POTS** | Player of the Season | N/A | N/A |
| **TOTS** | Team of the Season | N/A | N/A |

---

## 🎯 Benefits

1. **Independence**: Fan polls are independent from admin awards
2. **Flexibility**: Admins can give awards AND create polls for the same period
3. **Engagement**: Fans can vote even after admin has made a decision
4. **No Conflicts**: Both systems work in parallel without interfering

---

## 🧪 Testing

### Test Case 1: Admin Award Exists
1. Admin gives POTD award for Round 1 to Player A
2. Go to `/dashboard/committee/polls`
3. Select Round 1, POTD
4. Expected: Candidates shown (including Player A)
5. Create poll successfully

### Test Case 2: No Admin Award
1. No admin award given for Round 2
2. Go to `/dashboard/committee/polls`
3. Select Round 2, POTD
4. Expected: Candidates shown
5. Create poll successfully

### Test Case 3: Admin Awards Page
1. Go to `/dashboard/committee/awards`
2. Select Round 1, POTD (award already given)
3. Expected: No candidates shown (prevents duplicate)
4. Cannot give award again ✅

---

## 🔍 Console Output

### With Admin Award Given:
```
🔍 Searching for POTD candidates: tournament=SSPSLS16L, round=1
⚠️ POTD award already given for round 1 to Mohamed Roshan
(Award check SKIPPED for fan polls)
📊 Found 3 POTD candidates
✅ Candidates returned for poll creation
```

---

## ✨ Summary

- **Admin Awards**: Check if award exists, prevent duplicates
- **Fan Polls**: Skip award check, allow voting regardless
- **Parameter**: `skip_award_check=true` enables independent fan voting
- **Result**: Both systems work in harmony

---

**Status:** ✅ **IMPLEMENTED**  
**Testing:** Polls now work even when admin awards exist  
**Impact:** Fan engagement through polls is now independent of admin decisions
