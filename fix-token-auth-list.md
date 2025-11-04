# Dashboard Pages Needing Token Authentication Fix

## Critical Pages (Committee Admin - High Priority)
- ✅ `/dashboard/committee/contracts/mid-season-salary/page.tsx` - FIXED
- ✅ `/dashboard/committee/contracts/reconcile/page.tsx` - FIXED  
- ✅ `/dashboard/committee/contracts/expire/page.tsx` - FIXED
- ✅ `/dashboard/committee/salary-transactions/page.tsx` - FIXED
- `/dashboard/committee/awards/page.tsx`
- `/dashboard/committee/rounds/page.tsx`
- `/dashboard/committee/bulk-rounds/[id]/page.tsx`
- `/dashboard/committee/players/transfers/page.tsx`
- `/dashboard/committee/database/page.tsx`
- `/dashboard/committee/player-ratings/page.tsx`
- `/dashboard/committee/real-players/[id]/page.tsx`
- `/dashboard/committee/real-players/assign/page.tsx`
- `/dashboard/committee/real-players/page.tsx`
- `/dashboard/committee/trophies/page.tsx`
- `/dashboard/committee/team-management/tournament/page.tsx`
- `/dashboard/committee/team-management/match-days/page.tsx`
- `/dashboard/committee/team-management/match-days/edit/page.tsx`

## Team Pages (Medium Priority)
- ✅ `/dashboard/team/transactions/page.tsx` - FIXED
- `/dashboard/team/fixtures/page.tsx`
- `/dashboard/team/fixtures/[fixtureId]/page.tsx`
- `/dashboard/team/lineups/page.tsx`
- `/dashboard/team/players/[playerId]/page.tsx`

## Fantasy Pages (Low Priority)
- `/dashboard/fantasy/*` - Multiple fantasy pages

## Status Summary
- Fixed: 5 pages
- Remaining: ~50+ pages with API calls

## How to Fix
1. Add import: `import { fetchWithTokenRefresh } from '@/lib/token-refresh';`
2. Replace `await fetch(` with `await fetchWithTokenRefresh(`
3. Keep all other parameters the same
