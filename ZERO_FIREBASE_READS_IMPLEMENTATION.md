# Zero Firebase Reads Implementation Guide

## 🎯 Goal
Eliminate **3,000+ Firebase reads/hour** by using JWT custom claims instead of database reads for authentication.

---

## ✅ Solution Overview

### Current Problem (❌)
```typescript
// Every API call reads from Firebase
const userDoc = await adminDb.collection('users').doc(userId).get(); // 🔴 FIREBASE READ
const role = userDoc.data()?.role;
```

### New Solution (✅)
```typescript
// JWT token already contains the role - zero DB reads!
const auth = await verifyAuth(['admin', 'committee_admin']); // ✅ ZERO READS
const role = auth.role; // Already in the token!
```

---

## 📋 Implementation Steps

### Step 1: Set Custom Claims (One-Time Setup)

Run the migration script to add roles to JWT tokens:

```bash
node scripts/set-user-custom-claims.js
```

**What this does:**
- Reads all users from Firestore `users` collection
- Sets `role` as a custom claim in Firebase Auth
- Future JWT tokens will contain the role automatically

**Important:** Users need to refresh their tokens (re-login or token refresh) to get the new claims.

---

### Step 2: Updated `verifyAuth` Helper

The `lib/auth-helper.ts` file has been updated to:

✅ **Verify JWT token** (validates signature, not a DB read)  
✅ **Extract role from custom claims** (already in token)  
✅ **Check role permissions** (if required)

**Usage:**
```typescript
import { verifyAuth } from '@/lib/auth-helper';

// Verify with role check
const auth = await verifyAuth(['admin', 'committee_admin'], request);
if (!auth.authenticated) {
  return NextResponse.json(
    { success: false, error: auth.error || 'Unauthorized' },
    { status: 401 }
  );
}

// Now use auth.userId and auth.role without any DB reads!
```

---

### Step 3: Fix All 47 API Endpoints

Replace the old Firebase read pattern with `verifyAuth()`.

#### ❌ Old Pattern (Remove):
```typescript
import { getAuthToken } from '@/lib/auth/token-helper';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

const token = await getAuthToken(request);
const decodedToken = await adminAuth.verifyIdToken(token);
const userId = decodedToken.uid;

// 🔴 FIREBASE READ ON EVERY REQUEST
const userDoc = await adminDb.collection('users').doc(userId).get();
const userData = userDoc.data();
if (userData?.role !== 'admin') {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
}
```

#### ✅ New Pattern (Add):
```typescript
import { verifyAuth } from '@/lib/auth-helper';

// ✅ NO DATABASE READ - Uses JWT claims
const auth = await verifyAuth(['admin', 'committee_admin'], request);
if (!auth.authenticated) {
  return NextResponse.json(
    { success: false, error: auth.error || 'Unauthorized' },
    { status: 401 }
  );
}
```

---

## 📝 Files to Update

### ✅ Already Fixed:
1. `lib/auth-helper.ts` - Updated to use JWT claims
2. `app/api/admin/tiebreakers/route.ts` - Test endpoint fixed

### 🔨 To Fix (46 files):

See `FIREBASE_READS_COMPLETE_FIX_LIST.md` for the complete list.

**Priority order:**
1. **Critical (High Traffic):**
   - `/app/api/admin/bulk-tiebreakers/route.ts`
   - `/app/api/team/dashboard/route.ts`
   - `/app/api/team/bulk-rounds/[id]/bids/route.ts`

2. **Admin endpoints (19 files)**
3. **Team endpoints (11 files)**
4. **Other endpoints (14 files)**

---

## 🔄 Future: Keep Custom Claims Updated

When user roles change, update the custom claim:

```typescript
import { adminAuth } from '@/lib/firebase/admin';

// When updating user role in Firestore
await adminDb.collection('users').doc(userId).update({ role: 'admin' });

// Also update the custom claim
await adminAuth.setCustomUserClaims(userId, { role: 'admin' });
```

**Add this to:**
- User registration endpoints
- Role update endpoints
- Admin user management pages

---

## 📊 Expected Impact

### Before:
- 47 endpoints × 50-100 requests/hour = **2,000-4,000 Firebase reads/hour**
- Pages with polling (every 5-10s) = **3,000+ reads/hour**

### After:
- **0 Firebase reads** for authentication
- JWT validation is instant and free
- Only notification subscriptions remain (~50 reads/hour)

### Total Reduction:
- **95-98% reduction**
- From 3,000 reads/hour → **50-100 reads/hour**

---

## ✅ Testing Checklist

### 1. Test the Fixed Endpoint
```bash
# Start dev server
npm run dev

# Test tiebreakers endpoint (already fixed)
curl http://localhost:3000/api/admin/tiebreakers \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 2. Check Firebase Console
- Go to Firebase Console → Firestore → Usage tab
- Monitor read operations
- Should see dramatic drop after deployment

### 3. Verify Functionality
- [ ] Committee admins can access admin endpoints
- [ ] Team users can access team endpoints
- [ ] Unauthorized users get 401 errors
- [ ] No Firebase reads for auth (check console)

---

## 🚨 Important Notes

### Custom Claims Limitations:
- **Max size:** 1000 bytes (roles are tiny, no problem)
- **Propagation:** New claims appear in next token refresh
- **Cache:** Tokens are cached for 1 hour by default

### Force Token Refresh:
If you update claims and need immediate effect:

**Client-side (users need to run):**
```typescript
// Force token refresh
await currentUser.getIdToken(true); // true = force refresh
```

Or simply ask users to **log out and log back in**.

---

## 🎯 Next Steps

1. **Run migration script** (Step 1)
2. **Test tiebreakers endpoint** (already fixed)
3. **If working:** Fix remaining 46 endpoints
4. **Deploy and monitor** Firebase usage

Expected time: **2-3 hours** to fix all endpoints (mostly find-and-replace)

---

## 💡 Benefits Summary

✅ **Zero Firebase reads** for authentication  
✅ **Instant** role verification (no network calls)  
✅ **Future-proof** - works for all new endpoints  
✅ **Simple** - one helper function for all auth  
✅ **Scalable** - JWT tokens are designed for this  

**Result:** 95-98% reduction in Firebase reads = massive cost savings! 🎉
