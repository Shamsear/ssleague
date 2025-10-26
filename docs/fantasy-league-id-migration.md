# Fantasy League ID Format Migration

## Overview
Migrated fantasy league ID format from `fantasy-SSPSLS{number}` to `SSPSLFLS{number}` for consistency.

## Old Format
- **Pattern**: `fantasy-SSPSLS16`
- **Example**: `fantasy-SSPSLS16`

## New Format
- **Pattern**: `SSPSLFLS{number}`
- **Example**: `SSPSLFLS16`
- **Breakdown**: 
  - `SSPSL` = SS PSL (prefix)
  - `F` = Fantasy
  - `L` = League
  - `S` = Season
  - `{number}` = Season number (e.g., 16)

## Changes Made

### 1. Database Migration Scripts
- **`scripts/migrate-teams-to-new-league.ts`**: Migrates fantasy_teams to new format
- **`scripts/migrate-all-league-references.ts`**: Updates all tables with league_id references
- **`scripts/check-fantasy-teams.ts`**: Verification script

### 2. API Endpoints Updated
- **`/api/fantasy/leagues/[leagueId]/route.ts`**
  - Removed old `fantasy-` format fallback logic
  - Auto-creation now uses `SSPSLFLS{number}` format
  - Query now searches by `league_id` or `season_id` only

- **`/api/fantasy/teams/enable-all/route.ts`**
  - Updated league_id generation from `fantasy-${season_id}` to `SSPSLFLS${seasonNumber}`
  - Updated both POST and GET methods

### 3. Tables Updated
All tables with `league_id` foreign keys were migrated:
- `fantasy_teams`
- `fantasy_players`
- `fantasy_drafts`
- `fantasy_squad`
- `transfer_windows`
- `fantasy_transfers`
- `fantasy_player_points`
- `fantasy_leaderboard`
- `fantasy_scoring_rules`
- `fantasy_leagues` (old format removed)

### 4. Frontend Updates
- **`/app/dashboard/committee/fantasy/create/page.tsx`**
  - Fixed league data extraction to properly display league_id
  - League check now correctly identifies existing leagues

## Verification

Run this command to verify all data uses the new format:
```bash
npx tsx scripts/check-fantasy-teams.ts
```

Expected output:
```
Found 2 fantasy teams:
Team ID: SSPSLT0013
League ID: SSPSLFLS16  ✅
---
Team ID: SSPSLT0018
League ID: SSPSLFLS16  ✅

Found 1 fantasy leagues:
League ID: SSPSLFLS16  ✅
Season ID: SSPSLS16
```

## Migration Steps for Future Seasons

When creating a new fantasy league:
1. Season ID should be: `SSPSLS{number}`
2. League ID will be auto-generated as: `SSPSLFLS{number}`
3. No manual intervention needed - handled by auto-creation logic

## Breaking Changes
- Old format `fantasy-SSPSLS{number}` is no longer supported
- Any hardcoded references to old format must be updated
- Database records with old format have been migrated
