# Logo Display Fix - Team Dashboard & Profile

## Issue
The team logo was not being displayed from the `team_seasons` collection in the dashboard and profile pages. Instead, it was only showing the logo from the user context (which may be outdated).

## Changes Made

### 1. Profile Page (`app/dashboard/team/profile/page.tsx`)
**Updated:** The `fetchProfileData` function now fetches the team name and logo from `team_seasons` collection.

**Changes:**
- Added Firebase imports for Firestore operations
- Query `team_seasons` collection for the current team's registered season
- Use `team_logo` from `team_seasons` if available, fall back to `user.logoUrl`
- Use `team_name` from `team_seasons` if available, fall back to `user.teamName`

**Lines affected:** 50-81

### 2. Team Dashboard Unregistered View (`app/dashboard/team/page.tsx`)
**Updated:** The unregistered team dashboard now displays the logo from `team_seasons`.

**Changes:**
- Added new state variable `teamLogoUrl` to store the fetched logo URL
- Modified `checkSeasonStatus` function to fetch and store the team logo from `team_seasons`
- Updated the team header section to display the logo image if available, otherwise show the initial letter

**Lines affected:** 
- State declaration: 18
- Logo fetching: 48-54
- Logo display: 139-149

### 3. Registered Team Dashboard API (`app/api/team/dashboard/route.ts`)
**Already Correct:** The API route was already correctly configured to fetch the logo from `team_seasons`.

**Current behavior:**
- Line 58: `logo_url: teamSeasonData?.team_logo || userData?.logoUrl || null`
- This correctly prioritizes `team_logo` from `team_seasons`, then falls back to `userData.logoUrl`

### 4. Registered Team Dashboard Component (`app/dashboard/team/RegisteredTeamDashboard.tsx`)
**Already Correct:** This component already displays `team.logo_url` which comes from the API.

**Current behavior:**
- Line 725: Displays the logo using `team.logo_url` from the dashboard data
- The dashboard data comes from the API which correctly fetches from `team_seasons`

## How It Works Now

### Data Flow:
1. **Team Profile Edit Page** → Updates both `users.logoUrl` AND `team_seasons.team_logo`
2. **Profile Page** → Fetches logo from `team_seasons.team_logo` (priority), falls back to `users.logoUrl`
3. **Team Dashboard (Unregistered)** → Fetches logo from `team_seasons.team_logo` when checking season status
4. **Team Dashboard (Registered)** → API fetches logo from `team_seasons.team_logo` (priority), falls back to `users.logoUrl`

### Priority Order:
All pages now follow this priority:
1. First: `team_seasons.team_logo` (most recent, season-specific)
2. Fallback: `users.logoUrl` (global team logo)
3. Final fallback: Default placeholder with team initial

## Testing Recommendations

1. **Test logo update:** 
   - Go to `/dashboard/team/profile/edit`
   - Upload a new team logo
   - Verify it appears on:
     - Profile page (`/dashboard/team/profile`)
     - Team dashboard (`/dashboard/team`)
     - Registered dashboard (if in active season)

2. **Test fallback behavior:**
   - Team with `team_seasons.team_logo` set → Should show this logo
   - Team without `team_seasons.team_logo` but with `users.logoUrl` → Should show user logo
   - Team with neither → Should show team initial in colored circle

3. **Test across seasons:**
   - When team registers for a new season, logo should persist
   - When team updates logo, it should update across all team_seasons entries

## Files Modified
- `app/dashboard/team/profile/page.tsx`
- `app/dashboard/team/page.tsx`

## Files Already Correct (No changes needed)
- `app/api/team/dashboard/route.ts`
- `app/dashboard/team/RegisteredTeamDashboard.tsx`
- `app/dashboard/team/profile/edit/page.tsx`
