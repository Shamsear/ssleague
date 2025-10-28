# Awards System Implementation Guide 🏆

## Overview
Complete awards management system for tournaments with Player and Team awards at Day/Week/Season levels.

## Features Implemented ✅

### Award Types
1. **POTD** (Player of the Day) - Selected from MOTM winners each round
2. **POTW** (Player of the Week) - Selected from POTD winners (after 7 rounds)
3. **TOD** (Team of the Day) - Best team each round
4. **TOW** (Team of the Week) - Best team from TOD winners (after 7 rounds)
5. **POTS** (Player of the Season) - Best player overall
6. **TOTS** (Team of the Season) - Best team overall

### Key Features
- ✅ **Fully Responsive** - Works on all screen sizes (mobile, tablet, desktop)
- ✅ **Tournament-Specific** - Awards per tournament (Super League default)
- ✅ **Season-Specific** - Separate awards for each season
- ✅ **Round-Based** - 7 rounds = 1 week
- ✅ **Editable** - Admin can change/remove awards
- ✅ **No Restrictions** - Same player/team can win multiple times
- ✅ **Performance Stats** - Detailed stats displayed with each award
- ✅ **Cascading Selection** - MOTM → POTD → POTW hierarchy

## Database Schema ✅

**Table:** `awards` (in Tournament DB)

```sql
- id: TEXT (Primary Key)
- award_type: VARCHAR(20) (POTD/POTW/TOD/TOW/POTS/TOTS)
- tournament_id: TEXT
- season_id: TEXT
- round_number: INTEGER (for POTD/TOD)
- week_number: INTEGER (for POTW/TOW)
- player_id: TEXT (for player awards)
- player_name: TEXT
- team_id: TEXT (for team awards)
- team_name: TEXT
- performance_stats: JSONB
- selected_by: TEXT (admin user ID)
- selected_by_name: TEXT
- selected_at: TIMESTAMP
- notes: TEXT
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

**Indexes Created:** ✅
- Tournament + Season
- Award Type
- Round Number
- Week Number
- Player ID
- Team ID
- Unique constraints for each award type

## API Endpoints ✅

### 1. GET `/api/awards`
Fetch awards with filters:
```javascript
GET /api/awards?tournament_id=SSPSLS&season_id=SSPSLS16&award_type=POTD&round_number=1
```

### 2. POST `/api/awards`
Create or update an award:
```javascript
POST /api/awards
{
  "award_type": "POTD",
  "tournament_id": "SSPSLS",
  "season_id": "SSPSLS16",
  "round_number": 1,
  "player_id": "player123",
  "player_name": "John Doe",
  "team_id": "team1",
  "performance_stats": { "goals": 5, "assists": 2 },
  "selected_by": "admin_uid",
  "selected_by_name": "Admin Name"
}
```

### 3. DELETE `/api/awards`
Remove an award:
```javascript
DELETE /api/awards?id=award_id
```

### 4. GET `/api/awards/eligible`
Get eligible candidates for an award:
```javascript
GET /api/awards/eligible?tournament_id=SSPSLS&season_id=SSPSLS16&award_type=POTD&round_number=1
```

## Admin UI ✅

**Access:** `/dashboard/committee/awards`

### Responsive Design
- **Mobile**: Vertical tabs, scrollable round selector, stacked cards
- **Tablet**: Horizontal tabs, better spacing
- **Desktop**: Full layout with all features

### Features:
1. **Tab Navigation** - Switch between award types
2. **Round/Week Navigator** - Select round or week
3. **Current Winner Display** - Shows selected award with edit/remove options
4. **Candidates List** - Shows eligible candidates with performance stats
5. **Click to Select** - Simple click interface
6. **Save Button** - Creates or updates award

### Workflow:

#### POTD Selection (After each round):
1. Navigate to POTD tab
2. Select round (1-28)
3. View MOTM winners from that round's fixtures
4. Click on candidate to select
5. Click "Select Award" to save

#### POTW Selection (After 7 rounds):
1. Navigate to POTW tab
2. Select week (1-4)
3. System shows POTD winners from that week (Rounds 1-7, 8-14, etc.)
4. Select best player
5. Save

#### TOD Selection:
1. Navigate to TOD tab
2. Select round
3. View teams sorted by performance (goals, goal difference, wins)
4. Select best team
5. Save

#### TOW Selection:
1. Navigate to TOW tab
2. Select week
3. View TOD winners from that week
4. Select best team
5. Save

#### Season Awards (POTS/TOTS):
1. Navigate to POTS or TOTS tab
2. View top players/teams with season stats
3. Select winner
4. Save

## Migration Completed ✅

Run this command to set up the database:
```bash
node scripts/create-awards-table.js
```

Status: ✅ **COMPLETED** - Table and indexes created successfully

## Usage Examples

### Example 1: Select POTD for Round 1
1. Go to `/dashboard/committee/awards`
2. Click "POTD" tab
3. Select "R1"
4. See MOTM winners: John Doe (5G, 2A), Mike Smith (3G, 1A)
5. Click on John Doe
6. Click "Select Award"
7. ✅ John Doe is now POTD for Round 1

### Example 2: Select POTW after Week 1
1. Click "POTW" tab
2. Select "Week 1"
3. See POTD winners from Rounds 1-7
4. Click on best player
5. Save

### Example 3: Edit/Change Award
1. Navigate to round with existing award
2. Current winner shown at top
3. Click "Remove" to delete
4. Select new candidate
5. Save

## Performance Stats Structure

### Player Awards:
```json
{
  "goals": 5,
  "assists": 2,
  "motm_count": 1,
  "potd_count": 3,
  "wins": 1,
  "matches_played": 5
}
```

### Team Awards:
```json
{
  "goals_for": 8,
  "goals_against": 2,
  "goal_difference": 6,
  "wins": 1,
  "draws": 0,
  "losses": 0,
  "clean_sheet": false
}
```

## Week Calculation

**1 Week = 7 Rounds**

- Week 1: Rounds 1-7
- Week 2: Rounds 8-14
- Week 3: Rounds 15-21
- Week 4: Rounds 22-28

## Next Steps (Optional)

### Public Display Page (Not Yet Implemented)
Create `/awards` or `/awards/[tournament]/[season]` page to show:
- Current week's awards
- Historical awards
- Award statistics
- Hall of fame

### Tournament Configuration (Not Yet Implemented)
Add tournament settings to enable/disable awards:
```javascript
{
  "tournament_id": "SSPSLS",
  "awards_enabled": true,
  "award_types": ["POTD", "POTW", "TOD", "TOW", "POTS", "TOTS"]
}
```

## Status Summary

### ✅ Completed:
- Database schema created
- API endpoints implemented
- Admin UI created (fully responsive)
- Migration script run successfully
- Cascading selection logic (MOTM→POTD→POTW)
- Edit/Remove functionality
- Performance stats display

### ⏳ Optional (Not Required):
- Public display page
- Tournament configuration
- Award notifications
- Award badges/icons

## Support

The awards system is now **fully operational** for committee admins to use!

Access: `http://localhost:3000/dashboard/committee/awards`

For any issues, check:
1. Database connection (Neon Tournament DB)
2. User permissions (isCommitteeAdmin)
3. Season ID (userSeasonId)
4. Browser console for errors
