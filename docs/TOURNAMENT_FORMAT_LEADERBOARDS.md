# Tournament Format-Aware Leaderboards Implementation

## Overview
Updated team leaderboard pages to properly support all tournament formats:
- ⚽ **League Only** - Traditional points-based standings
- ⚽🥇 **League + Knockout** - League standings with playoff bracket
- 🏆 **Group Stage Only** - Separate group standings
- 🏆🥇 **Group Stage + Knockout** - Group standings with qualification indicators + bracket
- 🥇 **Pure Knockout** - Bracket visualization only

## What Was Changed

### 1. API Route - `/api/tournaments/[id]/standings/route.ts`
**Enhanced to detect tournament format and return appropriate data:**

```typescript
// Now returns format-specific data
{
  success: true,
  format: 'league' | 'group_stage' | 'knockout',
  has_knockout: boolean,
  standings?: TeamStats[],           // For league format
  groupStandings?: GroupStandings,   // For group stage
  knockoutFixtures?: KnockoutRounds  // For knockout stages
}
```

**Key Functions Added:**
- `calculateLeagueStandings()` - Calculates traditional league table
- `calculateGroupStandings()` - Calculates per-group standings with qualification status
- `getKnockoutFixtures()` - Returns knockout bracket organized by rounds

### 2. New Reusable Components

#### `LeagueStandingsTable.tsx`
- Traditional league table display
- Shows: Rank, Team, MP, W, D, L, GF, GA, GD, PTS
- Features:
  - Highlights top 3 teams with medals 🥇🥈🥉
  - Optional playoff spot indicators
  - Current user team highlighting
  - Current leader card
  - Interactive sorting (can be added if needed)

#### `GroupStageStandings.tsx`
- Group-by-group standings display
- Features:
  - Tabbed navigation between groups
  - Qualification indicators (green highlighting)
  - Position-based sorting within groups
  - All groups overview cards
  - Shows which teams advance to knockout

#### `KnockoutBracket.tsx`
- Visual bracket display for knockout stages
- Features:
  - Organized by rounds (Final, Semi-Final, Quarter-Final, etc.)
  - Shows completed match scores
  - Winner indicators 🏆
  - TBD/pending match placeholders
  - Status badges (Completed, Scheduled, To Be Determined)
  - Responsive grid layout

#### `TournamentStandings.tsx` (Main Wrapper)
- Smart component that detects format and renders appropriate view
- Features:
  - Auto-detects tournament format from API
  - Tabs for combined formats (League+Knockout or Group+Knockout)
  - Format badge display
  - Loading and error states
  - Seamless switching between views

### 3. Updated Pages

#### Team Side: `/app/dashboard/team/team-leaderboard/page.tsx`
- Replaced hardcoded league table with `TournamentStandings` component
- Now automatically adapts to tournament format
- Passes current user ID for highlighting user's team

#### Committee Side: `/app/dashboard/committee/team-management/team-standings/page.tsx`
- Replaced hardcoded league table with `TournamentStandings` component
- Admin view of all standings/brackets
- No user highlighting (admin view)

## How It Works

### Format Detection Flow

1. **User visits leaderboard page**
2. **TournamentStandings component** fetches `/api/tournaments/{id}/standings`
3. **API checks tournament settings:**
   - `has_league_stage`
   - `has_group_stage`
   - `has_knockout_stage`
   - `is_pure_knockout`
4. **API returns format-specific data**
5. **Component renders appropriate view(s)**

### Combined Format Handling

For tournaments with multiple stages (e.g., League + Knockout):
- Component shows tabs to switch between views
- League/Group Stage shown in "Standings" tab
- Knockout bracket shown in "Knockout Stage" tab
- Format badge at bottom indicates tournament type

## Examples by Format

### League Only
```
⚽ League Standings
┌─────────────────────────────┐
│ League Table                │
│ Rank | Team | MP | W | D... │
│  🥇  | Team A | 10 | 8...   │
│  🥈  | Team B | 10 | 7...   │
└─────────────────────────────┘
```

### Group Stage + Knockout
```
Tabs: [🏆 Group Stage] [🥇 Knockout Stage]

Group Stage Tab:
┌─────────────────────────────┐
│ [Group A] [Group B] [Group C]│
│                             │
│ Group A Standings           │
│ Pos | Team | Pts | Status   │
│  1  | Team 1 | 9 | ✓ Qualified│
│  2  | Team 2 | 6 | ✓ Qualified│
└─────────────────────────────┘

Knockout Tab:
┌─────────────────────────────┐
│ ===== Final =====           │
│ [Winner vs Winner]          │
│                             │
│ === Semi-Final ===          │
│ [Team A vs Team B]          │
│ [Team C vs Team D]          │
└─────────────────────────────┘
```

### Pure Knockout
```
🥇 Knockout Stage
┌─────────────────────────────┐
│ ===== Final =====           │
│ Team A (2) 🏆 vs Team B (1) │
│                             │
│ === Semi-Final ===          │
│ Team A vs Team C - Scheduled│
│ Team B vs Team D - TBD      │
└─────────────────────────────┘
```

## Database Fields Used

From `tournaments` table:
- `has_league_stage` - Boolean, enables league format
- `has_group_stage` - Boolean, enables group stage format
- `has_knockout_stage` - Boolean, adds knockout stage
- `is_pure_knockout` - Boolean, true if only knockout (no league/group)
- `teams_advancing_per_group` - Number of teams that qualify from each group

From `fixtures` table:
- `group_name` - Present for group stage fixtures (e.g., "A", "B", "C")
- `knockout_round` - Present for knockout fixtures (e.g., "Final", "Semi-Final")

## Benefits

### For Users
✅ **Correct Display** - Each tournament format shows appropriate standings/brackets
✅ **Clear Qualification** - Easy to see who advances in group+knockout formats
✅ **Visual Brackets** - Knockout stages are visually represented
✅ **Context Aware** - Format badge shows tournament type

### For Developers
✅ **Reusable Components** - Each format has its own component
✅ **Single API Endpoint** - One endpoint handles all formats
✅ **Easy to Extend** - Add new formats by extending API logic
✅ **Type Safe** - TypeScript interfaces for all data structures

## Testing Checklist

- [ ] League-only tournament shows league table
- [ ] Group stage tournament shows groups with tabs
- [ ] Knockout tournament shows bracket
- [ ] League+Knockout shows both tabs correctly
- [ ] Group+Knockout shows both tabs correctly
- [ ] Team highlighting works (team side only)
- [ ] Qualification indicators show correctly
- [ ] Knockout bracket shows completed/pending matches
- [ ] Format badge displays correct format
- [ ] Loading states work
- [ ] Error states work
- [ ] Tournament selector updates views

## Future Enhancements

Possible additions:
- [ ] Two-legged knockout matches
- [ ] Third-place playoff match
- [ ] Head-to-head records in tiebreakers
- [ ] Form guide (last 5 matches)
- [ ] Live match indicators
- [ ] Downloadable brackets/standings
- [ ] Historical standings comparison
