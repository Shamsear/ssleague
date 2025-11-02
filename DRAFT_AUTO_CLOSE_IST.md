# Draft Auto-Close System with IST Timezone

## Overview

The draft auto-close system works identically to the lineup deadline system, using **Indian Standard Time (IST, UTC+5:30)** for all time-based operations.

## How It Works

### 1. **Time Storage (Database)**
- PostgreSQL stores timestamps in UTC with timezone information (`TIMESTAMP WITH TIME ZONE`)
- When committee sets `draft_closes_at`, the system stores it as UTC internally
- Example: Setting "2:30 PM IST" stores as "9:00 AM UTC"

### 2. **Time Comparison (Server)**
- The auto-close API (`/api/fantasy/draft/auto-close`) compares times using JavaScript Date objects
- Both `now` and `draft_closes_at` are moments in time (internally UTC)
- Comparison: `new Date() > new Date(draft_closes_at)` works correctly regardless of timezone

### 3. **Time Display (Client)**
- All times are displayed to users in **IST timezone** using:
  ```javascript
  new Date(timestamp).toLocaleString('en-IN', { 
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short'
  })
  ```
- Users in any timezone will see times converted to IST
- " IST" suffix is added to make it clear

### 4. **Auto-Close Trigger**
- When any user visits the draft page, the `useAutoCloseDraft` hook runs
- It checks if `draft_closes_at` deadline has passed
- If yes, calls `/api/fantasy/draft/auto-close` to update status to 'closed'
- No cron jobs needed - happens automatically when users visit

## Components

### 1. **API Endpoint**: `/app/api/fantasy/draft/auto-close/route.ts`
```typescript
// Checks if draft_closes_at has passed
const now = new Date();
const closingTime = new Date(league.draft_closes_at);
if (now > closingTime) {
  // Auto-close the draft
  await sql`UPDATE fantasy_leagues SET draft_status = 'closed' ...`;
}
```

### 2. **React Hook**: `hooks/useAutoCloseDraft.ts`
```typescript
export function useAutoCloseDraft(leagueId?: string, closingTime?: string) {
  // Automatically calls auto-close API when deadline passes
  // Runs once when component mounts
}
```

### 3. **Draft Page**: `app/dashboard/team/fantasy/draft/page.tsx`
```typescript
// Use the hook to auto-close when deadline passes
useAutoCloseDraft(
  myTeam?.fantasy_league_id,
  draftSettings?.draft_closes_at || undefined
);
```

### 4. **Draft Control Page**: `app/dashboard/committee/fantasy/draft-control/[leagueId]/page.tsx`
- Committee sets opening/closing times using browser's local datetime picker
- System automatically handles timezone conversion
- Displays guidance about IST timezone

## Key Features

### ✅ **IST Display**
- All deadline times shown to users include " IST" suffix
- Uses `Asia/Kolkata` timezone for consistent display
- Example: "11 Jan 2025, 2:30 PM IST"

### ✅ **Auto-Close**
- Draft automatically closes when `draft_closes_at` time passes
- Works when any user visits the draft page
- No manual intervention needed

### ✅ **Correct Timezone Handling**
- Database stores UTC timestamps
- JavaScript Date comparisons work correctly
- Display layer converts to IST for users

### ✅ **Browser Compatibility**
- `datetime-local` input in draft control page uses browser's local timezone
- System converts and stores correctly
- Committee members can set times in their preferred timezone
- All users see times in IST

## Example Flow

1. **Committee sets closing time**: "January 15, 2025 at 11:59 PM IST"
2. **Database stores**: `2025-01-15 18:29:00+00` (UTC)
3. **User in USA visits draft page**: Sees "15 Jan 2025, 11:59 PM IST"
4. **User in India visits draft page**: Sees "15 Jan 2025, 11:59 PM IST"
5. **At 11:59:01 PM IST**: Next user to visit triggers auto-close
6. **Draft status**: Changes from 'active' to 'closed'
7. **All users**: Can no longer draft players

## Comparison with Lineup Deadline

| Feature | Lineup Deadline | Draft Auto-Close |
|---------|----------------|------------------|
| Timezone | IST (UTC+5:30) | IST (UTC+5:30) |
| Storage | Firebase/Neon UTC | Neon UTC |
| Display | Asia/Kolkata | Asia/Kolkata |
| Auto-trigger | `useAutoLockLineups` | `useAutoCloseDraft` |
| API endpoint | `/api/lineups/auto-lock` | `/api/fantasy/draft/auto-close` |
| Action | Lock lineups | Close draft |

## Important Notes

1. **No Server Timezone Dependency**: The system doesn't rely on server timezone settings
2. **Moment in Time**: All comparisons use "moment in time" concept, which is timezone-agnostic
3. **Display Only**: IST is used only for display purposes to users
4. **Browser Input**: `datetime-local` inputs work in any timezone, system handles conversion
5. **Consistent Experience**: All users see the same absolute deadline time in IST

## Testing

To test the system:
1. Set draft closing time to 2 minutes in the future
2. Visit draft page as a team user
3. Wait for deadline to pass
4. Refresh the page
5. Draft should auto-close and show "Draft Period Ended" banner
