# Historical Season Player Statistics Import

## Overview
This document outlines all player statistics fields that are imported and stored when creating or editing historical seasons.

## Complete List of Statistics Fields

### Match Statistics
- **TOTAL MATCHES** (`matches_played`) - Total number of matches played
- **WIN** (`matches_won`) - Number of matches won
- **DRAW** (`matches_drawn`) - Number of matches drawn
- **LOSS** (`matches_lost`) - Number of matches lost

### Goal Statistics
- **GOALS SCORED** (`goals_scored`) - Total goals scored by the player
- **GOALS PER GAME** (`goals_per_game`) - Average goals scored per match (calculated)
- **GOALS CONCEDED** (`goals_conceded`) - Total goals conceded
- **CONCEDED PER GAME** (`conceded_per_game`) - Average goals conceded per match (calculated)
- **NET GOALS** (`net_goals`) - Goals scored minus goals conceded (calculated)

### Defense Statistics
- **CLEANSHEETS** (`clean_sheets`) - Number of clean sheets

### Points and Performance
- **POINTS** (`points`) - Points earned (3 × wins + 1 × draws)
- **TOTAL POINTS** (`total_points`) - Same as points (maintained for compatibility)
- **WIN RATE** (`win_rate`) - Percentage of matches won (calculated)

### Additional Statistics
- **ASSISTS** (`assists`) - Number of assists (preserved from existing data or defaults to 0)
- **AVERAGE RATING** (`average_rating`) - Average match rating (preserved from existing data or defaults to 0)

## Import Process

### 1. Creating New Historical Seasons
**Endpoint:** `/api/seasons/historical/import`

When importing a new historical season from an Excel file:
- All player statistics are extracted from the Excel "Players" sheet
- Statistics are stored in the `realplayers` collection with proper structure
- Calculated fields (goals_per_game, conceded_per_game, net_goals, win_rate) are computed automatically

### 2. Editing Existing Historical Seasons
**Endpoint:** `/api/seasons/historical/[id]/import`

When updating an existing historical season:
- All player statistics are updated or preserved
- Existing player records are matched by name
- New players are created with auto-generated IDs (`sspslpsl0001`, `sspslpsl0002`, etc.)
- Statistics from the import data override current values

## Data Structure in Firestore

Player documents in the `realplayers` collection contain a `stats` object with all fields:

```javascript
{
  player_id: "sspslpsl0001",
  name: "Player Name",
  team: "Team Name",
  category: "Category",
  season_id: "season_id_here",
  stats: {
    // Match Statistics
    matches_played: 10,
    matches_won: 7,
    matches_lost: 2,
    matches_drawn: 1,
    
    // Goal Statistics
    goals_scored: 15,
    goals_per_game: 1.50,
    goals_conceded: 5,
    conceded_per_game: 0.50,
    net_goals: 10,
    
    // Defense
    clean_sheets: 4,
    
    // Points
    points: 22,
    total_points: 22,
    
    // Performance
    win_rate: 70.00,
    assists: 3,
    average_rating: 7.5,
    
    // Current season tracking
    current_season_matches: 10,
    current_season_wins: 7
  }
}
```

## Excel Import Format

The Excel file should have a "Players" sheet with the following columns:

| Column Name | Description | Required |
|------------|-------------|----------|
| name | Player full name | ✅ Yes |
| team | Team name | ✅ Yes |
| category | Player category | ✅ Yes |
| goals_scored | Total goals scored | ✅ Yes |
| goals_per_game | Goals per game (can be calculated) | No |
| goals_conceded | Total goals conceded | ✅ Yes |
| conceded_per_game | Conceded per game (can be calculated) | No |
| net_goals | Net goals (can be calculated) | No |
| cleansheets | Number of clean sheets | ✅ Yes |
| points | Points earned | ✅ Yes |
| win | Matches won | ✅ Yes |
| draw | Matches drawn | ✅ Yes |
| loss | Matches lost | ✅ Yes |
| total_matches | Total matches played | ✅ Yes |
| total_points | Total points (same as points) | No |

## Calculations

The system automatically calculates the following derived statistics:

1. **Goals Per Game** = goals_scored ÷ total_matches
2. **Conceded Per Game** = goals_conceded ÷ total_matches
3. **Net Goals** = goals_scored - goals_conceded
4. **Win Rate** = (matches_won ÷ total_matches) × 100
5. **Total Points** = (matches_won × 3) + (matches_drawn × 1)

## Export Format

When exporting historical seasons, all these statistics are included in the Excel file with the same column structure, ensuring round-trip compatibility.

## Updates Made

### Files Modified
1. **`/app/api/seasons/historical/[id]/import/route.ts`**
   - Added all statistics fields to the import mapping
   - Added automatic calculation for derived statistics
   - Enhanced comments for clarity

2. **`/app/api/seasons/historical/import/route.ts`**
   - Updated player stats creation to include all fields
   - Added automatic calculation for derived statistics
   - Maintained backward compatibility with existing data

### Key Improvements
- ✅ All 12+ statistics fields are now properly imported
- ✅ Automatic calculation of derived metrics
- ✅ Backward compatibility maintained
- ✅ Existing player data is preserved and merged correctly
- ✅ Consistent data structure across all imports

## Testing Checklist

When testing the import functionality, verify:

- [ ] All statistics columns are read from Excel
- [ ] Calculated fields (goals_per_game, etc.) are computed correctly
- [ ] Existing players are updated without data loss
- [ ] New players are created with all statistics
- [ ] Export includes all statistics fields
- [ ] Round-trip import → export → import maintains data integrity

## Notes

- The export functionality already included all these fields, so the updates ensure import parity
- All numeric calculations use `parseFloat()` and `.toFixed(2)` for consistent precision
- Existing data (like assists, average_rating) is preserved when not provided in import
- The system handles both Excel file uploads and JSON preview imports
