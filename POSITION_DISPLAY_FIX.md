# Position Display Fix

## Issue
When position or stats values were not found (null/undefined/0), they were showing "0" without proper styling instead of showing "N/A" or "-".

## Problems Fixed

### 1. League Position Display
**Problem:** When `position` was 0 or falsy, it showed "#0" without styling
**Location:** Team info card, left sidebar

**Before:**
```typescript
{selectedView === 'season' && currentSeasonData.stats.position && (
  <span>#{currentSeasonData.stats.position}</span>
)}
```

**Issue:** The condition `currentSeasonData.stats.position` evaluates to false when position is 0, but the component was still rendering in some cases.

**After:**
```typescript
{selectedView === 'season' && 
 currentSeasonData.stats.position !== undefined && 
 currentSeasonData.stats.position !== null && (
  <span>
    {currentSeasonData.stats.position > 0 
      ? `#${currentSeasonData.stats.position}` 
      : 'N/A'}
  </span>
)}
```

**Fix:**
- Explicitly check for `undefined` and `null` instead of truthy check
- Display "N/A" when position is 0 or invalid
- Maintain styling (orange gradient card) only when valid position exists

### 2. Football Player Stats Display
**Problem:** Speed, Ball Control, and Finishing stats showed "0" when null/undefined
**Location:** Football players table, Stats column

**Before:**
```typescript
<span>SPD {player.speed}</span>
<span>BC {player.ball_control}</span>
<span>FIN {player.finishing}</span>
```

**Issue:** When stats were null/undefined, they displayed as "SPD 0", "BC 0", "FIN 0"

**After:**
```typescript
<span>SPD {player.speed || '-'}</span>
<span>BC {player.ball_control || '-'}</span>
<span>FIN {player.finishing || '-'}</span>
```

**Fix:**
- Use fallback to "-" when stat is null/undefined/0
- Maintains consistent styling (colored badges)
- More user-friendly display

### 3. Player Position Badge (Already Correct)
**Location:** Football players table, Position column

**Current (Correct):**
```typescript
<span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
  {player.position || 'N/A'}
</span>
```

This was already correctly implemented with fallback to 'N/A'.

## Visual Improvements

### Before Fix:
```
League Position: #0          ❌ (no styling, confusing)
SPD 0, BC 0, FIN 0          ❌ (looks like actual stats)
```

### After Fix:
```
League Position: N/A         ✓ (clear, styled)
SPD -, BC -, FIN -          ✓ (clear that data is missing)
```

## Edge Cases Handled

1. **Position = 0:** Shows "N/A" instead of "#0"
2. **Position = null:** Component doesn't render
3. **Position = undefined:** Component doesn't render
4. **Position = valid number:** Shows "#1", "#2", etc. with styling
5. **Stats = 0:** Shows "-" instead of "0"
6. **Stats = null/undefined:** Shows "-"
7. **Stats = valid number:** Shows actual value

## Testing Checklist

- [x] League position shows "N/A" when 0
- [x] League position shows "#1", "#2" etc. when valid
- [x] League position card doesn't show when null/undefined
- [x] Speed stat shows "-" when null/0
- [x] Ball Control stat shows "-" when null/0
- [x] Finishing stat shows "-" when null/0
- [x] All stats maintain their colored badge styling
- [x] Position badge shows "N/A" when null

## Code Quality

- Explicit null/undefined checks instead of truthy checks
- Consistent fallback values ("-" for stats, "N/A" for position)
- Maintains all existing styling
- No breaking changes to functionality
- Better user experience with clear "missing data" indicators
