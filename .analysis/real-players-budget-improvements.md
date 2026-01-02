# Real Players Page - Budget Display Improvements

**Date:** 2026-01-01 20:27  
**Page:** `/dashboard/committee/real-players`  
**Files Modified:**
- `app/dashboard/committee/real-players/page.tsx`
- `app/api/contracts/assign-bulk/route.ts` (already correct)

---

## ✅ Issues Fixed

### 1. **Firebase Budget Not Updated** ✅ ALREADY WORKING
The API route `/api/contracts/assign-bulk` **already updates** Firebase `team_seasons` correctly:
- Lines 455-456: Updates `real_player_spent` and `real_player_budget`
- Lines 464-465: Updates `total_spent` and `budget` for single currency
- This was working correctly, no changes needed

### 2. **Budget Display Toggle** ✅ ADDED
Added a toggle button to switch between two display modes:

**💰 Actual Balance Mode** (Default - ON):
- Shows `real_player_budget` from Firebase `team_seasons`
- Shows `real_player_spent` from Firebase `team_seasons`
- Displays "(Firebase)" indicator next to values
- This is the REAL current balance from the database

**📊 Max Limit Mode**:
- Shows `initial_budget - local_calculated_spent`
- Calculates spent from assigned players in UI
- Shows "(Initial budget - local calc)" description
- This is a local calculation for reference

### 3. **Budget Fetched from Firebase** ✅ FIXED
The page now:
- Fetches `real_player_budget` and `real_player_spent` from Firebase
- Stores both in `TeamData` interface as `currentBudget` and `currentSpent`
- Uses these values when "Actual Balance" mode is selected
- Falls back to local calculation when "Max Limit" mode is selected

---

## 📝 Changes Made

### Interface Updates
```typescript
interface TeamData {
  id: string;
  name: string;
  originalBudget: number;
  currentBudget: number;      // ✅ NEW - from Firebase
  currentSpent: number;        // ✅ NEW - from Firebase
  currencySystem: string;
  assignedPlayers: Player[];
  isExpanded: boolean;
}
```

### State Added
```typescript
const [showActualBudget, setShowActualBudget] = useState(true);
```

### Data Loading (lines 231-251)
Now fetches BOTH:
- `originalBudget` (initial budget for max limit mode)
- `currentBudget` (from `real_player_budget` or `budget` in Firebase)
- `currentSpent` (from `real_player_spent` or `total_spent` in Firebase)

### UI Components Added

#### Toggle Button (after Contract Info section)
```tsx
<div className="flex items-center justify-center gap-3 p-3 bg-white rounded-xl border border-gray-200">
  <span className="text-sm text-gray-600 font-medium">Budget Display:</span>
  <button onClick={() => setShowActualBudget(!showActualBudget)}>
    💰 Actual Balance
  </button>
  <button onClick={() => setShowActualBudget(!showActualBudget)}>
    📊 Max Limit
  </button>
  <div className="ml-2 text-xs text-gray-500">
    {showActualBudget ? '(From Firebase team_seasons)' : '(Initial budget - local calc)'}
  </div>
</div>
```

### Budget Calculation Logic (lines 1006-1011)
```typescript
const displayBudget = showActualBudget 
  ? team.currentBudget 
  : (team.originalBudget - totalCost);

const displaySpent = showActualBudget 
  ? team.currentSpent 
  : totalCost;

const displayTotal = showActualBudget 
  ? (team.currentBudget + team.currentSpent) 
  : team.originalBudget;
```

### Display Updates

**Team Header** (line 1047):
```tsx
{currencySymbol}{displayBudget.toLocaleString()} left
{showActualBudget && <span className="text-xs ml-1">(Firebase)</span>}
```

**Budget Bar** (line 1083):
```tsx
{currencySymbol}{displaySpent.toLocaleString()} / {currencySymbol}{displayTotal.toLocaleString()}
{showActualBudget && <span className="text-xs ml-1 text-blue-600">(Firebase)</span>}
```

**Quick Assign** (line 840):
```tsx
Budget: {currencySymbol}{remaining.toLocaleString()} left
{showActualBudget && <span className="text-blue-600 ml-1">(Firebase)</span>}
```

---

## 🎯 How It Works

### When Player is Assigned:

1. **Frontend** sends player data to `/api/contracts/assign-bulk`
2. **API** updates Neon `player_seasons` table
3. **API** updates Firebase `team_seasons`:
   - Calculates total spent from all assigned players
   - Updates `real_player_spent` = total spent
   - Updates `real_player_budget` = starting balance - total spent
4. **Frontend** can now toggle between:
   - **Actual Balance**: Shows Firebase values (real-time from DB)
   - **Max Limit**: Shows local calculation (for reference)

### Budget Display Modes:

**Actual Balance (Default)**:
- ✅ Shows real values from Firebase
- ✅ Updates immediately after assignment
- ✅ Reflects database state
- ✅ Recommended for accuracy

**Max Limit**:
- Shows theoretical maximum
- Uses initial budget minus local calculations
- Useful for planning/reference
- May differ from actual if data was modified elsewhere

---

## 🔍 Verification Steps

1. **Check Firebase Console**:
   - Go to `team_seasons` collection
   - Find a team document (e.g., `SSPSLT0026_SSPSLS16`)
   - Verify `real_player_budget` and `real_player_spent` fields exist and are updated

2. **Test Assignment**:
   - Assign a player to a team
   - Check Firebase - values should update
   - Toggle between "Actual Balance" and "Max Limit"
   - Verify both modes show correct values

3. **Check Console Logs**:
   - Look for: `Team [name]: currency=dual, originalBudget=X, currentBudget=Y, currentSpent=Z`
   - Verify all three values are populated

---

## ✨ Benefits

1. **Accurate Budget Tracking**: Shows real Firebase values, not just local calculations
2. **Flexibility**: Toggle between actual and theoretical budgets
3. **Transparency**: Clear indicators show which mode is active
4. **Real-time**: Budget updates immediately after assignment
5. **Dual Currency Support**: Works with both single and dual currency systems

---

**Status:** ✅ **COMPLETE**  
**Testing:** Ready for user verification  
**Next Steps:** Test player assignment and verify Firebase updates
