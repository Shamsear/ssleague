# Multi-Season Contract System - Testing Guide

## 🎯 Overview

This guide will walk you through testing the complete multi-season contract system from Season creation to contract expiry.

---

## ✅ Pre-Testing Checklist

- [ ] Next.js dev server running: `npm run dev`
- [ ] Firebase Admin SDK configured with service account
- [ ] At least one super admin account
- [ ] At least one committee admin account
- [ ] At least 2 test team accounts

---

## 📋 Test Workflow

### Phase 1: Season Setup

#### 1.1 Create Multi-Season (Super Admin)
**URL**: `/dashboard/superadmin/seasons/create`

**Steps**:
1. Login as super admin
2. Navigate to Create Season page
3. Fill in season details:
   - Name: "Test Season 16"
   - Year: "2024"
   - Type: **Multi-Season** (click the card)
4. Verify multi-season config panel appears with:
   - Dollar Budget: $1000
   - Euro Budget: €10000
   - Min Real Players: 5
   - Max Real Players: 7
   - Max Football Players: 25
   - Category Fine: $20
5. Click "Create Season"

**Expected Result**: 
- ✅ Season created successfully
- ✅ Redirected to seasons list
- ✅ New season shows type "multi"

---

### Phase 2: Team Registration

#### 2.1 Register Teams for Season
**URL**: `/dashboard/committee/registration`

**Steps**:
1. Login as committee admin
2. Open Team Registration page
3. Register at least 2 teams for the test season

**Expected Result**:
- ✅ Teams created with dual balances:
  - `dollarBalance`: 1000
  - `euroBalance`: 10000
- ✅ Teams visible in season participants

**Verification**:
```javascript
// Check in Firebase Console or via script
const team = await db.collection('teams').doc(teamId).get();
console.log(team.data().dollarBalance); // Should be 1000
console.log(team.data().euroBalance);   // Should be 10000
```

---

### Phase 3: Assign Real Players

#### 3.1 Assign Real Player with Contract
**URL**: `/dashboard/committee/real-players/assign`

**Steps**:
1. Login as committee admin
2. Navigate to Assign Real Player page
3. Fill in player details:
   - Team: Select "Test Team 1"
   - Player Name: "John Doe"
   - Auction Value: $300
   - Star Rating: 7
   - Start Season: "Test Season 16"
   - Category: Legend
4. Verify calculated salary shows: **$2.1/match**
5. Click "Assign Player"

**Expected Result**:
- ✅ Success message appears
- ✅ Player added to team's `real_players` array
- ✅ Contract spans 2 seasons (e.g., "Test Season 16" to "Test Season 17")

**Repeat**: Assign 4-6 more players to each team with varying auction values and star ratings

---

### Phase 4: View Team Dashboard

#### 4.1 Check Dual Balances
**URL**: `/dashboard/team`

**Steps**:
1. Login as team owner
2. View team dashboard

**Expected Result**:
- ✅ See "Multi-Season Budgets" section with:
  - Dollar Balance card showing $1000
  - Euro Balance card showing €10000
- ✅ See "Real Players (SS Members)" section showing:
  - Player names
  - Category badges (Legend/Classic)
  - Star ratings (★★★★★☆☆☆☆☆)
  - Salary per match
  - Auction value, points, contract period

---

### Phase 5: Match Result Processing

#### 5.1 Submit Match Results
**URL**: `/dashboard/team/fixtures/[matchId]`

**Steps**:
1. Create a test match between two teams
2. Enter match results:
   - Home Team: 3 goals
   - Away Team: 1 goal
3. Submit results

**Expected Result**:
- ✅ Match status updated to "completed"
- ✅ For Home Team (won by 2 goals):
  - Real player salaries deducted from `dollarBalance`
  - Player points increased by +2 (goal difference)
  - Star ratings recalculated
  - Categories updated based on new points
- ✅ For Away Team (lost by 2 goals):
  - Real player salaries deducted
  - Player points decreased by -2
  - Star ratings recalculated

**Verification**:
```javascript
// Check updated balances and player stats
const team = await db.collection('teams').doc(teamId).get();
const teamData = team.data();

console.log('Dollar Balance:', teamData.dollarBalance); 
// Should be: 1000 - (sum of all player salaries)

console.log('Player Points:', teamData.real_players[0].points);
// Should be updated based on goal difference

console.log('Star Ratings:', teamData.real_players[0].starRating);
// Should be recalculated from points
```

---

### Phase 6: Mid-Season Salary Payment

#### 6.1 Trigger Mid-Season Deduction
**URL**: `/dashboard/committee/contracts/mid-season-salary`

**Steps**:
1. Login as committee admin
2. Navigate to Mid-Season Salary page
3. Enter current round number (e.g., Round 19 for 38-round season)
4. Click "Process Salary Deductions"

**Expected Result**:
- ✅ Success message with results:
  - Teams processed: 2
  - Total salary deducted: €XXX
- ✅ Each team's `euroBalance` reduced by 10% of total football players' auction values
- ✅ `lastSalaryDeduction` field updated with round, amount, date

**Verification**:
```javascript
const team = await db.collection('teams').doc(teamId).get();
const teamData = team.data();

console.log('Euro Balance:', teamData.euroBalance);
console.log('Last Deduction:', teamData.lastSalaryDeduction);
```

---

### Phase 7: Contract Expiry

#### 7.1 Process Expired Contracts
**URL**: `/dashboard/committee/contracts/expire`

**Steps**:
1. **Setup**: Manually edit a player's contract in Firebase to have `endSeason: "Test Season 16"` (current season)
2. Login as committee admin
3. Navigate to Expire Contracts page
4. Click "Expire Contracts"

**Expected Result**:
- ✅ Success message with results:
  - Teams processed: 2
  - Real players removed: 1+
  - Football players removed: 0
  - List of expired players
- ✅ Expired players removed from `real_players` array
- ✅ `real_players_count` updated

**Verification**:
```javascript
const team = await db.collection('teams').doc(teamId).get();
const teamData = team.data();

console.log('Real Players Count:', teamData.real_players_count);
console.log('Real Players:', teamData.real_players);
// Expired players should not be in the array
```

---

## 🧪 Edge Cases to Test

### Test 1: Insufficient Balance
1. Manually set a team's `dollarBalance` to $50
2. Try to assign a player with auction value $100
3. **Expected**: Error message "Insufficient dollar balance"

### Test 2: Lineup Violation Fine
1. Ensure team has < 2 Legend players or < 3 Classic players
2. Submit match result
3. **Expected**: $20 fine deducted from `dollarBalance`

### Test 3: Points Capping
1. Create match with goal difference > 5 (e.g., 10-0)
2. Submit results
3. **Expected**: Player points change by max ±5, not ±10

### Test 4: Category Recalculation
1. Assign 5 players with different point values
2. Submit multiple match results
3. **Expected**: Categories dynamically update based on ranking

### Test 5: Multiple Contracts
1. Assign multiple players to same team
2. Submit match result
3. **Expected**: All player salaries deducted correctly

---

## 📊 Test Data Template

```json
{
  "teams": [
    {
      "id": "team0001",
      "team_name": "Test Warriors",
      "dollarBalance": 1000,
      "euroBalance": 10000,
      "season_id": "seasonXYZ"
    },
    {
      "id": "team0002",
      "team_name": "Test United",
      "dollarBalance": 1000,
      "euroBalance": 10000,
      "season_id": "seasonXYZ"
    }
  ],
  "real_players_to_assign": [
    {
      "name": "Player A",
      "auctionValue": 400,
      "starRating": 10,
      "category": "legend"
    },
    {
      "name": "Player B",
      "auctionValue": 250,
      "starRating": 7,
      "category": "legend"
    },
    {
      "name": "Player C",
      "auctionValue": 150,
      "starRating": 5,
      "category": "classic"
    },
    {
      "name": "Player D",
      "auctionValue": 100,
      "starRating": 3,
      "category": "classic"
    },
    {
      "name": "Player E",
      "auctionValue": 100,
      "starRating": 3,
      "category": "classic"
    }
  ]
}
```

---

## ✅ Testing Checklist

- [ ] Phase 1: Multi-season created successfully
- [ ] Phase 2: Teams registered with dual balances
- [ ] Phase 3: Real players assigned with contracts
- [ ] Phase 4: Team dashboard shows dual balances and contracts
- [ ] Phase 5: Match results process salary deductions
- [ ] Phase 6: Mid-season salary payment works
- [ ] Phase 7: Contract expiry removes players
- [ ] Edge Case 1: Insufficient balance error
- [ ] Edge Case 2: Lineup violation fine applied
- [ ] Edge Case 3: Points capped at ±5
- [ ] Edge Case 4: Categories update dynamically
- [ ] Edge Case 5: Multiple contracts handled correctly

---

## 🐛 Troubleshooting

### Issue: API routes return 500 error
**Solution**: Check Firebase Admin SDK initialization in `lib/firebase-admin.ts`

### Issue: Players not showing on dashboard
**Solution**: Verify `real_players` field exists in team document and is an array

### Issue: Salary not deducting
**Solution**: Check season `type` is set to `'multi'` in Firebase

### Issue: Categories not updating
**Solution**: Ensure `recalculateTeamCategories` is called after point updates

---

## 📝 Test Report Template

```markdown
## Multi-Season Contract System Test Report

**Test Date**: [Date]
**Tester**: [Name]
**Environment**: [Dev/Staging/Production]

### Test Results

| Test Phase | Status | Notes |
|------------|--------|-------|
| Season Setup | ✅/❌ | |
| Team Registration | ✅/❌ | |
| Player Assignment | ✅/❌ | |
| Dashboard Display | ✅/❌ | |
| Match Processing | ✅/❌ | |
| Mid-Season Salary | ✅/❌ | |
| Contract Expiry | ✅/❌ | |

### Issues Found
1. [Issue description]
2. [Issue description]

### Performance Notes
- API response times
- UI load times
- Database query efficiency

### Recommendations
- [Recommendation 1]
- [Recommendation 2]
```

---

## 🎉 Success Criteria

The multi-season contract system is ready for production when:
- ✅ All 7 test phases pass without errors
- ✅ All 5 edge cases handled correctly
- ✅ No console errors in browser or server logs
- ✅ UI is responsive on mobile and desktop
- ✅ API response times < 2 seconds
- ✅ Data integrity maintained across all operations
