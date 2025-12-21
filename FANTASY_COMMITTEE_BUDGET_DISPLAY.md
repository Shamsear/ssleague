# Fantasy Committee Teams - Budget Display Added

## Overview
Added budget remaining display to the committee fantasy teams page so admins can see each team's available budget.

## Changes Made

### Frontend (`app/dashboard/committee/fantasy/teams/[leagueId]/page.tsx`)

1. **Updated FantasyTeam Interface**
   - Added `budget_remaining?: number` field

2. **Added Budget Display**
   - New stat card showing "Budget Remaining"
   - Color-coded display:
     - Green: Positive budget (€X > 0)
     - Red: Negative budget (€X < 0)
     - Gray: Zero budget (€0)
   - Format: "€XM" (e.g., "€25M")

3. **UI Location**
   - Displayed alongside Total Points, Players, and Rank
   - Shows when a team is selected from the teams list
   - Uses flex-wrap for responsive layout

### Backend (`app/api/fantasy/leagues/[leagueId]/route.ts`)

1. **Updated SQL Query**
   - Added `COALESCE(ft.budget_remaining, 0) as budget_remaining` to SELECT
   - Added `ft.budget_remaining` to GROUP BY clause

2. **Updated Response Mapping**
   - Added `budget_remaining: Number(team.budget_remaining) || 0` to teams array

## Display Example

```
Team Stats:
┌─────────────────┬──────────┬────────┬──────────────────┐
│ Total Points    │ Players  │ Rank   │ Budget Remaining │
│ 245             │ 15       │ #3     │ €25M             │
└─────────────────┴──────────┴────────┴──────────────────┘
```

## Benefits
- Committee admins can monitor team budgets
- Helps identify teams with budget issues
- Useful for transfer window management
- Provides transparency in fantasy league finances

## Testing
1. Navigate to `/dashboard/committee/fantasy/teams/SSPSLFLS16`
2. Select any team from the list
3. Budget remaining should display in the stats section
4. Color should reflect budget status (green/red/gray)
