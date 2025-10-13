# Next.js 15 Cookies API Fix

## Issue
In Next.js 15, dynamic APIs like `cookies()`, `headers()`, and `draftMode()` have been made asynchronous. Accessing them synchronously now causes errors.

### Error Message
```
Error: Route "/api/team/dashboard" used `cookies().get('session')`. 
`cookies()` should be awaited before using its value.
```

## Root Cause
The `cookies()` function from `next/headers` is now an async function and must be awaited before accessing its methods.

## Solution

### Before (Next.js 14 and earlier)
```typescript
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  const cookieStore = cookies();  // ❌ Synchronous access
  const session = cookieStore.get('session')?.value;
  // ...
}
```

### After (Next.js 15)
```typescript
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();  // ✅ Async access with await
  const session = cookieStore.get('session')?.value;
  // ...
}
```

## Files Fixed

1. **`app/api/team/dashboard/route.ts`**
   - Line 8: Added `await` to `cookies()` call
   - Used to fetch team dashboard data with session authentication

2. **`app/api/team/players/route.ts`**
   - Line 8: Added `await` to `cookies()` call
   - Used to fetch team player data with session authentication

## Already Compliant Files

The following files were already using `await cookies()` correctly:
- `app/api/auth/clear-token/route.ts`
- `app/api/auth/set-token/route.ts`
- `app/api/team/season-status/route.ts`

## Testing

After the fix, the following endpoints should work without errors:
- `GET /api/team/dashboard?season_id=<season_id>`
- `GET /api/team/players`

## Related APIs

The same async pattern applies to other dynamic Next.js APIs:

### Headers
```typescript
const headersList = await headers();
const userAgent = headersList.get('user-agent');
```

### Draft Mode
```typescript
const { isEnabled } = await draftMode();
```

### Params (in Server Components and Route Handlers)
```typescript
// In Server Components
async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <div>ID: {id}</div>;
}
```

## Automatic Migration

Next.js provides a codemod to automatically fix these issues:

```bash
npx @next/codemod@canary next-async-request-api .
```

## References

- [Next.js 15 Upgrade Guide - Dynamic APIs](https://nextjs.org/docs/messages/sync-dynamic-apis)
- [Next.js 15 Release Notes](https://nextjs.org/blog/next-15)

## Prevention

To prevent this issue in the future:
1. Always use TypeScript to catch type errors
2. Enable ESLint with Next.js rules
3. Test API routes after upgrading Next.js versions
4. Run the Next.js codemod after major version upgrades

## Status

✅ **Fixed** - All `cookies()` calls in the codebase now properly await the Promise.
