# 🚨 URGENT: Firebase Reads Crisis

## Current Status
- **Today's Reads**: 37K / 50K (74% of daily quota)
- **Risk**: Will hit limit if not fixed immediately

## Main Culprits

### 1. Team Dashboard Polling (CRITICAL)
**Location**: `app/dashboard/team/RegisteredTeamDashboard.tsx` line 351
```typescript
const pollInterval = hasActiveContent ? 3000 : 10000;
```

**Problem**: Polling every 3 seconds = **1,200 requests/hour = 28,800 requests/day**
- Each request makes 3-5 Firebase reads
- Multiple users = exponential growth

**IMMEDIATE FIX**: Change to 30 seconds minimum
```typescript
const pollInterval = hasActiveContent ? 30000 : 60000; // 30s/60s instead of 3s/10s
```

### 2. Transaction API - Multiple Fallback Queries
**Location**: `app/api/team/transactions/route.ts`
- Lines 32-62: **4 separate Firebase queries** trying different field names
- Each transaction page load = 4-8 Firebase reads

**Fix**: Query Neon database instead, only use Firebase for auth

### 3. Dashboard API - Unnecessary Firebase Reads
**Location**: `app/api/team/dashboard/route.ts`
- Lines 57, 67, 87, 95: Multiple Firebase document reads
- Should use Neon for team data

## Immediate Actions Required

### Action 1: Reduce Polling Frequency (DO THIS NOW)
```typescript
// In RegisteredTeamDashboard.tsx line 351
const pollInterval = hasActiveContent ? 30000 : 60000; // Changed from 3000/10000
```

### Action 2: Monitor Usage
Check Firebase Console > Usage tab hourly

### Action 3: Add Read Budget Alerts
- Set alert at 40K reads
- Set hard limit at 48K reads

## Long-term Solutions

### 1. Move to Neon for All Reads
- Only use Firebase for:
  - Auth verification
  - Real-time subscriptions (limited)
- Use Neon PostgreSQL for:
  - Team data
  - Transactions
  - Player data
  - Round data

### 2. Implement Server-Side Caching
```typescript
// Use Redis or in-memory cache
const CACHE_TTL = 60000; // 1 minute
const cache = new Map();
```

### 3. Use WebSocket for Live Updates
- Replace polling with WebSocket subscriptions
- Only update when data actually changes
- Reduce reads by 90%

## Estimated Impact

### Current (3s polling):
- 37K reads in partial day
- Projected: 60-70K reads/day (OVER LIMIT)

### After Fix (30s polling):
- Reduces to ~6K reads/day from dashboard
- Total: ~15K reads/day (SAFE)

## Emergency Fallback

If you hit 50K limit:
1. Disable dashboard auto-refresh temporarily
2. Show manual "Refresh" button instead
3. Cache aggressively (5-minute TTL)

## Code Changes Needed

See:
- `RegisteredTeamDashboard.tsx` - Reduce poll interval
- `app/api/team/transactions/route.ts` - Use Neon
- `app/api/team/dashboard/route.ts` - Use Neon
