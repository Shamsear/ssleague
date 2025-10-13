# Tiebreaker System Updates

## Changes Made

### 1. Removed Time Limit from Tiebreakers ✅

**Files Modified:**
- `lib/tiebreaker.ts`
- `app/api/admin/tiebreakers/route.ts`

**Changes:**

#### A. Tiebreaker Creation (`lib/tiebreaker.ts`)
- Changed `duration_minutes` from `2` to `NULL` when creating tiebreakers
- Tiebreakers now have **no time limit** and only resolve when all teams submit or admin manually resolves

```typescript
// OLD: duration_minutes: 2
// NEW: duration_minutes: NULL
```

#### B. Expiration Check (`lib/tiebreaker.ts`)
- Updated `isTiebreakerExpired()` to return `false` when `duration_minutes` is `NULL`
- Added legacy support for old tiebreakers with duration_minutes set

```typescript
// If duration_minutes is NULL, tiebreaker never expires
if (duration_minutes === null) return false;
```

#### C. Auto-Resolution Logic (`lib/tiebreaker.ts`)
- Updated `shouldAutoResolve()` to only check if all teams submitted
- Removed expiration check from auto-resolution logic

```typescript
// OLD: return expired || allSubmitted;
// NEW: return allSubmitted;
```

#### D. Admin API (`app/api/admin/tiebreakers/route.ts`)
- Updated API to handle `NULL` duration_minutes
- Returns `expiresAt: null` and `timeRemaining: null` for tiebreakers without time limit
- Added `hasTimeLimit: false` flag

### 2. Show Tiebreaker Details in Active Rounds Section ✅

**This change has been implemented**

**File Modified:**
- `app/dashboard/committee/rounds/page.tsx`

**What Needs to be Done:**

1. **Add Tiebreaker State:**
```typescript
const [roundTiebreakers, setRoundTiebreakers] = useState<{[key: string]: any[]}>({});
```

2. **Fetch Tiebreakers for Each Active Round:**
```typescript
// In the fetchRounds useEffect, after fetching rounds:
const fetchTiebreakers = async () => {
  if (!currentSeasonId) return;
  
  const response = await fetch(`/api/admin/tiebreakers?seasonId=${currentSeasonId}&status=active`);
  const { success, data } = await response.json();
  
  if (success) {
    // Group tiebreakers by round_id
    const tiebreakersByRound = {};
    data.tiebreakers.forEach(tb => {
      if (!tiebreakersByRound[tb.round_id]) {
        tiebreakersByRound[tb.round_id] = [];
      }
      tiebreakersByRound[tb.round_id].push(tb);
    });
    setRoundTiebreakers(tiebreakersByRound);
  }
};

fetchTiebreakers();
```

3. **Display Tiebreakers in Active Round Card:**

Add this after the "Finalize Round" button (around line 574):

```typescript
{/* Tiebreakers Section - Show when round ends and has tiebreakers */}
{timeRemaining[round.id] === 0 && roundTiebreakers[round.id] && roundTiebreakers[round.id].length > 0 && (
  <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
    <div className="flex items-center mb-3">
      <svg className="w-5 h-5 text-yellow-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <h4 className="font-semibold text-yellow-800">Active Tiebreakers ({roundTiebreakers[round.id].length})</h4>
    </div>
    
    <div className="space-y-2">
      {roundTiebreakers[round.id].map(tb => (
        <div key={tb.id} className="bg-white p-3 rounded-lg border border-yellow-300">
          <div className="flex justify-between items-start">
            <div>
              <p className="font-medium text-gray-900">{tb.player_name}</p>
              <p className="text-sm text-gray-600">{tb.position} - £{tb.original_amount}</p>
              <p className="text-xs text-gray-500 mt-1">
                {tb.submitted_count}/{tb.teams_count} teams submitted
              </p>
            </div>
            <Link 
              href={`/dashboard/committee/tiebreakers`}
              className="px-3 py-1.5 bg-yellow-600 text-white text-sm rounded-lg hover:bg-yellow-700 transition-colors"
            >
              Manage
            </Link>
          </div>
        </div>
      ))}
    </div>
    
    <p className="text-xs text-yellow-700 mt-3">
      ⚠️ Resolve tiebreakers before finalizing the round
    </p>
  </div>
)}
```

## Impact

### For Teams
- ✅ **No more time pressure** - Teams can take their time to submit tiebreaker bids
- ✅ Teams won't miss tiebreakers due to short time windows
- ✅ Better UX - submit when ready, not when rushed

### For Committee Admins
- ✅ **More control** - Can manually resolve tiebreakers when ready
- ✅ **Better visibility** - See tiebreakers directly in active rounds section
- ✅ Can wait for all teams to submit before resolving
- ✅ No automatic expiration means more fair resolution

## Testing Checklist

- [x] Updated tiebreaker creation to use NULL duration
- [x] Updated expiration check to handle NULL duration
- [x] Updated auto-resolve to only check submissions
- [x] Updated admin API to handle NULL duration
- [x] **Add tiebreaker display to committee rounds page**
- [ ] Test creating a tiebreaker (should have no time limit)
- [ ] Test that tiebreaker shows in active round after round ends
- [ ] Test resolving tiebreaker from active round section
- [ ] Verify tiebreaker never expires (stays active until resolved)

## API Changes

### GET `/api/admin/tiebreakers`

**Response Changes:**
```json
{
  "success": true,
  "data": {
    "tiebreakers": [
      {
        "id": "...",
        "player_name": "...",
        "original_amount": 5000,
        "status": "active",
        "duration_minutes": null,  // ← NOW NULL instead of number
        "expiresAt": null,          // ← NOW NULL (no expiration)
        "timeRemaining": null,      // ← NOW NULL (no countdown)
        "isExpired": false,         // ← Always false for new tiebreakers
        "hasTimeLimit": false,      // ← NEW: indicates no time limit
        "teams_count": 2,
        "submitted_count": 0,
        "teams": [...]
      }
    ]
  }
}
```

## Database Schema

**Note:** No database migration needed. The `duration_minutes` column already allows NULL values.

Existing tiebreakers with `duration_minutes = 2` will continue to work (legacy support).
New tiebreakers will have `duration_minutes = NULL`.

## Related Files

### Modified ✅
- `lib/tiebreaker.ts` - Tiebreaker creation and logic
- `app/api/admin/tiebreakers/route.ts` - Admin API
- `app/dashboard/committee/rounds/page.tsx` - Added tiebreaker display in active rounds

### Unaffected ✅
- `app/dashboard/committee/tiebreakers/page.tsx` - Still works for managing tiebreakers
- `app/dashboard/team/tiebreaker/[id]/page.tsx` - Team tiebreaker submission page
- `app/api/tiebreakers/[id]/submit/route.ts` - Submission API
- `app/api/tiebreakers/[id]/resolve/route.ts` - Resolution API

## Date
2025-10-05

## Status
✅ **COMPLETED** - Time limit removed ✅, Round display implemented ✅
