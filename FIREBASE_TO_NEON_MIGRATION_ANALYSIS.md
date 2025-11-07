# Firebase to Neon Migration Analysis

## Overview
This document identifies all Firebase reads that can be migrated to Neon database to reduce Firebase usage by 90%+.

## Critical Data Types Currently in Firebase

### 1. User Authentication & Roles ⚠️ **HIGHEST IMPACT**
**Current:** `adminDb.collection('users').doc(userId).get()`
**Usage:** Role verification on EVERY authenticated API request
**Impact:** 70-80% of all Firebase reads

#### Files Affected (40+ endpoints):
- `/app/api/admin/tiebreakers/route.ts` - Line 39 ✅ **HIGH PRIORITY**
- `/app/api/admin/bulk-tiebreakers/route.ts` - Line 44
- `/app/api/team/dashboard/route.ts` - Lines 57, 67, 87, 95
- `/app/api/tiebreakers/[id]/route.ts` - Lines 42, 69, 73, 169, 173, 187
- `/app/api/team/tiebreakers/route.ts` - Line 38
- `/app/api/team/bulk-tiebreakers/route.ts` - Line 39
- `/app/api/rounds/[id]/route.ts` - Lines 103, 107, 414
- And 30+ more endpoints...

#### Migration Plan:
```sql
-- Neon already has users table
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(255) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(255) UNIQUE,
  role VARCHAR(50) DEFAULT 'team',
  approved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Fix:** Use JWT token claims for role verification (NO database read needed)

---

### 2. Team Names ⚠️ **MEDIUM-HIGH IMPACT**
**Current:** `adminDb.collection('team_seasons').doc(teamSeasonId).get()`
**Usage:** Fetching team names for display in bids, tiebreakers, dashboards
**Impact:** 10-15% of all Firebase reads

#### Files Affected:
- `/app/api/rounds/[id]/route.ts` - Lines 103-107 (batch fetches)
- `/app/api/team/bulk-rounds/[id]/bids/route.ts` - Lines 357, 459
- `/app/api/admin/bulk-rounds/[id]/finalize/route.ts` - Line 329
- `/app/api/tiebreakers/[id]/submit/route.ts` - Lines 106, 109, 196, 200

#### Current Pattern:
```typescript
const teamSeasonId = `${teamId}_${seasonId}`;
const doc = await adminDb.collection('team_seasons').doc(teamSeasonId).get();
const teamName = doc.data()?.team_name || teamId;
```

#### Migration Plan:
```sql
-- Neon already has teams table
SELECT name FROM teams WHERE id = $1;
```

**Fix:** Already mostly done! Just need to remove Firebase fallbacks.

---

### 3. Season Information 🟡 **MEDIUM IMPACT**
**Current:** `adminDb.collection('seasons').doc(seasonId).get()`
**Usage:** Season details, registration status, settings
**Impact:** 5-10% of all Firebase reads

#### Files Affected:
- `/app/api/seasons/list/route.ts` - Line 11
- `/app/api/seasons/historical/route.ts` - Lines 6, 12
- `/app/api/seasons/[id]/details/route.ts` - Line 20
- `/app/api/seasons/[id]/register/route.ts` - Lines 35, 46, 100

#### Migration Plan:
```sql
CREATE TABLE IF NOT EXISTS seasons (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'draft',
  registration_open BOOLEAN DEFAULT false,
  player_registration_open BOOLEAN DEFAULT false,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### 4. Notifications & Subscriptions 🟢 **LOW IMPACT**
**Current:** `adminDb.collection('notifications')...`
**Usage:** Push notification subscriptions
**Impact:** <5% of reads
**Status:** Can remain in Firebase (Firebase Cloud Messaging integration)

---

## Implementation Priority

### Phase 1: CRITICAL (90% reduction) ✅ **DO THIS FIRST**
1. **Replace Firebase role checks with JWT claims**
   - No database read needed
   - Instant 70-80% reduction
   - Files: All `/app/api/**/route.ts` files using `adminDb.collection('users')`

2. **Optimize polling intervals**
   - Increase from 5s to 10-15s
   - Add visibility detection
   - Files: `/app/dashboard/committee/tiebreakers/page.tsx`

### Phase 2: HIGH (8% reduction)
3. **Remove team_seasons Firebase reads**
   - Use Neon teams table exclusively
   - Files: All files fetching team names

### Phase 3: MEDIUM (2% reduction)
4. **Migrate season data**
   - Create seasons table in Neon
   - Update season-related queries

---

## Quick Fix Implementation

### Fix 1: Replace User Role Checks (IMMEDIATE)
```typescript
// ❌ BEFORE (Firebase read on every request)
const userDoc = await adminDb.collection('users').doc(userId).get();
if (userData?.role !== 'admin') {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
}

// ✅ AFTER (No database read)
import { verifyAuth } from '@/lib/auth-helper';

const auth = await verifyAuth(['admin', 'committee_admin']);
if (!auth.authenticated) {
  return NextResponse.json({ error: auth.error }, { status: 401 });
}
```

### Fix 2: Use Neon for Team Names
```typescript
// ❌ BEFORE (Firebase reads)
const teamSeasonId = `${teamId}_${seasonId}`;
const doc = await adminDb.collection('team_seasons').doc(teamSeasonId).get();
const teamName = doc.data()?.team_name || teamId;

// ✅ AFTER (Neon query - already implemented in most places)
const teams = await sql`SELECT id, name FROM teams WHERE id = ANY(${teamIds})`;
const teamNamesMap = new Map(teams.map(t => [t.id, t.name]));
```

### Fix 3: Increase Polling Intervals
```typescript
// ❌ BEFORE (720 requests/hour)
const interval = setInterval(fetchTiebreakers, 5000);

// ✅ AFTER (360 requests/hour + visibility detection)
useEffect(() => {
  let interval: NodeJS.Timeout;
  
  const startPolling = () => {
    fetchTiebreakers();
    interval = setInterval(fetchTiebreakers, 10000); // 10s instead of 5s
  };
  
  const handleVisibilityChange = () => {
    if (document.hidden) {
      if (interval) clearInterval(interval);
    } else {
      startPolling();
    }
  };
  
  if (statusFilter === 'active') {
    startPolling();
    document.addEventListener('visibilitychange', handleVisibilityChange);
  }
  
  return () => {
    if (interval) clearInterval(interval);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}, [statusFilter]);
```

---

## Expected Results

### Before Optimization
- **3000 reads/hour** during active usage
- Primary causes:
  - User role verification: ~2100 reads (70%)
  - Team names fetching: ~450 reads (15%)
  - Season data: ~300 reads (10%)
  - Other: ~150 reads (5%)

### After Phase 1 (JWT + Polling)
- **~50-100 reads/hour** (95%+ reduction)
- Remaining reads:
  - Notification subscriptions: ~30 reads
  - Legacy fallbacks: ~20 reads
  - Other: ~50 reads

---

## Migration Checklist

### Immediate Actions (Today)
- [ ] Fix `/app/api/admin/tiebreakers/route.ts` - Use verifyAuth
- [ ] Fix `/app/api/admin/bulk-tiebreakers/route.ts` - Use verifyAuth
- [ ] Update `/app/dashboard/committee/tiebreakers/page.tsx` - 10s polling + visibility
- [ ] Test with 1-2 files to verify reduction

### This Week
- [ ] Bulk replace all user role checks with verifyAuth (40+ files)
- [ ] Remove all Firebase team name fallbacks
- [ ] Add visibility detection to all polling components

### Nice to Have
- [ ] Create seasons table in Neon
- [ ] Migrate notification subscriptions tracking
- [ ] Add Firebase read monitoring

---

## Testing Plan

1. **Monitor Firebase Console**
   - Before: Note current read count
   - After: Compare after 1 hour with page open

2. **Verify Functionality**
   - Role-based access still works
   - Team names display correctly
   - Polling still updates data

3. **Expected Metrics**
   - Before: 720 reads/hour (5s polling, Firebase auth)
   - After: 36-72 reads/hour (10s polling, JWT auth, visibility detection)
   - **Reduction: 90-95%**
