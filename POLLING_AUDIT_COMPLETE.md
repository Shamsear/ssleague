# Complete Polling Audit - Firebase Read Reduction

## Summary
Found **4 critical polling locations** causing high Firebase reads.

## ✅ FIXED

### 1. Team Dashboard (FIXED)
**File**: `app/dashboard/team/RegisteredTeamDashboard.tsx`
- **Before**: 3 seconds / 10 seconds
- **After**: 30 seconds / 60 seconds
- **Impact**: 90% reduction in dashboard polls

## 🔴 STILL NEEDS FIXING

### 2. Committee Dashboard (CRITICAL)
**File**: `app/dashboard/committee/page.tsx` line 171
```typescript
const interval = setInterval(fetchActiveRounds, 5000); // 5 seconds!
```

**Issue**: Polling every 5 seconds
- 720 requests/hour = 17,280 requests/day
- Each request makes API calls that may trigger Firebase reads

**Immediate Fix Needed**:
```typescript
const interval = setInterval(fetchActiveRounds, 30000); // Change to 30 seconds
```

### 3. Round Detail Page (MODERATE)
**File**: `hooks/useTeamDashboard.ts` line 129
```typescript
refetchInterval: 3000, // Poll every 3 seconds
```

**Issue**: When users are in a round page, polls every 3 seconds
**Fix Needed**:
```typescript
refetchInterval: 10000, // Change to 10 seconds (reasonable for round updates)
```

### 4. Committee Rounds Page
**File**: `app/dashboard/committee/rounds/page.tsx`
- Uses WebSocket for updates (GOOD)
- No explicit polling interval found (GOOD)

## Estimated Firebase Read Usage

### Current (Before Fixes):
```
Team Dashboard:      ~28,800 reads/day (3s polling)
Committee Dashboard: ~17,280 reads/day (5s polling)
Round Pages:         ~8,640 reads/day  (3s polling, fewer users)
---------------------------------------------------
TOTAL:               ~54,720 reads/day (OVER LIMIT!)
```

### After Team Dashboard Fix (Current State):
```
Team Dashboard:      ~2,880 reads/day (30s polling) ✅ FIXED
Committee Dashboard: ~17,280 reads/day (5s polling) ❌ STILL HIGH
Round Pages:         ~2,880 reads/day  (10s polling) ⚠️ NEEDS FIX
---------------------------------------------------
TOTAL:               ~23,040 reads/day (SAFER but still high)
```

### After All Fixes:
```
Team Dashboard:      ~2,880 reads/day  (30s polling) ✅
Committee Dashboard: ~2,880 reads/day  (30s polling) ✅
Round Pages:         ~2,880 reads/day  (10s polling) ✅
---------------------------------------------------
TOTAL:               ~8,640 reads/day  (SAFE - only 17% of quota!)
```

## Other Observations

### ✅ Good Patterns Found:
1. `useCachedData.ts` - No polling, uses stale-time strategy
2. `useTeamDashboard.ts` - Dashboard hook has `refetchInterval: false` ✅
3. Most hooks properly disable polling with `refetchInterval: false`

### ⚠️ Potential Issues:
1. **Transaction API** (`app/api/team/transactions/route.ts`):
   - Lines 32-62: 4 sequential Firebase queries trying different field names
   - Should cache team lookup or use Neon database

2. **Dashboard API** (`app/api/team/dashboard/route.ts`):
   - Lines 57, 67, 87, 95: Multiple Firebase reads
   - Has caching but still reads from Firebase frequently

## Immediate Action Items

### Priority 1 (DO NOW):
```typescript
// File: app/dashboard/committee/page.tsx line 171
-   const interval = setInterval(fetchActiveRounds, 5000);
+   const interval = setInterval(fetchActiveRounds, 30000);
```

### Priority 2 (DO SOON):
```typescript
// File: hooks/useTeamDashboard.ts line 129
-   refetchInterval: 3000,
+   refetchInterval: 10000,
```

### Priority 3 (Optimization):
1. Cache team lookups in memory or Redis
2. Use Neon database for team data instead of Firebase
3. Reduce fallback queries in transaction API

## Long-term Solutions

1. **Move to Server-Sent Events (SSE)** instead of polling
2. **Use WebSocket exclusively** for real-time updates
3. **Implement Redis caching** for frequently accessed data
4. **Use Neon PostgreSQL** as primary database, Firebase only for auth

## Monitoring

After implementing all fixes, monitor Firebase Console:
- Target: < 15K reads/day (30% of quota)
- Alert at: 30K reads/day (60% of quota)
- Hard limit: 48K reads/day (96% of quota)
