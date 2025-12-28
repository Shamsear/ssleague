# Player Awards System - Dual Table Support

## Overview
The player awards system now supports **two different database tables** based on the season:

- **Season 16 and above**: Awards stored in `awards` table
- **Season 15 and below**: Awards stored in `player_awards` table

## Changes Made

### 1. API Endpoint Update (`/api/player-awards/route.ts`)

**Key Logic:**
```typescript
const getSeasonNumber = (seasonId: string | null): number => {
  if (!seasonId) return 0;
  const match = seasonId.match(/\d+/);
  return match ? parseInt(match[0]) : 0;
};

const seasonNumber = getSeasonNumber(seasonId);
const useNewAwardsTable = seasonNumber >= 16;
```

**Query Mapping:**
- **Season 16+**: Queries `awards` table and maps fields to match `player_awards` structure
- **Season 15-**: Queries `player_awards` table directly

**Field Mapping for New Table:**
```sql
SELECT 
  award_type as award_category,  -- Award name (e.g., "POTM", "Golden Boot")
  'individual' as award_type_legacy,
  NULL as award_position,
  NULL as player_category,
  round_number,
  week_number,
  ...
FROM awards
```

### 2. TypeScript Interface Update (`hooks/usePlayerAwards.ts`)

**Updated Interface:**
```typescript
export interface PlayerAward {
  id: number | string;
  player_id: string;
  player_name?: string;
  season_id: string;
  
  // Fields from both tables
  award_category?: string;  // Award name (new) or "category"/"individual" (old)
  award_type?: string;      // Award name (old) or award type (new)
  
  // Old table specific
  award_position?: string | null;
  player_category?: string | null;
  awarded_by?: string | null;
  
  // New table specific
  round_number?: number | null;
  week_number?: number | null;
  team_id?: string | null;
  team_name?: string | null;
  
  // Common fields
  performance_stats?: Record<string, any> | null;
  notes?: string | null;
  created_at?: Date;
  updated_at?: Date;
}
```

### 3. Player Page Display Update (`app/players/[id]/page.tsx`)

**Detection Logic:**
```typescript
// Determine which table structure this award is from
const isNewTable = award.round_number !== undefined || award.week_number !== undefined;

// For new table: award_category contains the award name
// For old table: award_type contains the award name
const awardName = isNewTable ? award.award_category : award.award_type;
const awardTypeCategory = isNewTable ? 'individual' : award.award_category;
```

**Display Differences:**
- **New Table Awards**: Show round/week number with calendar icon
- **Old Table Awards**: Show player category with trophy icon
- Both show performance stats and notes

## Table Structure Comparison

### Old Table (`player_awards`) - Season 15 and below
```
- award_type: "Golden Boot", "Best Defender", etc.
- award_category: "category" or "individual"
- award_position: "winner", "runner-up", etc.
- player_category: Category name
- awarded_by: Who gave the award
```

### New Table (`awards`) - Season 16 and above
```
- award_type: "POTM", "Golden Boot", etc. (mapped to award_category)
- round_number: Round number (if applicable)
- week_number: Week number (if applicable)
- team_id: Team ID
- team_name: Team name
- No award_position field (all are winners)
```

## How It Works

1. **User navigates to player page** (`/players/sspslpsl0079`)
2. **Selects a season tab** (e.g., "Season 16")
3. **API determines table** based on season number:
   - Season 16+ → Query `awards` table
   - Season 15- → Query `player_awards` table
4. **Data is normalized** to common interface
5. **Display adapts** based on which table the data came from

## Example Queries

### For Season 16 Player
```sql
SELECT 
  award_type as award_category,
  round_number,
  week_number,
  performance_stats,
  notes
FROM awards
WHERE player_id = 'sspslpsl0079' AND season_id = 'SSPSLS16'
```

### For Season 15 Player
```sql
SELECT 
  award_type,
  award_category,
  award_position,
  player_category,
  performance_stats,
  notes
FROM player_awards
WHERE player_id = 'sspslpsl0079' AND season_id = 'SSPSLS15'
```

## Benefits

✅ **Backward Compatibility**: Old seasons still work perfectly
✅ **Forward Compatibility**: New seasons use the improved awards table
✅ **Seamless UX**: Users see awards regardless of which table they're stored in
✅ **Proper Field Mapping**: Award names display correctly from both tables
✅ **Additional Context**: Round/week numbers shown for new table awards

## Testing

To test the implementation:
1. Navigate to `/players/sspslpsl0079`
2. Click on a Season 15 or below tab → Should show awards from `player_awards`
3. Click on Season 16 or above tab → Should show awards from `awards`
4. Verify award names, categories, and metadata display correctly
