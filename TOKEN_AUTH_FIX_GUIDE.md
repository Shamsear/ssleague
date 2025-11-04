# Token Authentication Fix Guide

## ✅ Already Fixed (5 pages)
1. `/dashboard/team/transactions/page.tsx`
2. `/dashboard/committee/contracts/mid-season-salary/page.tsx`
3. `/dashboard/committee/contracts/reconcile/page.tsx`
4. `/dashboard/committee/contracts/expire/page.tsx`
5. `/dashboard/committee/salary-transactions/page.tsx`

## 🔧 How to Fix Any Page

### Step 1: Add Import
Add this line after other imports at the top of the file:
```typescript
import { fetchWithTokenRefresh } from '@/lib/token-refresh';
```

### Step 2: Replace fetch calls
Replace:
```typescript
const response = await fetch('/api/some-endpoint', options);
```

With:
```typescript
const response = await fetchWithTokenRefresh('/api/some-endpoint', options);
```

### Step 3: Keep `/api/auth/set-token` as regular fetch
DO NOT change calls to `/api/auth/set-token` - they should remain as `fetch()`:
```typescript
await fetch('/api/auth/set-token', { ... }); // Keep as is
```

## 📋 Priority List to Fix

### High Priority (Committee Pages)
These pages are used by committee admins and need immediate fixing:

- [ ] `/dashboard/committee/awards/page.tsx`
- [ ] `/dashboard/committee/rounds/page.tsx`
- [ ] `/dashboard/committee/bulk-rounds/[id]/page.tsx`
- [ ] `/dashboard/committee/players/transfers/page.tsx`
- [ ] `/dashboard/committee/database/page.tsx`
- [ ] `/dashboard/committee/player-ratings/page.tsx`
- [ ] `/dashboard/committee/real-players/page.tsx`
- [ ] `/dashboard/committee/real-players/[id]/page.tsx`
- [ ] `/dashboard/committee/real-players/assign/page.tsx`
- [ ] `/dashboard/committee/trophies/page.tsx`
- [ ] `/dashboard/committee/team-management/tournament/page.tsx`
- [ ] `/dashboard/committee/team-management/match-days/page.tsx`
- [ ] `/dashboard/committee/lineup-history/page.tsx`
- [ ] `/dashboard/committee/lineups/page.tsx`

### Medium Priority (Team Pages)
- [ ] `/dashboard/team/fixtures/page.tsx`
- [ ] `/dashboard/team/fixtures/[fixtureId]/page.tsx`
- [ ] `/dashboard/team/lineups/page.tsx`
- [ ] `/dashboard/team/players/[playerId]/page.tsx`
- [ ] `/dashboard/team/page.tsx`

### Low Priority (Fantasy & Others)
- [ ] All `/dashboard/fantasy/*` pages
- [ ] `/dashboard/superadmin/*` pages

## 🚀 Quick Fix Script for VS Code

1. Open Find & Replace (Ctrl+H)
2. Enable Regex mode
3. Find: `await fetch\(([^)]+)\)`
4. Replace: `await fetchWithTokenRefresh($1)`
5. Check each replacement manually before confirming

## ⚠️ Important Notes

1. **Don't replace external URLs**: Only replace calls to `/api/` endpoints
2. **Don't replace `/api/auth/set-token`**: This is used by the token refresh system itself
3. **Check HTTP methods**: Works for GET, POST, PUT, DELETE - all methods are supported
4. **Test after fixing**: Verify the page loads and API calls work properly

## 🎯 What fetchWithTokenRefresh Does

- Automatically adds Firebase auth token to requests
- If token expires (401 error), it:
  - Refreshes the token automatically
  - Retries the request with new token
  - Updates the cookie in background
- Prevents "Invalid token" and "Unauthorized" errors

## 📝 Example Fix

### Before:
```typescript
const loadData = async () => {
  const response = await fetch('/api/some-data');
  const data = await response.json();
};
```

### After:
```typescript
import { fetchWithTokenRefresh } from '@/lib/token-refresh';

const loadData = async () => {
  const response = await fetchWithTokenRefresh('/api/some-data');
  const data = await response.json();
};
```

## ✨ Benefits

- ✅ No more "Invalid token" errors
- ✅ No more "Unauthorized" errors  
- ✅ Seamless token refresh
- ✅ Better user experience
- ✅ Automatic retry on auth failure
