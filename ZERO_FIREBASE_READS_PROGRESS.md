# Zero Firebase Reads - Implementation Progress

## ✅ Completed (13/47 endpoints)

### Admin Endpoints (11/19):
1. ✅ `/app/api/admin/tiebreakers/route.ts`
2. ✅ `/app/api/admin/bulk-tiebreakers/route.ts`
3. ✅ `/app/api/admin/bulk-tiebreakers/[id]/start/route.ts`
4. ✅ `/app/api/admin/bulk-tiebreakers/[id]/finalize/route.ts`
5. ✅ `/app/api/admin/bulk-tiebreakers/[id]/update-firebase/route.ts`
6. ✅ `/app/api/admin/bulk-rounds/route.ts` (POST + GET)
7. ✅ `/app/api/admin/bulk-rounds/[id]/start/route.ts`
8. ✅ `/app/api/admin/bulk-rounds/[id]/finalize/route.ts`
9. ✅ `/app/api/admin/rounds/[id]/finalize-preview/route.ts`
10. ✅ `/app/api/admin/rounds/[id]/finalize/route.ts`

### Team Endpoints (1/11):
11. ✅ `/app/api/team/dashboard/route.ts`

### Foundation:
- ✅ `lib/auth-helper.ts` - Updated to use JWT claims
- ✅ Custom claims migration script completed (23 users updated)

---

## 🔨 Remaining (34/47 endpoints)

### Admin Endpoints (8 remaining):
- [ ] `/app/api/admin/send-manual-notification/route.ts`
- [ ] `/app/api/admin/fix-budgets/route.ts`
- [ ] `/app/api/admin/fix-stuck-round/route.ts`
- [ ] `/app/api/admin/fix-owner-names/route.ts`
- [ ] `/app/api/admin/migrate-duplicate-stats/route.ts`
- [ ] `/app/api/admin/cleanup-dual-currency-legacy-fields/route.ts`
- [ ] `/app/api/admin/rounds/[id]/submissions/route.ts`

### Team Endpoints (10 remaining):
- [ ] `/app/api/team/tiebreakers/route.ts`
- [ ] `/app/api/team/players/route.ts`
- [ ] `/app/api/team/historical-stats/route.ts`
- [ ] `/app/api/team/bulk-tiebreakers/route.ts`
- [ ] `/app/api/team/bulk-tiebreakers/[id]/route.ts`
- [ ] `/app/api/team/bulk-tiebreakers/[id]/bid/route.ts`
- [ ] `/app/api/team/bulk-tiebreakers/[id]/withdraw/route.ts`
- [ ] `/app/api/team/bulk-rounds/[id]/route.ts`
- [ ] `/app/api/team/bulk-rounds/[id]/bids/route.ts`
- [ ] `/app/api/teams/[id]/all-seasons/route.ts`

### Tiebreaker Endpoints (3 remaining):
- [ ] `/app/api/tiebreakers/[id]/route.ts`
- [ ] `/app/api/tiebreakers/[id]/submit/route.ts`
- [ ] `/app/api/tiebreakers/[id]/resolve/route.ts`

### Contract Endpoints (4 remaining):
- [ ] `/app/api/contracts/assign/route.ts`
- [ ] `/app/api/contracts/assign-bulk/route.ts`
- [ ] `/app/api/contracts/mid-season-salary/route.ts`
- [ ] `/app/api/contracts/expire/route.ts`

### Season Endpoints (4 remaining):
- [ ] `/app/api/seasons/[id]/register/route.ts`
- [ ] `/app/api/seasons/historical/[id]/import/route.ts`
- [ ] `/app/api/seasons/historical/[id]/export/route.ts`
- [ ] `/app/api/seasons/historical/[id]/bulk-update/route.ts`

### Notification Endpoints (2 remaining):
- [ ] `/app/api/notifications/send/route.ts`
- [ ] `/app/api/notifications/users/route.ts`

### Fantasy Endpoints (2 remaining):
- [ ] `/app/api/fantasy/teams/my-team/route.ts`
- [ ] `/app/api/fantasy/teams/claim/route.ts`

### Auth Endpoints (2 remaining):
- [ ] `/app/api/auth/request-password-reset/route.ts`
- [ ] `/app/api/auth/username-to-email/route.ts`

### Other Endpoints (3 remaining):
- [ ] `/app/api/rounds/[id]/route.ts`
- [ ] `/app/api/migrate/create-team-documents/route.ts`
- [ ] `/app/api/test/season16-check/route.ts`

---

## 📋 Standard Fix Pattern

### 1. Update imports:
```typescript
// REMOVE:
import { getAuthToken } from '@/lib/auth/token-helper';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

// ADD:
import { verifyAuth } from '@/lib/auth-helper';
```

### 2. Replace auth logic:
```typescript
// REMOVE (30-40 lines):
const token = await getAuthToken(request);
const decodedToken = await adminAuth.verifyIdToken(token);
const userId = decodedToken.uid;
const userDoc = await adminDb.collection('users').doc(userId).get();
// ... role checks ...

// ADD (5 lines):
const auth = await verifyAuth(['admin', 'committee_admin'], request);
if (!auth.authenticated) {
  return NextResponse.json(
    { success: false, error: auth.error || 'Unauthorized' },
    { status: 401 }
  );
}
```

---

## 📊 Progress Statistics

- **Total endpoints:** 47
- **Fixed:** 13 (27.7%)
- **Remaining:** 34 (72.3%)
- **Estimated time:** 1-2 hours for remaining endpoints

---

## 🎯 Next Priority

Focus on high-traffic team endpoints:
1. `/app/api/team/tiebreakers/route.ts`
2. `/app/api/team/bulk-rounds/[id]/bids/route.ts`
3. `/app/api/team/bulk-tiebreakers/[id]/bid/route.ts`

Then systematically complete the rest.
