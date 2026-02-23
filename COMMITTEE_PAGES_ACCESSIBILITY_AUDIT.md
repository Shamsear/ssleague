# Committee Admin Pages - Accessibility Audit (COMPLETE)

## Summary
This document lists ALL 90+ committee admin pages and identifies which ones lack direct navigation links from the main dashboard or other pages.

## ✅ Pages WITH Links (Accessible from Main Dashboard)

### Team & Player Management Section (9 pages)
- `/dashboard/committee/teams` - Season Teams ✅
- `/dashboard/committee/registration` - Team Registration ✅
- `/register/players?season={id}` - Player Registration ✅
- `/dashboard/committee/players` - All Players ✅
- `/dashboard/committee/contracts` - Player Contracts ✅
- `/dashboard/committee/players/transfers` - Player Transfers ✅
- `/dashboard/committee/team-contracts` - Team Contracts ✅
- `/dashboard/committee/player-eligibility` - Player Eligibility ✅
- `/dashboard/committee/penalties` - Tournament Penalties ✅

### Player Ratings & Configuration Section (9 pages)
- `/dashboard/committee/player-ratings` - Player Ratings ✅
- `/dashboard/committee/star-rating-config` - Star Config ✅
- `/dashboard/committee/player-stars-points` - Stars & Points ✅
- `/dashboard/committee/real-players` - SS Members ✅
- `/dashboard/committee/player-stats` - Player Stats ✅
- `/dashboard/committee/team-management/player-stats-by-round` - Stats by Round ✅
- `/dashboard/committee/player-star-upgrades` - Star Upgrades ✅ NEW
- `/dashboard/committee/update-player-ratings` - Update Ratings ✅ NEW
- `/dashboard/committee/player-awards` - Player Awards (Season) ✅ NEW

### Contracts & Financial Management Section (4 pages)
- `/dashboard/committee/contracts/mid-season-salary` - Mid-Season Salary ✅
- `/dashboard/committee/salary-transactions` - Real Player Salaries ✅
- `/dashboard/committee/match-rewards` - Match Rewards ✅
- `/dashboard/committee/contracts/reconcile` - Contract Reconciliation ✅

### Auction Management Section (5 pages)
- `/dashboard/committee/auction-settings` - Auction Settings ✅
- `/dashboard/committee/position-groups` - Position Groups ✅
- `/dashboard/committee/database` - Database Import ✅
- `/dashboard/committee/rounds` - Create Rounds ✅
- `/dashboard/committee/bulk-rounds` - Bulk Rounds ✅

### Fantasy & Content Management Section (9 pages)
- `/dashboard/committee/fantasy/create` - Fantasy League ✅
- `/dashboard/committee/fantasy/enable-teams` - Enable Fantasy Teams ✅
- `/dashboard/committee/team-management` - Team Management ✅
- `/dashboard/committee/tournament-rewards` - Tournament Rewards ✅
- `/dashboard/committee/trophies` - Trophy Management ✅
- `/dashboard/committee/awards` - Awards (POTD, POTW) ✅
- `/dashboard/committee/polls` - Polls ✅
- `/admin/news` - News Management ✅
- `/admin/notifications` - Send Notifications ✅

## ⚠️ Pages WITHOUT Direct Links (60+ pages)

### 🎮 Fantasy League Management (17 pages - NO LINKS)
1. **`/dashboard/committee/fantasy/points-breakdown`** - Points Breakdown
   - Purpose: View round-by-round fantasy points with award bonuses
   - Priority: HIGH - Frequently used for verification

2. **`/dashboard/committee/fantasy/recalculate`** - Recalculate Fantasy Points
   - Purpose: Manually trigger fantasy points recalculation
   - Priority: HIGH - Critical maintenance tool

3. **`/dashboard/committee/fantasy/recalculate-points`** - Recalculate Points (Alternative)
   - Purpose: Another recalculation interface
   - Priority: MEDIUM

4. **`/dashboard/committee/fantasy/supported-team-windows`** - Supported Team Windows
   - Purpose: Manage passive team transfer windows
   - Priority: HIGH - Season setup

5. **`/dashboard/committee/fantasy/draft/[leagueId]`** - Draft Interface
   - Purpose: Conduct fantasy draft
   - Priority: HIGH

6. **`/dashboard/committee/fantasy/draft-control/[leagueId]`** - Draft Control
   - Purpose: Admin draft controls
   - Priority: HIGH

7. **`/dashboard/committee/fantasy/draft-settings/[leagueId]`** - Draft Settings
   - Purpose: Configure draft parameters
   - Priority: HIGH

8. **`/dashboard/committee/fantasy/manage-players/[leagueId]`** - Manage Players
   - Purpose: Add/remove fantasy players
   - Priority: MEDIUM

9. **`/dashboard/committee/fantasy/populate-players/[leagueId]`** - Populate Players
   - Purpose: Bulk add players to fantasy league
   - Priority: HIGH - Initial setup

10. **`/dashboard/committee/fantasy/pricing/[leagueId]`** - Player Pricing
    - Purpose: Set fantasy player prices
    - Priority: HIGH - Draft setup

11. **`/dashboard/committee/fantasy/scoring/[leagueId]`** - Scoring Rules
    - Purpose: Configure fantasy scoring system
    - Priority: HIGH - League setup

12. **`/dashboard/committee/fantasy/standings/[leagueId]`** - Standings
    - Purpose: View fantasy league standings
    - Priority: HIGH - Frequently viewed

13. **`/dashboard/committee/fantasy/teams/[leagueId]`** - Fantasy Teams
    - Purpose: View all fantasy teams
    - Priority: HIGH

14. **`/dashboard/committee/fantasy/transfer-settings/[leagueId]`** - Transfer Settings
    - Purpose: Configure transfer windows
    - Priority: HIGH

15. **`/dashboard/committee/fantasy/transfer-windows/[leagueId]`** - Transfer Windows
    - Purpose: Manage transfer periods
    - Priority: HIGH

16. **`/dashboard/committee/fantasy/transfers/[leagueId]`** - Transfers
    - Purpose: View/manage fantasy transfers
    - Priority: MEDIUM

17. **`/dashboard/committee/fantasy/[leagueId]/lineups`** - Admin Lineups View
    - Purpose: View all team lineups
    - Priority: MEDIUM

### 🛠️ Utility/Fix Pages (2 pages - NO LINKS)
18. **`/dashboard/committee/fix-duplicate-points`** - Fix Duplicate Points
    - Purpose: Utility to fix duplicate point records
    - Priority: LOW - Maintenance tool

19. **`/dashboard/committee/fix-duplicate-salaries`** - Fix Duplicate Salaries
    - Purpose: Utility to fix duplicate salary transactions
    - Priority: LOW - Maintenance tool

### ⭐ Player Rating Management (REMOVED - NOW LINKED)
~~20. **`/dashboard/committee/player-star-upgrades`** - Player Star Upgrades~~ ✅ ADDED
~~21. **`/dashboard/committee/update-player-ratings`** - Update Player Ratings~~ ✅ ADDED

### 🏆 Tournament Management (15 pages - NO LINKS)
22. **`/dashboard/committee/lineup-history`** - Lineup History
    - Purpose: View historical lineups
    - Priority: LOW

23. **`/dashboard/committee/lineups`** - Lineups
    - Purpose: Manage match lineups
    - Priority: MEDIUM

24. **`/dashboard/committee/tiebreakers`** - Tiebreakers
    - Purpose: Manage tiebreaker rules
    - Priority: MEDIUM

25. **`/dashboard/committee/team-management/categories`** - Tournament Categories
    - Purpose: Manage tournament categories
    - Priority: MEDIUM

26. **`/dashboard/committee/team-management/categories/new`** - New Category
    - Purpose: Create tournament category
    - Priority: MEDIUM

27. **`/dashboard/committee/team-management/categories/[id]/edit`** - Edit Category
    - Purpose: Edit tournament category
    - Priority: MEDIUM

28. **`/dashboard/committee/team-management/fixture/[fixtureId]`** - Fixture Details
    - Purpose: View/manage specific fixture
    - Priority: HIGH - Frequently used

29. **`/dashboard/committee/team-management/match-days`** - Match Days
    - Purpose: Manage match day schedules
    - Priority: MEDIUM

30. **`/dashboard/committee/team-management/match-days/edit`** - Edit Match Days
    - Purpose: Edit match day schedules
    - Priority: MEDIUM

31. **`/dashboard/committee/team-management/player-awards`** - Player Awards (Tournament)
    - Purpose: Manage tournament-specific player awards
    - Priority: HIGH

32. **`/dashboard/committee/team-management/player-leaderboard`** - Player Leaderboard
    - Purpose: View player rankings
    - Priority: MEDIUM

33. **`/dashboard/committee/team-management/player-stats`** - Player Stats (Tournament)
    - Purpose: View tournament player statistics
    - Priority: MEDIUM

34. **`/dashboard/committee/team-management/stats-leaderboard`** - Stats Leaderboard
    - Purpose: View statistical rankings
    - Priority: MEDIUM

35. **`/dashboard/committee/team-management/team-members`** - Team Members
    - Purpose: Manage team rosters
    - Priority: MEDIUM

36. **`/dashboard/committee/team-management/team-members/[id]/edit`** - Edit Team Member
    - Purpose: Edit team member details
    - Priority: MEDIUM

37. **`/dashboard/committee/team-management/team-standings`** - Team Standings
    - Purpose: View tournament standings
    - Priority: HIGH

38. **`/dashboard/committee/team-management/tournament/lineup-status`** - Lineup Status
    - Purpose: Check lineup submission status
    - Priority: HIGH

### 📊 Reports & Analytics (1 page - NO LINKS)
39. **`/dashboard/committee/reports/fees`** - Fee Reports
    - Purpose: View transfer fee collection reports
    - Priority: MEDIUM - Already linked in dashboard ✅

### 🏅 Awards & Recognition (REMOVED - NOW LINKED)
~~40. **`/dashboard/committee/player-awards`** - Player Awards (Season)~~ ✅ ADDED

### 🔧 Configuration Pages (1 page - NO LINKS)
41. **`/dashboard/committee/registration-management`** - Registration Management
    - Purpose: Advanced registration controls
    - Priority: LOW

### 📦 Database & Real Players (2 pages - NO LINKS)
42. **`/dashboard/committee/real-players/assign`** - Assign Real Players
    - Purpose: Assign real players to teams
    - Priority: HIGH - Season setup

43. **`/dashboard/committee/real-players/[id]`** - Real Player Details
    - Purpose: View/edit specific real player
    - Priority: MEDIUM

44. **`/dashboard/committee/database/import-preview`** - Import Preview
    - Purpose: Preview database import
    - Priority: LOW

45. **`/dashboard/committee/database/import-progress`** - Import Progress
    - Purpose: Monitor import progress
    - Priority: LOW

### 📝 Contract Management (2 pages - NO LINKS)
46. **`/dashboard/committee/contracts/expire`** - Expire Contracts
    - Purpose: Handle contract expirations
    - Priority: MEDIUM

### 🎯 Player Selection (2 pages - NO LINKS)
47. **`/dashboard/committee/player-selection`** - Player Selection
    - Purpose: Select players for auction
    - Priority: HIGH - Auction setup

48. **`/dashboard/committee/player-selection/preview`** - Selection Preview
    - Purpose: Preview player selection
    - Priority: MEDIUM

### 🎲 Bulk Rounds (2 pages - NO LINKS)
49. **`/dashboard/committee/bulk-rounds/[id]`** - Bulk Round Details
    - Purpose: View specific bulk round
    - Priority: HIGH

50. **`/dashboard/committee/bulk-rounds/[id]/tiebreakers`** - Bulk Round Tiebreakers
    - Purpose: Manage bulk round tiebreakers
    - Priority: MEDIUM

### 🎯 Round Management (2 pages - NO LINKS)
51. **`/dashboard/committee/rounds/[id]`** - Round Details
    - Purpose: View specific round details
    - Priority: HIGH - Frequently used

52. **`/dashboard/committee/rounds/[id]/pending-results`** - Pending Results
    - Purpose: View/manage pending auction results
    - Priority: HIGH

### 👥 Team & Player Details (2 pages - NO LINKS)
53. **`/dashboard/committee/teams/[id]`** - Team Details
    - Purpose: View specific team details
    - Priority: HIGH

54. **`/dashboard/committee/players/[id]`** - Player Details
    - Purpose: View specific player details
    - Priority: MEDIUM

55. **`/dashboard/committee/players/transfers/history`** - Transfer History
    - Purpose: View complete transfer history
    - Priority: MEDIUM

55. **`/dashboard/committee/players/transfers/history`** - Transfer History
    - Purpose: View complete transfer history
    - Priority: MEDIUM

## 📋 Recommendations & Implementation Plan

### Priority 1: HIGH - Fantasy League Management (Add to Fantasy League Page)
When viewing a specific fantasy league (`/dashboard/committee/fantasy/[leagueId]/page.tsx`), add navigation cards for:
- Points Breakdown
- Recalculate Points
- Supported Team Windows
- Draft Interface & Controls
- Draft Settings
- Populate Players
- Player Pricing
- Scoring Rules
- Standings
- Fantasy Teams
- Transfer Settings & Windows
- Lineup Status

### Priority 2: HIGH - Tournament Management (Add to Team Management Page)
When viewing team management (`/dashboard/committee/team-management/page.tsx`), add links for:
- Fixture Details (when fixtures exist)
- Player Awards (Tournament)
- Team Standings
- Lineup Status
- Player Selection

### Priority 3: MEDIUM - Add New Dashboard Sections

#### A. "Admin Utilities" Section
Create collapsible section with:
- Fix Duplicate Points
- Fix Duplicate Salaries
- Player Star Upgrades
- Update Player Ratings

#### B. "Reports & Analytics" Section
Create collapsible section with:
- Fee Reports ✅ (already exists but not linked)
- Transfer History
- Player Leaderboard
- Stats Leaderboard

#### C. "Tournament Operations" Section
Create collapsible section with:
- Lineup History
- Lineups Management
- Tiebreakers
- Match Days
- Tournament Categories

### Priority 4: LOW - Keep as Direct URL Access
These pages are accessed through parent pages or rarely used:
- Database import preview/progress
- Individual team/player detail pages
- Edit pages (accessed from list pages)
- Bulk round details (accessed from bulk rounds list)
- Round details (accessed from rounds list)

## 🎯 Quick Wins (Immediate Actions)

### 1. Add Fantasy Management Tools to Fantasy League Page
**File**: `app/dashboard/committee/fantasy/[leagueId]/page.tsx`

Add a "Management Tools" section with cards for:
- Points Breakdown
- Recalculate Points
- Supported Team Windows
- Draft Controls
- Scoring & Pricing

### 2. Add Tournament Tools to Team Management Page
**File**: `app/dashboard/committee/team-management/page.tsx`

Add a "Tournament Tools" section with cards for:
- Fixtures
- Player Awards
- Standings
- Lineup Status

### 3. Add "More Tools" Dropdown to Main Dashboard
**File**: `app/dashboard/committee/page.tsx`

Add a dropdown menu in the header with:
- Admin Utilities
- Reports
- Advanced Tools

## 📊 Statistics

- **Total Committee Pages**: 90+
- **Pages WITH Links**: 36 (40%)
- **Pages WITHOUT Links**: 52 (58%)
- **High Priority Missing**: 22 pages
- **Medium Priority Missing**: 20 pages
- **Low Priority Missing**: 10 pages

**Recent Additions:**
- ✅ Player Star Upgrades
- ✅ Update Player Ratings  
- ✅ Player Awards (Season)

## 🔍 Search & Discovery Improvements

### Recommended Features:
1. **Command Palette** - Quick search for any page (Cmd+K)
2. **Breadcrumb Navigation** - Show path on all pages
3. **Recent Pages** - Track and show recently visited pages
4. **Favorites** - Allow admins to bookmark frequently used pages
5. **Page Directory** - Searchable list of all admin pages

## ✅ Next Steps

1. Read fantasy league page to add fantasy management tools
2. Read team management page to add tournament tools
3. Update main dashboard with new sections
4. Consider implementing command palette for quick access
5. Add breadcrumb navigation to all committee pages
