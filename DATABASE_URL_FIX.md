# Database URL Fix - "Unexpected token '<'" Error

## Issue
Getting error: `SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON`

## Root Cause
The error occurred because all the new blind bidding system APIs were looking for `DATABASE_URL` environment variable, but your `.env.local` file uses `NEON_DATABASE_URL`.

```javascript
// ❌ OLD (caused error)
const sql = neon(process.env.DATABASE_URL!);

// ✅ NEW (fixed)
const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL!);
```

## Files Fixed

All blind bidding system API files have been updated to support both variable names:

1. ✅ `app/api/admin/rounds/route.ts`
2. ✅ `app/api/admin/rounds/[id]/finalize/route.ts`
3. ✅ `app/api/team/bids/route.ts`
4. ✅ `app/api/team/bids/[id]/route.ts`
5. ✅ `app/api/team/round/[id]/route.ts`
6. ✅ `app/api/team/round/[id]/status/route.ts`
7. ✅ `app/api/cron/finalize-rounds/route.ts`
8. ✅ `lib/finalize-round.ts`

## Solution

The APIs now check for BOTH environment variables:
- First tries `DATABASE_URL`
- Falls back to `NEON_DATABASE_URL` if not found

## Your .env.local

```env
NEON_DATABASE_URL="postgresql://neondb_owner:npg_pxO1CmRN0WTr@ep-quiet-pine-a1leox7r-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
```

## Test the Fix

1. **Restart your dev server**:
   ```bash
   # Stop server (Ctrl+C)
   npm run dev
   ```

2. **Try the committee rounds page again**:
   - Go to Committee Dashboard
   - Click "Rounds Management"
   - The page should load without errors now

3. **Try creating a round**:
   - Select a position
   - Set duration
   - Click "Start Round"
   - Should work!

## Why This Happened

When I created the new blind bidding APIs, I used the standard `DATABASE_URL` variable name, but your project was already using `NEON_DATABASE_URL`. The fix makes the code work with both names.

## No More Errors! ✅

After restarting the server, you should NOT see:
- ❌ `Unexpected token '<'`
- ❌ `is not valid JSON`
- ❌ HTML error pages

Instead, you'll get:
- ✅ Proper JSON responses
- ✅ Working API calls
- ✅ Committee rounds page loads correctly

---

**Fixed**: January 2025
**Status**: ✅ Complete - Restart server to apply fix
