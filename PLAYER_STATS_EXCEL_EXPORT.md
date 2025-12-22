# Player Stats Excel Export Feature

## Overview
Added Excel export functionality to the Committee Player Stats page, allowing committee admins to download comprehensive player statistics in Excel format.

## Location
**Page**: `/dashboard/committee/team-management/player-stats`

## Features

### Export Button
- **Location**: Top right of the search/filter section
- **Icon**: Download icon with "Export Excel" text
- **Color**: Green button for easy identification
- **Functionality**: Exports currently filtered/sorted player data

### Excel File Contents

The exported Excel file includes the following columns:

1. **Rank** - Player ranking based on current sort
2. **Player Name** - Full player name
3. **Player ID** - Unique player identifier
4. **Team** - Team name
5. **Matches Played** - Total matches played
6. **Wins** - Number of wins
7. **Draws** - Number of draws
8. **Losses** - Number of losses
9. **Goals Scored** - Total goals scored
10. **Clean Sheets** - Matches with 0 goals conceded
11. **POTM Awards** - Player of the Match awards
12. **Win Rate (%)** - Win percentage (2 decimal places)
13. **Current Points** - Current season points
14. **Base Points** - Starting points from previous season
15. **Points Change** - Difference between current and base points
16. **Star Rating** - Player star rating (3-10)
17. **Category** - Legend or Classic category

### File Naming
Format: `{TournamentName}_Player_Stats_{YYYY-MM-DD}.xlsx`

Example: `SS_PES_Super_League_Player_Stats_2025-12-22.xlsx`

### Column Widths
Automatically optimized for readability:
- Player names: 25 characters wide
- Team names: 20 characters wide
- Stats columns: 8-15 characters wide
- IDs: 15 characters wide

## Usage

### For Committee Admins

1. **Navigate** to `/dashboard/committee/team-management/player-stats`
2. **Filter/Sort** the data as desired:
   - Use search to filter by player name, ID, or team
   - Click sort buttons to order by different stats
3. **Click** the green "Export Excel" button
4. **File downloads** automatically with all filtered data

### Export Respects Filters
- Only exports **currently visible** players
- Maintains the **current sort order**
- If you search for "Manchester", only Manchester players are exported
- If you sort by goals, Excel file will be sorted by goals

## Technical Implementation

### Dependencies
- Uses `xlsx` library (dynamically imported)
- No additional dependencies needed (already in project)

### Code Location
- **File**: `app/dashboard/committee/team-management/player-stats/page.tsx`
- **Function**: `exportToExcel()`
- **Button**: In search/filter section

### Dynamic Import
```typescript
const XLSX = await import('xlsx');
```
This ensures the xlsx library is only loaded when needed, reducing initial page load time.

## Use Cases

### 1. Season Reports
Export all player stats at end of season for archival

### 2. Performance Analysis
Export and analyze in Excel with pivot tables, charts, etc.

### 3. Team Comparisons
Filter by team and export for team-specific analysis

### 4. Top Performers
Sort by goals/wins/points and export top performers

### 5. Sharing with Stakeholders
Easy to share Excel files with team owners, sponsors, etc.

## Example Workflow

### Export Top Scorers
1. Click "Sort by Goals" (descending)
2. Click "Export Excel"
3. Result: Excel file with players sorted by goals scored

### Export Specific Team
1. Search for team name (e.g., "Manchester United")
2. Click "Export Excel"
3. Result: Excel file with only Manchester United players

### Export High Win Rate Players
1. Click "Sort by Win%" (descending)
2. Click "Export Excel"
3. Result: Excel file with players sorted by win percentage

## Benefits

✅ **Easy Data Analysis** - Open in Excel for advanced analysis
✅ **Offline Access** - View stats without internet connection
✅ **Sharing** - Easy to email or share with others
✅ **Archival** - Keep historical records of player performance
✅ **Reporting** - Create custom reports and presentations
✅ **Filtering** - Export only the data you need
✅ **Professional** - Clean, formatted Excel files

## Future Enhancements

Potential improvements:
- Add charts/graphs to Excel file
- Multiple sheets (overview, detailed stats, team breakdown)
- Custom column selection
- Export to CSV option
- Scheduled automatic exports
- Email export functionality

## Support

If you encounter issues:
1. Check browser console for errors
2. Ensure xlsx library is installed: `npm install xlsx`
3. Try with different browsers
4. Check file download permissions

## Related Features

- **Player Stats Page**: Main stats display
- **Team Standings**: Team-level statistics
- **Tournament Selector**: Filter by tournament
- **Search/Filter**: Find specific players
