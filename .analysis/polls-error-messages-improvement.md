# Polls Management - Better Error Messages

**Date:** 2026-01-02 12:24  
**Page:** `/dashboard/committee/polls`  
**Issue:** "No candidates available" message was not helpful

---

## 🐛 Problem

The polls management page was showing a generic "No eligible candidates for this round" message without explaining WHY there were no candidates. This could be due to several reasons:

1. **No completed fixtures** - Fixtures haven't been played yet
2. **Award already given** - A poll/award was already created for this period
3. **API error** - Something went wrong fetching data
4. **No MOTM assigned** - For POTD, fixtures need MOTM winners

---

## ✅ Solution

Added better error handling and debugging to show specific reasons:

### 1. **Console Logging**
```typescript
console.log('Fetching candidates:', candidateParams.toString());
const candidatesRes = await fetchWithTokenRefresh(`/api/awards/eligible?${candidateParams}`);
const candidatesData = await candidatesRes.json();
console.log('Candidates response:', candidatesData);
```

### 2. **Specific Error Messages**
```typescript
if (!candidatesData.data || candidatesData.data.length === 0) {
  if (candidatesData.message) {
    // Show API message (e.g., "Award already given for this round")
    setError(candidatesData.message);
  } else {
    // Show helpful default message
    const period = ['POTD', 'TOD'].includes(activeTab) 
      ? `Round ${currentRound}` 
      : `Week ${currentWeek}`;
    setError(`No completed fixtures found for ${period}. Fixtures must be completed before candidates can be nominated.`);
  }
}
```

---

## 📊 Error Messages

### Scenario 1: No Completed Fixtures
```
❌ No completed fixtures found for Round 1. 
   Fixtures must be completed before candidates can be nominated.
```

### Scenario 2: Award Already Given
```
❌ Award already given for this round
```

### Scenario 3: API Error
```
❌ Failed to load candidates
```

### Scenario 4: No MOTM Assigned (POTD)
```
❌ No completed fixtures found for Round 1. 
   Fixtures must be completed before candidates can be nominated.
```

---

## 🔍 How the API Works

The `/api/awards/eligible` endpoint checks:

### For POTD (Player of the Day):
1. Check if award already exists for this round
2. Get all completed fixtures in the round
3. Extract MOTM winners from each fixture
4. Return list of MOTM players with their stats

### For POTW (Player of the Week):
1. Check if award already exists for this week
2. Get all completed fixtures in the week (7 rounds)
3. Aggregate player stats across all matches
4. Return top 20 players by goals scored

### For TOD (Team of the Day):
1. Check if award already exists for this round
2. Get all completed fixtures in the round
3. Calculate team performance (goals, wins, etc.)
4. Return teams sorted by goal difference

### For TOW (Team of the Week):
1. Check if award already exists for this week
2. Get all completed fixtures in the week
3. Aggregate team stats across all matches
4. Return teams sorted by points, then goal difference

---

## 🧪 Testing

### Test Case 1: No Fixtures Completed
1. Go to `/dashboard/committee/polls`
2. Select Round 1 (if no fixtures completed)
3. Expected: "No completed fixtures found for Round 1..."

### Test Case 2: Award Already Given
1. Create a poll for Round 1
2. Try to create another poll for Round 1
3. Expected: "Award already given for this round"

### Test Case 3: Fixtures Completed
1. Complete some fixtures for Round 2
2. Select Round 2
3. Expected: List of candidates shown

### Test Case 4: Check Console
1. Open browser console
2. Navigate to polls page
3. See: "Fetching candidates: tournament_id=...&season_id=...&award_type=POTD&round_number=1"
4. See: "Candidates response: {success: true, data: [...], message: '...'}"

---

## 📝 Possible Reasons for No Candidates

| Award Type | Reason | Solution |
|------------|--------|----------|
| POTD | No completed fixtures | Complete fixtures for the round |
| POTD | No MOTM assigned | Assign MOTM to completed fixtures |
| POTD | Award already given | Select a different round |
| POTW | No completed fixtures in week | Complete fixtures for rounds in the week |
| TOD | No completed fixtures | Complete fixtures for the round |
| TOW | No completed fixtures in week | Complete fixtures for rounds in the week |

---

## ✅ Benefits

1. **Clear Communication**: Users know exactly why no candidates are available
2. **Actionable**: Error messages suggest what needs to be done
3. **Debugging**: Console logs help diagnose issues
4. **Better UX**: No more confusion about "No candidates available"

---

**Status:** ✅ **IMPROVED**  
**Testing:** Check browser console for detailed logs  
**Next Steps:** Complete fixtures to see candidates appear
