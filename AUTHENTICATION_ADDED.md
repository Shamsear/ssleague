# Authentication Added to Contract API Routes

## ✅ What Was Done

Authentication has been successfully added to all 3 contract management API routes to ensure only authorized committee admins can perform these operations.

---

## 🔒 Protected Routes

### 1. `/api/contracts/assign`
**Purpose**: Assign real players with contracts to teams
**Access**: Committee Admin only

### 2. `/api/contracts/mid-season-salary`
**Purpose**: Process mid-season football player salary deductions
**Access**: Committee Admin only

### 3. `/api/contracts/expire`
**Purpose**: Expire contracts at season end
**Access**: Committee Admin only

---

## 🛡️ Security Implementation

### Authentication Flow

```typescript
1. Extract Firebase token from cookies
   ↓
2. Verify token with Firebase Admin
   ↓
3. Fetch user document from Firestore
   ↓
4. Check if user.role === 'committee_admin'
   ↓
5. Allow/Deny request
```

### Code Pattern Used

```typescript
// Get Firebase ID token from cookie
const cookieStore = await cookies();
const token = cookieStore.get('token')?.value;

if (!token) {
  return NextResponse.json(
    { error: 'Unauthorized - No token' },
    { status: 401 }
  );
}

// Verify Firebase ID token
let decodedToken;
try {
  decodedToken = await adminAuth.verifyIdToken(token);
} catch (err) {
  console.error('Token verification error:', err);
  return NextResponse.json(
    { error: 'Invalid token' },
    { status: 401 }
  );
}

// Check if user is committee admin
const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
const userData = userDoc.data();

if (!userData || userData.role !== 'committee_admin') {
  return NextResponse.json(
    { error: 'Unauthorized - Committee admin access required' },
    { status: 403 }
  );
}
```

---

## 🔑 HTTP Status Codes

| Code | Meaning | When It's Returned |
|------|---------|-------------------|
| 401 | Unauthorized | No token provided or invalid token |
| 403 | Forbidden | Valid token but user is not committee admin |
| 200 | Success | Request processed successfully |
| 400 | Bad Request | Missing required fields |
| 404 | Not Found | Resource not found |
| 500 | Server Error | Internal server error |

---

## 🧪 Testing Authentication

### Test 1: Unauthorized Access (No Token)
```bash
curl -X POST http://localhost:3001/api/contracts/assign \
  -H "Content-Type: application/json" \
  -d '{"teamId":"test","playerName":"John"}'

# Expected: 401 Unauthorized - No token
```

### Test 2: Invalid Token
```bash
curl -X POST http://localhost:3001/api/contracts/assign \
  -H "Content-Type: application/json" \
  -H "Cookie: token=invalid_token_here" \
  -d '{"teamId":"test","playerName":"John"}'

# Expected: 401 Invalid token
```

### Test 3: Valid Token, Wrong Role
```bash
# Login as regular team user, get token
# Then try to access admin endpoint

# Expected: 403 Unauthorized - Committee admin access required
```

### Test 4: Valid Committee Admin
```bash
# Login as committee admin, get valid token
curl -X POST http://localhost:3001/api/contracts/assign \
  -H "Content-Type: application/json" \
  -H "Cookie: token=valid_committee_admin_token" \
  -d '{
    "teamId": "team0001",
    "playerName": "John Doe",
    "auctionValue": 300,
    "starRating": 7,
    "startSeason": "Season 16",
    "endSeason": "Season 17",
    "salaryPerMatch": 2.1,
    "category": "legend"
  }'

# Expected: 200 Success with player data
```

---

## 👥 Role Requirements

### Committee Admin Role
**Database**: `users` collection → `role` field

**Valid Values**:
- `committee_admin` ✅ (has access)
- `super_admin` ❌ (no access - different permissions)
- `team` ❌ (no access - regular users)

**How to Set**:
```javascript
// In Firebase Console or via script
await adminDb.collection('users').doc(userId).update({
  role: 'committee_admin'
});
```

---

## 🔐 Additional Security Recommendations

### 1. Rate Limiting (Optional)
Consider adding rate limiting to prevent abuse:

```typescript
import { ratelimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown';
  const { success } = await ratelimit.limit(ip);
  
  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429 }
    );
  }
  
  // ... rest of code
}
```

### 2. Input Validation (Already Implemented)
All routes validate required fields:
- teamId
- seasonId
- playerName, auctionValue, starRating, etc.

### 3. Audit Logging (Optional)
Log all admin actions for security audit:

```typescript
await adminDb.collection('audit_logs').add({
  action: 'assign_player',
  performedBy: decodedToken.uid,
  teamId,
  playerName,
  timestamp: new Date(),
});
```

### 4. CORS Configuration (Production)
In production, configure CORS to only allow your domain:

```typescript
const allowedOrigins = ['https://yourdomain.com'];
const origin = request.headers.get('origin');

if (origin && allowedOrigins.includes(origin)) {
  headers.set('Access-Control-Allow-Origin', origin);
}
```

---

## 🎯 What's Protected

### Data That Requires Auth:
- ✅ Assigning real players to teams
- ✅ Deducting mid-season salaries
- ✅ Expiring contracts
- ✅ Modifying team balances
- ✅ Updating player contracts

### Data That's Still Public:
- ❌ Viewing season list
- ❌ Viewing team dashboard (requires team ownership)
- ❌ Viewing player statistics
- ❌ Public leaderboards

---

## 📝 Error Handling

All routes now return consistent error messages:

```json
// 401 - No token
{
  "error": "Unauthorized - No token"
}

// 401 - Invalid token
{
  "error": "Invalid token"
}

// 403 - Wrong role
{
  "error": "Unauthorized - Committee admin access required"
}

// 400 - Missing data
{
  "error": "Missing required fields"
}

// 404 - Not found
{
  "error": "Team not found"
}

// 500 - Server error
{
  "error": "Failed to assign player"
}
```

---

## ✅ Verification Checklist

- [x] All 3 API routes protected with authentication
- [x] Token verification using Firebase Admin
- [x] Role-based access control (committee_admin only)
- [x] Proper error messages and status codes
- [x] Consistent with existing API route patterns
- [x] No breaking changes to existing functionality

---

## 🎉 Summary

**Authentication Status**: ✅ COMPLETE

All contract management API routes are now secured and require:
1. Valid Firebase authentication token
2. Committee admin role

The system is production-ready with proper authentication and authorization! 🔒
