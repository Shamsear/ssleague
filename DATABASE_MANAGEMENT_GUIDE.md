# Database Management System Documentation

## Overview
A comprehensive database management system for importing, managing, and maintaining football player data from SQLite databases into Firestore.

## Features

### 1. **SQLite Database Upload & Import**
- Upload `.db` (SQLite database) files containing player data
- Automatic table detection (tries: `players`, `players_all`, `footballplayers`, `player`)
- Parses all columns and data types automatically
- Supports large databases with batch processing

### 2. **Import Workflows**

#### Quick Import
- Direct import without preview
- Fast batch processing (500 players per batch)
- Ideal for trusted data sources

#### Enhanced Import (Preview & Edit)
- Review all players before importing
- Edit player data inline:
  - Name
  - Position (dropdown)
  - Overall Rating (1-99)
  - Team Name
  - Auction Eligibility (checkbox)
- Real-time validation
- Remove unwanted players
- Progress tracking during import

### 3. **Database Operations**

#### View Database Status
- Total player count
- Players by position (expandable view)
- Real-time statistics

#### Delete All Players
- Confirmation checkbox required
- Double confirmation prompt
- Complete database wipe

#### Backup & Restore
- **Backup**: Download all player data as JSON
- **Restore**: Upload JSON backup to restore database
- Includes timestamps and metadata

#### Filter Players
- Filter by position
- Filter by rating range (min/max)
- View filtered count

### 4. **Real-Time Progress Tracking**
- 4-step import process:
  1. Initializing Import
  2. Validating Data
  3. Importing Players (with sub-progress)
  4. Finalizing
- Overall progress percentage
- Individual step status indicators
- Import statistics summary

## File Structure

```
app/
├── api/
│   └── parse-sql/
│       └── route.ts                    # SQLite database parser API
├── dashboard/
│   └── committee/
│       ├── database/
│       │   ├── page.tsx               # Main database management page
│       │   ├── import-preview/
│       │   │   └── page.tsx          # Preview & edit before import
│       │   └── import-progress/
│       │       └── page.tsx          # Real-time import progress
│       └── page.tsx                   # Dashboard (with DB link)
```

## Usage Guide

### Step 1: Access Database Management
1. Login as committee admin
2. Navigate to Committee Dashboard
3. Click "Database Management" card

### Step 2: Upload SQLite Database
1. Click "Choose File" under "Upload SQLite Database"
2. Select your `.db` file (e.g., `efootball_real.db`)
3. Click "Parse Database"
4. Wait for parsing confirmation

### Step 3: Choose Import Method

#### Option A: Quick Import
1. Click "Quick Import All"
2. Confirm the action
3. Wait for import completion
4. View imported players

#### Option B: Enhanced Import
1. Click "Preview & Import"
2. Review player data in table
3. Edit any incorrect data
4. Remove unwanted players
5. Click "Validate All" to check for errors
6. Click "Start Import"
7. Monitor progress in real-time
8. View import statistics

### Step 4: Post-Import Actions
- Click "View Players" to browse imported players
- Click "Back to Database" to perform more operations
- Create a backup for safety

## API Endpoints

### POST `/api/parse-sql`
Parses SQLite database files and extracts player data.

**Request:**
- FormData with `file` field containing `.db` file

**Response:**
```json
{
  "success": true,
  "players": [...],
  "count": 1000,
  "tableName": "players_all"
}
```

**Error Response:**
```json
{
  "error": "Error message"
}
```

## Data Flow

1. **Upload**: User uploads `.db` file
2. **Parse**: API extracts player data using SQL.js
3. **Store**: Data stored in sessionStorage temporarily
4. **Preview** (Optional): User reviews/edits data
5. **Import**: Data written to Firestore in batches
6. **Cleanup**: sessionStorage cleared

## Database Schema

### Firestore Collection: `footballplayers`

```typescript
{
  id: string                    // Auto-generated
  player_id: string            // From SQLite or auto
  name: string                 // Required
  position: string             // Required (GK, CB, LB, etc.)
  overall_rating: number       // Required (1-99)
  team_name?: string
  is_auction_eligible: boolean // Default: false
  created_at: Timestamp        // Auto-added
  // ... all other fields from SQLite
}
```

### Supported Positions
- GK (Goalkeeper)
- CB (Center Back)
- LB, RB (Left/Right Back)
- DMF (Defensive Midfielder)
- CMF (Central Midfielder)
- LMF, RMF (Left/Right Midfielder)
- AMF (Attacking Midfielder)
- CF (Center Forward)
- LWF, RWF (Left/Right Wing Forward)
- SS (Second Striker)

## Validation Rules

### Required Fields
- **Name**: Must not be empty
- **Position**: Must be one of supported positions
- **Overall Rating**: Must be between 1-99

### Optional Fields
- Team Name
- Auction Eligibility
- All other SQLite columns

## Performance

### Import Speed
- **Quick Import**: ~500 players/second
- **Enhanced Import**: ~500 players/second (after preview)
- Batch size: 500 players per Firestore batch

### File Size Limits
- SQLite Database: No hard limit (browser dependent)
- Typical: Handles 10,000+ players easily

### Browser Requirements
- Modern browser with:
  - FileReader API
  - sessionStorage
  - WebAssembly (for SQL.js)

## Security

### Access Control
- **Required Role**: `committee_admin`
- Firestore Rules:
  ```javascript
  match /footballplayers/{playerId} {
    allow read: if isAdmin();
    allow create: if isAdmin();
    allow update: if isAdmin();
    allow delete: if isAdmin();
  }
  ```

### Data Validation
- Client-side validation in preview
- Type checking during import
- Sanitization of user inputs

## Error Handling

### Common Errors

**"No player tables found in database"**
- Solution: Ensure SQLite file contains a valid player table

**"Only .db files are supported"**
- Solution: Upload a SQLite database file, not SQL text

**"Failed to parse SQLite database"**
- Solution: Check if file is corrupted or encrypted

**"Missing or insufficient permissions"**
- Solution: Deploy updated Firestore rules (see Firestore Rules section)

### Firestore Rules Deployment

You need to deploy the updated Firestore security rules:

```bash
firebase deploy --only firestore:rules
```

Or manually add to Firebase Console:
```javascript
match /footballplayers/{playerId} {
  allow read: if isAdmin();
  allow create: if isAdmin();
  allow update: if isAdmin();
  allow delete: if isAdmin();
}
```

## Backup & Recovery

### Creating Backups
1. Click "Create Backup" button
2. JSON file downloads automatically
3. Store safely with timestamp

### Backup File Format
```json
{
  "timestamp": "2025-10-03T09:53:20.000Z",
  "players": [...],
  "count": 1000
}
```

### Restoring from Backup
1. Click "Choose File" under Restore
2. Select backup JSON file
3. Confirm overwrite warning
4. Wait for restore completion

## Tips & Best Practices

1. **Always Create Backups**: Before major operations
2. **Use Enhanced Import**: For new/untrusted data sources
3. **Validate Data**: Check preview before importing
4. **Small Test First**: Test with small database first
5. **Monitor Progress**: Watch progress page for errors
6. **Regular Backups**: Schedule periodic backups

## Troubleshooting

### Import Stuck at 0%
- Refresh page
- Check browser console for errors
- Verify sessionStorage not full

### Players Not Showing
- Check Firestore rules deployed
- Verify user role is `committee_admin`
- Check browser console

### Slow Import
- Normal for large databases (>5000 players)
- Firestore batch writes have rate limits
- Wait patiently or reduce batch size

## Dependencies

### NPM Packages
- `sql.js`: SQLite database parsing
- `firebase`: Firestore operations
- Next.js built-in APIs

### External Resources
- SQL.js WASM file: `https://sql.js.org/dist/`

## Future Enhancements

- [ ] CSV file support
- [ ] Excel file support
- [ ] Duplicate detection
- [ ] Bulk update operations
- [ ] Export to Excel
- [ ] Scheduled imports
- [ ] Import history tracking
- [ ] Rollback functionality

## Support

For issues or questions:
1. Check error messages in browser console
2. Verify Firestore rules are deployed
3. Ensure correct file format (.db)
4. Check user role permissions

## Version History

### v1.0.0 (Current)
- Initial release
- SQLite database import
- Preview & edit functionality
- Real-time progress tracking
- Backup & restore
- Filter operations
