# Bonus Points System

## Overview
The Bonus Points System allows committee admins to award extra points to players or teams for special achievements, fair play, or any other reason. These points are added to the existing points earned through regular gameplay.

## Features

### ✨ Key Capabilities
- **Single or Bulk Selection**: Award points to one or multiple players/teams at once
- **Flexible Points**: Award positive points (bonuses) or negative points (penalties)
- **Descriptive Reasons**: Add a heading/reason for each bonus point award
- **Real-time Updates**: Award points at any time during the season
- **Complete History**: View all bonus points awarded with full audit trail
- **Easy Management**: Delete bonus point records if needed

### 🎯 Use Cases
- Fair Play Awards
- Special Achievement Bonuses
- Community Contribution Points
- Penalty Points for violations
- Event Participation Rewards
- Custom Tournament Bonuses

## How to Use

### 1. Access the Page
Navigate to: `/dashboard/committee/fantasy/bonus-points`

### 2. Enter Season Information
- **Season ID**: Enter the season identifier (e.g., `SSPSLFLS16`)
- **Tournament ID**: Enter the tournament identifier

### 3. Select Target Type
Choose whether to award points to:
- **Players**: Individual football players
- **Teams**: Entire teams

### 4. Configure Points
- **Points**: Enter the number of points (positive for bonus, negative for penalty)
- **Reason**: Provide a clear description (e.g., "Fair Play Award", "Hat-trick Bonus")

### 5. Select Recipients
- Use the search bar to filter players/teams
- Click on items to select them (checkboxes will appear)
- Use "Select All" or "Deselect All" for bulk operations
- Selected count is displayed at the top

### 6. Award Points
- Review your selection
- Click the "Award Points" button
- Confirm the action in the modal
- Points are immediately recorded in the database

### 7. View History
- Scroll down to see all bonus points awarded
- Each record shows:
  - Points awarded (+/-)
  - Recipient name and type
  - Reason
  - Date and time
- Delete records if needed

## Database Structure

### Table: `bonus_points`
```sql
CREATE TABLE bonus_points (
  id SERIAL PRIMARY KEY,
  target_type VARCHAR(10) NOT NULL,  -- 'player' or 'team'
  target_id VARCHAR(255) NOT NULL,   -- player_id or team_id
  points INTEGER NOT NULL,           -- Can be positive or negative
  reason VARCHAR(500) NOT NULL,      -- Description/heading
  season_id VARCHAR(255) NOT NULL,
  tournament_id VARCHAR(255) NOT NULL,
  awarded_by VARCHAR(255) NOT NULL,  -- Admin's Firebase UID
  awarded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## API Endpoints

### GET `/api/admin/bonus-points`
Fetch bonus points history

**Query Parameters:**
- `season_id` (optional): Filter by season
- `tournament_id` (optional): Filter by tournament
- `target_type` (optional): Filter by 'player' or 'team'

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "target_type": "player",
      "target_id": "player_123",
      "target_name": "John Doe",
      "points": 50,
      "reason": "Fair Play Award",
      "season_id": "SSPSLFLS16",
      "tournament_id": "tournament_1",
      "awarded_by": "admin_uid",
      "awarded_at": "2025-12-15T10:30:00Z"
    }
  ]
}
```

### POST `/api/admin/bonus-points`
Award bonus points

**Request Body:**
```json
{
  "targets": ["player_123", "player_456"],
  "points": 50,
  "reason": "Fair Play Award",
  "season_id": "SSPSLFLS16",
  "tournament_id": "tournament_1",
  "target_type": "player"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Bonus points awarded to 2 player(s)",
  "data": [...]
}
```

### DELETE `/api/admin/bonus-points?id={id}`
Delete a bonus point record

**Response:**
```json
{
  "success": true,
  "message": "Bonus point record deleted"
}
```

## Integration with Points System

The bonus points are stored separately in the `bonus_points` table. To calculate total points for a player or team:

```sql
-- For Players
SELECT 
  ps.player_id,
  ps.name,
  ps.points as base_points,
  COALESCE(SUM(bp.points), 0) as bonus_points,
  ps.points + COALESCE(SUM(bp.points), 0) as total_points
FROM player_seasons ps
LEFT JOIN bonus_points bp ON 
  bp.target_type = 'player' 
  AND bp.target_id = ps.player_id 
  AND bp.season_id = ps.season_id
WHERE ps.season_id = 'SSPSLFLS16'
GROUP BY ps.player_id, ps.name, ps.points;

-- For Teams
SELECT 
  ts.team_id,
  ts.team_name,
  ts.total_points as base_points,
  COALESCE(SUM(bp.points), 0) as bonus_points,
  ts.total_points + COALESCE(SUM(bp.points), 0) as total_points
FROM team_seasons ts
LEFT JOIN bonus_points bp ON 
  bp.target_type = 'team' 
  AND bp.target_id = ts.team_id 
  AND bp.season_id = ts.season_id
WHERE ts.season_id = 'SSPSLFLS16'
GROUP BY ts.team_id, ts.team_name, ts.total_points;
```

## Security

- **Authentication Required**: Only committee admins can access this feature
- **Authorization Check**: Firebase token verification on all API calls
- **Audit Trail**: All bonus points include `awarded_by` field tracking who awarded them
- **Validation**: All inputs are validated before processing

## UI Features

- **Responsive Design**: Works on desktop and mobile
- **Search Functionality**: Quick filtering of players/teams
- **Bulk Operations**: Select all/deselect all buttons
- **Visual Feedback**: Selected items are highlighted
- **Loading States**: Spinners during data fetching
- **Confirmation Modals**: Prevent accidental awards
- **Success/Error Alerts**: Clear feedback on all actions

## Migration

To set up the bonus points table, run:

```bash
node run-bonus-points-migration.js
```

This creates the `bonus_points` table with all necessary indexes and constraints.

## Future Enhancements

Potential improvements:
- Export bonus points history to Excel
- Filter history by date range
- Bulk import from CSV
- Automatic bonus rules (e.g., award points for hat-tricks)
- Bonus point categories/tags
- Approval workflow for large point awards
- Integration with notifications system

## Support

For issues or questions about the bonus points system, contact the development team.
