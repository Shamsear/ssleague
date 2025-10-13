# Committee Teams Pages

This document describes the committee admin teams pages created for the Next.js application.

## Overview

Two pages have been created for committee admins to view and manage teams registered for their assigned season:

1. **Teams List Page** (`/dashboard/committee/teams`)
2. **Team Details Page** (`/dashboard/committee/teams/[id]`)

## Pages Created

### 1. Teams List Page
**Path:** `/dashboard/committee/teams`
**File:** `app/dashboard/committee/teams/page.tsx`

#### Features:
- Displays all teams registered for the committee admin's assigned season
- Shows team information including:
  - Team logo
  - Team name
  - Current balance
  - Player count
  - Active/Inactive status
- Responsive design with:
  - Desktop table view
  - Mobile card view
- Permission-based access control
- Links to individual team detail pages

#### Access Control:
- Only accessible by users with `committee_admin` role
- Automatically filters teams by the committee admin's assigned season
- Redirects unauthorized users

### 2. Team Details Page
**Path:** `/dashboard/committee/teams/[id]`
**File:** `app/dashboard/committee/teams/[id]/page.tsx`

#### Features:
- Displays detailed information about a specific team
- Shows:
  - Team logo and basic information (name, code, balance, status)
  - Financial overview (current balance, initial balance, total spent, avg player value)
  - Squad overview (total players, real players, football players, matches played)
  - Match statistics (won, drawn, lost, goals, points)
- Read-only view for committee admins
- Responsive design for all screen sizes
- Back navigation to teams list

#### Access Control:
- Only accessible by committee admins
- Verifies team belongs to admin's assigned season
- Shows error message if team not found or access denied

## Integration

### Dashboard Link
The main committee dashboard (`/dashboard/committee`) has been updated with a clickable card that links to the Season Teams page.

**Location:** Line 70-80 in `app/dashboard/committee/page.tsx`

## Technical Details

### Dependencies
Both pages use:
- `useAuth` - Authentication context
- `usePermissions` - Permission checking hooks
- `getTeamsBySeason` / `getTeamById` - Firebase team data functions
- Next.js `useRouter` and `useParams` for navigation
- Next.js `Link` component for client-side routing

### Data Flow
1. User navigates to teams page
2. Permission check verifies committee admin role
3. Gets user's assigned season ID from permissions
4. Fetches teams from Firebase filtered by season
5. Displays teams in responsive layout
6. User can click to view individual team details

### Error Handling
- Loading states during data fetch
- Error messages for:
  - No season assigned
  - Failed to load teams
  - Team not found
  - Unauthorized access
- Graceful fallbacks with user-friendly messages

## Styling

Both pages use the existing design system:
- Glass morphism effect (`glass` class)
- Gradient text for headings (`gradient-text` class)
- Primary color: `#0066FF`
- Responsive breakpoints (sm, md, lg)
- Hover effects and transitions
- Shadow and border effects

## Routes Created

| Route | Description |
|-------|-------------|
| `/dashboard/committee/teams` | List all teams for committee admin's season |
| `/dashboard/committee/teams/[id]` | View detailed information for a specific team |

## Usage

### For Committee Admins:
1. Log in with committee admin credentials
2. Navigate to Committee Dashboard
3. Click "Season Teams" card
4. View list of all teams in assigned season
5. Click "View" icon to see team details
6. Use "Back to Teams" link to return to list

### For Developers:
- Pages are client-side rendered (`'use client'`)
- Permission checks happen on every page load
- Data is fetched in real-time from Firebase
- All state management is handled with React hooks
- TypeScript types are imported from `@/types/team`

## Future Enhancements

Potential additions:
- Team editing capabilities (if committee admins should have edit permissions)
- Export team data to CSV/PDF
- Search and filter functionality
- Sorting options
- Pagination for large team lists
- Player roster details on team page
- Team performance analytics

## Notes

- These pages are view-only for committee admins
- Super admins have separate pages with full CRUD capabilities
- Team data is automatically filtered by season
- All financial values are displayed in GBP (£)
- Mobile responsiveness is prioritized
