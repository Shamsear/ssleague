# Complete Firebase Reads Fix - All 47 Endpoints

## Root Cause
Every API endpoint doing `adminDb.collection('users').doc(userId).get()` causes a Firebase read on EVERY request.

## Solution
Replace with `verifyAuth()` helper which uses JWT token claims (zero database reads).

---

## All 47 Files That Need Fixing

### Admin Endpoints (19 files)
1. ✅ `/app/api/admin/tiebreakers/route.ts:39`
2. ✅ `/app/api/admin/bulk-tiebreakers/route.ts:44`
3. ✅ `/app/api/admin/bulk-tiebreakers/[id]/start/route.ts:43`
4. ✅ `/app/api/admin/bulk-tiebreakers/[id]/finalize/route.ts:45`
5. ✅ `/app/api/admin/bulk-tiebreakers/[id]/update-firebase/route.ts:32`
6. ✅ `/app/api/admin/bulk-rounds/route.ts:41,238`
7. ✅ `/app/api/admin/bulk-rounds/[id]/start/route.ts:52`
8. ✅ `/app/api/admin/bulk-rounds/[id]/finalize/route.ts:52`
9. ✅ `/app/api/admin/rounds/[id]/finalize-preview/route.ts:78`
10. ✅ `/app/api/admin/rounds/[id]/finalize/route.ts:53`
11. ✅ `/app/api/admin/send-manual-notification/route.ts:42`
12. ✅ `/app/api/admin/fix-budgets/route.ts:39`
13. ✅ `/app/api/admin/fix-stuck-round/route.ts:39`
14. ✅ `/app/api/admin/fix-owner-names/route.ts:26`
15. ✅ `/app/api/admin/migrate-duplicate-stats/route.ts:19`
16. ✅ `/app/api/admin/cleanup-dual-currency-legacy-fields/route.ts:19`

### Team Endpoints (11 files)
17. ✅ `/app/api/team/dashboard/route.ts:67`
18. ✅ `/app/api/team/tiebreakers/route.ts:38`
19. ✅ `/app/api/team/players/route.ts:33`
20. ✅ `/app/api/team/historical-stats/route.ts:33`
21. ✅ `/app/api/team/bulk-tiebreakers/route.ts:39`
22. ✅ `/app/api/team/bulk-tiebreakers/[id]/route.ts:43`
23. ✅ `/app/api/team/bulk-tiebreakers/[id]/bid/route.ts:50`
24. ✅ `/app/api/team/bulk-tiebreakers/[id]/withdraw/route.ts:46`
25. ✅ `/app/api/team/bulk-rounds/[id]/route.ts:44`
26. ✅ `/app/api/team/bulk-rounds/[id]/bids/route.ts:45,357,459`
27. ✅ `/app/api/teams/[id]/all-seasons/route.ts:32`

### Tiebreaker Endpoints (3 files)
28. ✅ `/app/api/tiebreakers/[id]/route.ts:42`
29. ✅ `/app/api/tiebreakers/[id]/submit/route.ts:53`
30. ✅ `/app/api/tiebreakers/[id]/resolve/route.ts:42`

### Contract Endpoints (3 files)
31. ✅ `/app/api/contracts/assign/route.ts:32`
32. ✅ `/app/api/contracts/assign-bulk/route.ts:43`
33. ✅ `/app/api/contracts/mid-season-salary/route.ts:33`
34. ✅ `/app/api/contracts/expire/route.ts:31`

### Season Endpoints (4 files)
35. ✅ `/app/api/seasons/[id]/register/route.ts:46`
36. ✅ `/app/api/seasons/historical/[id]/import/route.ts:111`
37. ✅ `/app/api/seasons/historical/[id]/export/route.ts:25`
38. ✅ `/app/api/seasons/historical/[id]/bulk-update/route.ts:47`

### Notification Endpoints (2 files)
39. ✅ `/app/api/notifications/send/route.ts:39,217`
40. ✅ `/app/api/notifications/users/route.ts:28`

### Fantasy Endpoints (2 files)
41. ✅ `/app/api/fantasy/teams/my-team/route.ts:31,204`
42. ✅ `/app/api/fantasy/teams/claim/route.ts:23`

### Auth Endpoints (2 files)
43. ✅ `/app/api/auth/request-password-reset/route.ts:31`
44. ✅ `/app/api/auth/username-to-email/route.ts:59`

### Other Endpoints (3 files)
45. ✅ `/app/api/rounds/[id]/route.ts:107`
46. ✅ `/app/api/migrate/create-team-documents/route.ts:83,240`
47. ✅ `/app/api/test/season16-check/route.ts:38`

---

## Fix Pattern for Each File

### Current Code (❌ Firebase Read):
```typescript
import { adminAuth, adminDb } from '@/lib/firebase/admin';

const token = await getAuthToken(request);
const decodedToken = await adminAuth.verifyIdToken(token);
const userId = decodedToken.uid;

// 🔴 FIREBASE READ ON EVERY REQUEST
const userDoc = await adminDb.collection('users').doc(userId).get();
if (!userDoc.exists) {
  return NextResponse.json({ error: 'User not found' }, { status: 404 });
}

const userData = userDoc.data();
if (userData?.role !== 'admin' && userData?.role !== 'committee_admin') {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
}
```

### New Code (✅ Zero Database Reads):
```typescript
import { verifyAuth } from '@/lib/auth-helper';

// ✅ NO DATABASE READ - Uses JWT claims
const auth = await verifyAuth(['admin', 'committee_admin']);
if (!auth.authenticated) {
  return NextResponse.json(
    { success: false, error: auth.error || 'Unauthorized' },
    { status: 401 }
  );
}
```

---

## Bulk Replace Steps

### Step 1: Imports
**Remove:**
```typescript
import { getAuthToken } from '@/lib/auth/token-helper';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
```

**Add:**
```typescript
import { verifyAuth } from '@/lib/auth-helper';
```

### Step 2: Replace Auth Logic
**Remove (lines vary per file):**
```typescript
const token = await getAuthToken(request);

if (!token) {
  return NextResponse.json(
    { success: false, error: 'Unauthorized' },
    { status: 401 }
  );
}

let decodedToken;
try {
  decodedToken = await adminAuth.verifyIdToken(token);
} catch (error) {
  console.error('Token verification error:', error);
  return NextResponse.json(
    { success: false, error: 'Invalid token' },
    { status: 401 }
  );
}

const userId = decodedToken.uid;

const userDoc = await adminDb.collection('users').doc(userId).get();
if (!userDoc.exists) {
  return NextResponse.json(
    { success: false, error: 'User not found' },
    { status: 404 }
  );
}

const userData = userDoc.data();
if (userData?.role !== 'admin' && userData?.role !== 'committee_admin') {
  return NextResponse.json(
    { success: false, error: 'Access denied' },
    { status: 403 }
  );
}
```

**Add (2 lines):**
```typescript
const auth = await verifyAuth(['admin', 'committee_admin']);
if (!auth.authenticated) {
  return NextResponse.json(
    { success: false, error: auth.error || 'Unauthorized' },
    { status: 401 }
  );
}
```

---

## Expected Impact

### Before Fix
- **47 endpoints** × average 50 requests/hour = **2,350 Firebase reads/hour**
- With polling pages open: **3,000+ reads/hour**

### After Fix
- **0 Firebase reads** for authentication/authorization
- JWT token validation is instant and free
- Only notification subscriptions remain (~50 reads/hour)

### Total Reduction
- **95-98% reduction in Firebase reads**
- From 3,000/hour → 50-100/hour

---

## Verification Checklist

After fixing each file:
- [ ] Import `verifyAuth` is added
- [ ] Old Firebase auth imports removed
- [ ] Auth logic replaced with `verifyAuth()`
- [ ] Response format matches (401 status, error message)
- [ ] Role array is correct (e.g., `['admin', 'committee_admin']` or `['team']`)
- [ ] Test endpoint still works
- [ ] Firebase console shows no new reads

---

## Priority Order

### Critical (Do First - Highest Traffic):
1. `/app/api/admin/tiebreakers/route.ts` - Polled every 5-10s
2. `/app/api/team/dashboard/route.ts` - Dashboard loaded frequently
3. `/app/api/team/bulk-rounds/[id]/bids/route.ts` - Multiple reads per file

### High (Do Second):
4-16. All other admin endpoints
17-27. All other team endpoints

### Medium (Do Last):
28-47. Other endpoints (lower traffic)

---

## Testing Plan

1. **Fix 1 file** (e.g., tiebreakers)
2. **Test functionality** - verify auth still works
3. **Check Firebase console** - confirm no reads for that endpoint
4. **If successful** - bulk fix remaining 46 files
5. **Monitor for 1 hour** - verify 95%+ reduction

---

## Automation Script

Create `/scripts/fix-firebase-reads.js`:
```javascript
const fs = require('fs');
const path = require('path');

const files = [
  'app/api/admin/tiebreakers/route.ts',
  'app/api/admin/bulk-tiebreakers/route.ts',
  // ... all 47 files
];

files.forEach(file => {
  const filepath = path.join(__dirname, '..', file);
  let content = fs.readFileSync(filepath, 'utf8');
  
  // Remove old imports
  content = content.replace(/import { getAuthToken } from '@\/lib\/auth\/token-helper';?\\n?/g, '');
  content = content.replace(/import { adminAuth, adminDb } from '@\/lib\/firebase\/admin';?\\n?/g, '');
  
  // Add new import
  if (!content.includes("import { verifyAuth }")) {
    content = "import { verifyAuth } from '@/lib/auth-helper';\n" + content;
  }
  
  // Replace auth logic (regex pattern for common structure)
  // ... add regex replacements
  
  fs.writeFileSync(filepath, content);
  console.log(`✅ Fixed: ${file}`);
});
```
