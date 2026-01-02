# Poll Duplicate Prevention

**Date:** 2026-01-02 13:00  
**Issue:** Preventing duplicate poll creation  
**Solution:** Multi-layer duplicate prevention

---

## ✅ How Duplicate Prevention Works

### Layer 1: Frontend UI Check
The "Create Poll" button only appears when `!currentPoll`:

```typescript
{!currentPoll && (
  <div>
    {/* Create Poll Section */}
  </div>
)}

{currentPoll && (
  <div>
    ✅ Poll Already Created
  </div>
)}
```

### Layer 2: Backend Candidate Check
The `/api/awards/eligible` endpoint checks for existing awards:

```typescript
// Check if award already exists
const existingAward = await sql`
  SELECT player_id FROM awards
  WHERE tournament_id = ${tournamentId}
    AND award_type = 'POTD'
    AND round_number = ${roundNumber}
`;

if (existingAward.length > 0) {
  return {
    success: true,
    data: [],  // No candidates
    message: 'Award already given for this round'
  };
}
```

### Layer 3: Poll Existence Check
When loading polls, the system fetches existing polls for the round/week:

```typescript
const pollParams = new URLSearchParams({
  season_id: userSeasonId,
  poll_type: `award_${activeTab.toLowerCase()}`,
  round_number: currentRound.toString(),  // or week_number
});

const pollsRes = await fetchWithTokenRefresh(`/api/polls?${pollParams}`);
const pollsData = await pollsRes.json();
setPolls(pollsData.success && pollsData.data ? pollsData.data : []);
```

---

## 🎯 UI States

### State 1: No Poll Exists, Has Candidates
```
┌─────────────────────────────────┐
│ Create Poll                      │
│                                  │
│ 📋 20 candidates will be added  │
│                                  │
│ • Muhammed Fijas                │
│ • Gokul GC                       │
│ • ...                            │
│                                  │
│ [Create Poll]                    │
└─────────────────────────────────┘
```

### State 2: No Poll Exists, No Candidates
```
┌─────────────────────────────────┐
│          ℹ️                      │
│   No Candidates Available        │
│                                  │
│ No eligible candidates for       │
│ this round                       │
│                                  │
│ (Award already given or no       │
│  completed fixtures)             │
└─────────────────────────────────┘
```

### State 3: Poll Already Exists
```
┌─────────────────────────────────┐
│ Active Poll                      │
│ Who should win POTD?             │
│ Total Votes: 42                  │
│ Status: active                   │
│                                  │
│ [Close Poll]                     │
├─────────────────────────────────┤
│          ✅                      │
│   Poll Already Created           │
│                                  │
│ A poll for this round already    │
│ exists                           │
└─────────────────────────────────┘
```

---

## 🔒 Prevention Flow

### Creating POTD for Round 1:

**First Attempt (Success):**
```
1. Select Round 1, POTD
2. System checks: No existing poll ✓
3. System checks: Candidates available ✓
4. Shows "Create Poll" button
5. Admin clicks → Poll created ✅
```

**Second Attempt (Prevented):**
```
1. Select Round 1, POTD
2. System checks: Poll exists ✓
3. Shows "✅ Poll Already Created"
4. No "Create Poll" button
5. Cannot create duplicate ✅
```

---

## 📊 Database Uniqueness

### Polls Table:
- Each poll has unique `poll_id`
- Multiple polls can exist for same season
- But UI prevents creating duplicates for same round/week

### Recommended: Add Unique Constraint
```sql
-- Add unique constraint to prevent duplicates at DB level
ALTER TABLE polls ADD CONSTRAINT unique_poll_per_period
UNIQUE (season_id, poll_type, related_round_id);

-- Or for metadata-based approach
CREATE UNIQUE INDEX unique_poll_metadata 
ON polls (season_id, poll_type, (metadata->>'round_number'))
WHERE metadata->>'round_number' IS NOT NULL;
```

---

## 🎯 Award vs Poll Relationship

### Awards (Admin-Given):
- Created at `/dashboard/committee/awards`
- One award per round/week
- Blocks poll candidate fetching

### Polls (Fan Voting):
- Created at `/dashboard/committee/polls`
- One poll per round/week
- Independent from admin awards (with `skip_award_check`)

### Relationship:
```
Round 1, POTD:
├── Admin Award: Given to Player A
│   └── Blocks: Creating another admin award
│   └── Allows: Creating fan poll (skip_award_check)
│
└── Fan Poll: All MOTM winners as candidates
    └── Blocks: Creating another poll
    └── Allows: Fans to vote
```

---

## ✅ Current Protection

**Frontend:**
- ✅ UI hides "Create Poll" button when poll exists
- ✅ Shows clear "Poll Already Created" message
- ✅ Displays existing poll details

**Backend:**
- ✅ Checks for existing awards
- ✅ Returns empty candidates if award given
- ✅ Polls API filters by round/week

**Missing (Recommended):**
- ⚠️ Database unique constraint
- ⚠️ API-level duplicate check in `/api/polls/create`

---

## 🔧 Recommended Improvements

### 1. Add API Duplicate Check
```typescript
// In /api/polls/create
const existing = await sql`
  SELECT poll_id FROM polls
  WHERE season_id = ${season_id}
    AND poll_type = ${poll_type}
    AND metadata->>'round_number' = ${metadata.round_number}
`;

if (existing.length > 0) {
  return NextResponse.json({
    success: false,
    error: 'Poll already exists for this round'
  }, { status: 400 });
}
```

### 2. Add Database Constraint
```sql
-- Prevent duplicates at database level
CREATE UNIQUE INDEX idx_unique_poll
ON polls (season_id, poll_type, related_round_id)
WHERE related_round_id IS NOT NULL;
```

---

## 🧪 Testing

### Test Case 1: Create First Poll
1. Go to `/dashboard/committee/polls`
2. Select Round 1, POTD
3. Should see candidates
4. Click "Create Poll"
5. Poll created successfully ✅

### Test Case 2: Try to Create Duplicate
1. Stay on Round 1, POTD
2. Page refreshes
3. Should see "✅ Poll Already Created"
4. No "Create Poll" button
5. Cannot create duplicate ✅

### Test Case 3: Different Round
1. Select Round 2, POTD
2. Should see candidates (if available)
3. Can create new poll ✅
4. Each round has separate poll

---

## 📝 Summary

**Current Protection:**
- ✅ UI prevents duplicate creation
- ✅ Shows clear messages
- ✅ Backend checks for existing awards

**How It Works:**
1. Poll exists → Show existing poll
2. No poll, has candidates → Show create button
3. No poll, no candidates → Show info message

**One Poll Per:**
- Round (for POTD, TOD)
- Week (for POTW, TOW)
- Season + Type combination

---

**Status:** ✅ **PROTECTED**  
**UI:** Clear messaging for all states  
**Recommendation:** Add DB constraint for extra safety
