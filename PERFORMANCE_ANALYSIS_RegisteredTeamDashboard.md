# Performance Analysis: RegisteredTeamDashboard Component

## Overview
This document identifies performance bottlenecks and slow operations in the `RegisteredTeamDashboard.tsx` component and provides recommendations for optimization.

---

## 🔴 Critical Performance Issues

### 1. **Aggressive Polling Interval (Lines 244-263)**

**Issue:**
```typescript
const pollInterval = hasActiveContent ? 3000 : 10000;
interval = setInterval(() => fetchDashboard(false), pollInterval);
```

**Problem:**
- Fetches dashboard data every 3 seconds when there's active content
- Every 10 seconds otherwise
- Can cause excessive API calls and render cycles
- The polling continues regardless of whether data has changed

**Impact:** HIGH - Causes constant re-renders and network traffic

**Recommendation:**
```typescript
// Increase poll intervals
const pollInterval = hasActiveContent ? 10000 : 30000; // 10s active, 30s inactive

// Better: Use WebSocket for real-time updates instead of polling
// Or use Server-Sent Events (SSE)
```

---

### 2. **useEffect Dependency Hell (Line 263)**

**Issue:**
```typescript
}, [seasonStatus?.seasonId, dashboardData?.activeRounds?.length, 
    dashboardData?.activeBulkRounds?.length, dashboardData?.tiebreakers?.length, user]);
```

**Problem:**
- `dashboardData` is in dependencies → causes infinite loop risk
- When `fetchDashboard` updates `dashboardData`, it triggers the effect again
- Creates unnecessary polling interval resets

**Impact:** HIGH - Can cause infinite re-render loops and memory leaks

**Recommendation:**
```typescript
// Remove dashboardData from dependencies
useEffect(() => {
  fetchDashboard(true);
  
  const interval = setInterval(() => fetchDashboard(false), 10000);
  
  return () => {
    clearInterval(interval);
  };
}, [seasonStatus?.seasonId]); // Only depend on seasonId
```

---

### 3. **JSON.stringify() on Every Render (Line 206)**

**Issue:**
```typescript
const dataString = JSON.stringify(data);
if (dataString !== previousDataRef.current) {
  previousDataRef.current = dataString;
  setDashboardData(data);
}
```

**Problem:**
- `JSON.stringify()` on large objects is expensive
- Runs on every API response (every 3-10 seconds)
- Deep comparison could be optimized

**Impact:** MEDIUM - CPU overhead on every poll

**Recommendation:**
```typescript
// Use a hash function or shallow comparison for specific fields
import { isEqual } from 'lodash-es'; // or write custom shallow compare

if (!isEqual(previousDataRef.current, data)) {
  previousDataRef.current = data;
  setDashboardData(data);
}

// Or use a more efficient deep equal library like 'fast-deep-equal'
```

---

### 4. **Multiple Timer useEffects (Lines 265-328)**

**Issue:**
Two separate useEffect hooks managing timers for active rounds and bulk rounds

**Problem:**
- Each timer updates state every second
- Multiple timers cause multiple re-renders per second
- Timer cleanup logic is duplicated

**Impact:** MEDIUM-HIGH - Causes frequent re-renders (multiple times per second)

**Recommendation:**
```typescript
// Consolidate into a single timer effect
useEffect(() => {
  const timerId = setInterval(() => {
    const now = new Date().getTime();
    
    // Update all timers at once
    const newTimeRemaining: { [key: string]: number } = {};
    const newBulkTimeRemaining: { [key: number]: number } = {};
    
    dashboardData?.activeRounds?.forEach(round => {
      if (round.end_time) {
        const end = new Date(round.end_time).getTime();
        newTimeRemaining[round.id] = Math.max(0, Math.floor((end - now) / 1000));
      }
    });
    
    dashboardData?.activeBulkRounds?.forEach(bulkRound => {
      if (bulkRound.end_time) {
        const end = new Date(bulkRound.end_time).getTime();
        newBulkTimeRemaining[bulkRound.id] = Math.max(0, Math.floor((end - now) / 1000));
      }
    });
    
    // Single state update instead of multiple
    setTimeRemaining(newTimeRemaining);
    setBulkTimeRemaining(newBulkTimeRemaining);
  }, 1000);
  
  return () => clearInterval(timerId);
}, [dashboardData?.activeRounds, dashboardData?.activeBulkRounds]);
```

---

### 5. **Filtering Operations in Render (Lines 444-461)**

**Issue:**
```typescript
const filteredPlayers = players.filter(player => {
  const matchesPosition = selectedPosition === 'all' || player.position === selectedPosition;
  const matchesSearch = player.name.toLowerCase().includes(searchTerm.toLowerCase());
  return matchesPosition && matchesSearch;
});

const filteredBids = activeBids.filter(bid =>
  bid.player.name.toLowerCase().includes(bidSearchTerm.toLowerCase())
);

const filteredResults = roundResults.filter(result => {
  if (resultFilter === 'won') return result.won;
  if (resultFilter === 'lost') return !result.won;
  return true;
});
```

**Problem:**
- Filter operations run on every render
- `.toLowerCase()` is called on every item, every render
- No memoization

**Impact:** MEDIUM - CPU overhead, especially with large datasets

**Recommendation:**
```typescript
import { useMemo } from 'react';

const filteredPlayers = useMemo(() => {
  const lowerSearchTerm = searchTerm.toLowerCase();
  return players.filter(player => {
    const matchesPosition = selectedPosition === 'all' || player.position === selectedPosition;
    const matchesSearch = player.name.toLowerCase().includes(lowerSearchTerm);
    return matchesPosition && matchesSearch;
  });
}, [players, selectedPosition, searchTerm]);

const filteredBids = useMemo(() => {
  const lowerBidSearchTerm = bidSearchTerm.toLowerCase();
  return activeBids.filter(bid =>
    bid.player.name.toLowerCase().includes(lowerBidSearchTerm)
  );
}, [activeBids, bidSearchTerm]);

const filteredResults = useMemo(() => {
  return roundResults.filter(result => {
    if (resultFilter === 'won') return result.won;
    if (resultFilter === 'lost') return !result.won;
    return true;
  });
}, [roundResults, resultFilter]);
```

---

### 6. **Large Component Render Tree**

**Issue:**
The component is 1500+ lines with complex nested JSX

**Problem:**
- Entire component re-renders on any state change
- Many child components could be memoized
- Timer updates trigger full re-render

**Impact:** MEDIUM - Unnecessary re-renders of unchanged UI sections

**Recommendation:**
```typescript
// Split into smaller sub-components with React.memo()

const TiebreakerSection = React.memo(({ tiebreakers, user }) => {
  // Tiebreaker UI
});

const BulkRoundSection = React.memo(({ activeBulkRounds, team, bulkTimeRemaining, formatTime }) => {
  // Bulk round UI
});

const TeamOverview = React.memo(({ team, stats }) => {
  // Team overview UI
});

// Use in main component
return (
  <>
    <TiebreakerSection tiebreakers={tiebreakers} user={user} />
    <BulkRoundSection 
      activeBulkRounds={activeBulkRounds} 
      team={team} 
      bulkTimeRemaining={bulkTimeRemaining}
      formatTime={formatTime}
    />
    <TeamOverview team={team} stats={stats} />
    {/* ... */}
  </>
);
```

---

## 🟡 Medium Priority Issues

### 7. **Position Breakdown Calculation (Lines 990-1018)**

**Issue:**
Calculates position breakdown on every render inside the JSX

**Recommendation:**
Move to `useMemo()` or calculate on the backend

---

### 8. **No Lazy Loading or Virtualization**

**Issue:**
All players, bids, and results are rendered at once

**Recommendation:**
- Use `react-window` or `react-virtualized` for large lists
- Implement pagination or "load more" functionality
- Only render visible items

---

### 9. **Multiple Console.log Statements (Lines 196-205)**

**Issue:**
```typescript
console.log('📊 Dashboard API Response:', {...});
console.log('✅ Active Rounds Data:', data.activeRounds);
console.warn('⚠️ No active rounds in API response');
console.log('🔄 Dashboard data updated');
```

**Problem:**
These run on every fetch (every 3-10 seconds) in production

**Recommendation:**
```typescript
// Use environment-based logging
if (process.env.NODE_ENV === 'development') {
  console.log('📊 Dashboard API Response:', {...});
}
```

---

## 📊 Performance Optimization Summary

| Issue | Priority | Impact | Effort | 
|-------|----------|--------|--------|
| Aggressive Polling | Critical | HIGH | Low |
| useEffect Dependencies | Critical | HIGH | Medium |
| JSON.stringify | High | MEDIUM | Low |
| Multiple Timers | High | MEDIUM-HIGH | Medium |
| Filter Operations | Medium | MEDIUM | Low |
| Large Component | Medium | MEDIUM | High |
| Position Calc | Low | LOW | Low |
| No Virtualization | Medium | MEDIUM | Medium |
| Console Logs | Low | LOW | Low |

---

## 🎯 Quick Wins (Immediate Fixes)

### Fix #1: Increase Polling Interval
```typescript
// Change line 251
const pollInterval = hasActiveContent ? 10000 : 30000;
```

### Fix #2: Remove console.logs in production
```typescript
// Wrap all console statements
if (process.env.NODE_ENV === 'development') {
  console.log(...);
}
```

### Fix #3: Memoize filter operations
```typescript
const filteredPlayers = useMemo(() => { /* ... */ }, [players, selectedPosition, searchTerm]);
const filteredBids = useMemo(() => { /* ... */ }, [activeBids, bidSearchTerm]);
const filteredResults = useMemo(() => { /* ... */ }, [roundResults, resultFilter]);
```

### Fix #4: Consolidate timer effects
```typescript
// Merge the two timer useEffects into one
```

---

## 🚀 Long-term Recommendations

1. **Implement WebSocket/SSE** instead of polling for real-time updates
2. **Split component** into smaller, memoized sub-components
3. **Virtualize long lists** (players, bids, results)
4. **Move calculations to backend** where possible
5. **Add loading skeletons** instead of full-page loader
6. **Implement request debouncing** for search inputs
7. **Use React Query or SWR** for better data fetching and caching
8. **Implement optimistic updates** to reduce perceived latency
9. **Add error boundaries** to prevent full-page crashes
10. **Profile with React DevTools Profiler** to identify hotspots

---

## 🧪 Testing Performance Improvements

After implementing fixes, measure:

1. **Render count**: Use React DevTools Profiler
2. **Network requests**: Check Chrome DevTools Network tab
3. **Memory usage**: Chrome DevTools Memory tab
4. **FPS**: Chrome DevTools Performance tab
5. **Bundle size**: Use `webpack-bundle-analyzer`

---

## 📝 Implementation Priority

### Phase 1 (Immediate - 1-2 hours)
- [ ] Increase polling intervals
- [ ] Remove production console.logs
- [ ] Add useMemo to filter operations
- [ ] Fix useEffect dependencies

### Phase 2 (Short-term - 1 day)
- [ ] Consolidate timer effects
- [ ] Extract smaller components with React.memo
- [ ] Optimize JSON comparison

### Phase 3 (Medium-term - 1 week)
- [ ] Implement WebSocket for real-time updates
- [ ] Add virtualization for long lists
- [ ] Migrate to React Query/SWR
- [ ] Add loading skeletons

### Phase 4 (Long-term - ongoing)
- [ ] Continuous performance monitoring
- [ ] A/B testing optimizations
- [ ] Backend optimizations

---

## 📚 Additional Resources

- [React Performance Optimization](https://react.dev/learn/render-and-commit)
- [useMemo Hook](https://react.dev/reference/react/useMemo)
- [React.memo](https://react.dev/reference/react/memo)
- [React Query](https://tanstack.com/query/latest)
- [react-window](https://github.com/bvaughn/react-window)

---

**Generated:** $(date)
**Component:** RegisteredTeamDashboard.tsx
**Location:** /app/dashboard/team/RegisteredTeamDashboard.tsx
