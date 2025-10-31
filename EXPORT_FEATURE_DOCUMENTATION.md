# Export to XLSX Feature - Registered Players

## Overview
Added export functionality to the registered players management page to export player details to an Excel (.xlsx) file.

## Location
`/register/players?season=SEASON_ID` → "Manage Players" tab

## Features

### Export Button
- **Location**: Top right of the "Registered Players" table header
- **Color**: Green button with download icon
- **Position**: Between search bar and delete button

### Exported Data Fields
The exported Excel file includes the following columns:

1. **#** - Row number (sequential)
2. **Name** - Player's full name
3. **Player ID** - Unique player identifier (e.g., sspslpsl001)
4. **Status** - Registration type:
   - "Confirmed" - Player has a confirmed slot
   - "Waitlist" - Player is on the waitlist
5. **Registration Date** - Date and time of registration (IST format)
6. **Email** - Player's email address (from Firebase realplayers collection)
7. **Phone Number** - Player's contact number (from Firebase realplayers collection)

### File Naming
Format: `registered_players_[SEASON_NAME]_[DATE].xlsx`

Example: `registered_players_SSPSLS16_2025-10-30.xlsx`

## Technical Details

### Data Sources
1. **Player Statistics** (Neon DB via `/api/stats/players`):
   - player_id
   - player_name
   - registration_type
   - registration_date

2. **Player Details** (Firebase `realplayers` collection):
   - email
   - phone

### Implementation
- Uses `xlsx` library (already installed in package.json)
- Fetches additional player details in batches of 30 (Firestore 'in' query limit)
- Respects current search filter (only exports filtered results)
- Sets appropriate column widths for readability
- Handles errors gracefully with user-friendly messages

### Performance
- Batch processing for large player lists (processes 30 players at a time)
- Async data fetching to avoid blocking UI
- Success/error notifications

## Usage

### For Administrators:
1. Navigate to `/register/players?season=SEASON_ID`
2. Select the "Manage Players" tab
3. (Optional) Use the search box to filter players
4. Click the green "Export" button
5. Excel file will download automatically

### Data Uses:
- Email campaigns
- SMS notifications
- Contact list management
- Record keeping
- Data analysis
- Backup purposes

## Error Handling
- Shows error message if export fails
- Handles missing email/phone data gracefully (displays empty string)
- Validates data before export

## Future Enhancements
- Add export format selection (CSV, PDF)
- Include additional fields (team, category, star rating)
- Add date range filter
- Export all tabs (not just filtered results)
- Bulk actions from exported list

## Browser Compatibility
Works on all modern browsers:
- Chrome/Edge (recommended)
- Firefox
- Safari

## Security
- Only accessible to authenticated committee admins
- Respects existing permission system
- No data is sent to external servers (client-side export)
