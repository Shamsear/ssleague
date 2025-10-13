# Team Management - Firebase Integration

This document explains how the Team Management feature works with Firebase Firestore.

## Overview

The Team Management page (`app/dashboard/superadmin/teams/page.tsx`) is fully integrated with Firebase Firestore. It allows super admins to:

- View all teams across all seasons
- Create new teams
- Edit existing teams
- Delete teams
- Toggle team active/inactive status
- View team statistics
- Filter teams by season and status
- Search teams by name, code, or owner

## Firebase Collections

### Teams Collection (`teams`)

Each team document contains:

```typescript
{
  team_name: string;          // Full team name (e.g., "Manchester United FC")
  team_code: string;          // Unique team code (e.g., "MUN", uppercase)
  owner_uid?: string;         // Firebase auth UID of the team owner (optional)
  owner_name?: string;        // Team owner's name (optional)
  owner_email?: string;       // Team owner's email (optional)
  balance: number;            // Current balance
  initial_balance: number;    // Starting balance for the season
  season_id: string;          // Reference to the season document ID
  players_count: number;      // Number of players in the team
  is_active: boolean;         // Whether the team is active
  created_at: Timestamp;      // When the team was created
  updated_at: Timestamp;      // When the team was last updated
}
```

## Files Structure

### Types (`types/team.ts`)

Defines TypeScript interfaces for Team data:
- `TeamData` - Complete team object with ID
- `CreateTeamData` - Data required to create a new team
- `UpdateTeamData` - Partial data for updating a team

### Firebase Library (`lib/firebase/teams.ts`)

Contains all Firebase operations for teams:

#### Core Functions

1. **`getAllTeams()`**
   - Fetches all teams from Firestore
   - Orders by creation date (newest first)
   - Automatically fetches season names
   - Returns: `Promise<TeamData[]>`

2. **`getTeamsBySeason(seasonId: string)`**
   - Fetches teams for a specific season
   - Returns: `Promise<TeamData[]>`

3. **`getTeamById(teamId: string)`**
   - Fetches a single team by ID
   - Returns: `Promise<TeamData | null>`

4. **`createTeam(teamData: CreateTeamData)`**
   - Creates a new team
   - Validates team code uniqueness
   - Converts team code to uppercase
   - Updates season's total team count
   - Returns: `Promise<TeamData>`

5. **`updateTeam(teamId: string, updates: UpdateTeamData)`**
   - Updates an existing team
   - Validates team code if being changed
   - Returns: `Promise<void>`

6. **`deleteTeam(teamId: string)`**
   - Deletes a team
   - Updates season's total team count
   - Returns: `Promise<void>`

7. **`toggleTeamStatus(teamId: string, isActive: boolean)`**
   - Toggles team's active status
   - Returns: `Promise<void>`

8. **`getTeamStatistics()`**
   - Calculates team statistics
   - Returns: `Promise<{ totalTeams, activeTeams, inactiveTeams, totalPlayers }>`

#### Utility Functions

- **`isTeamCodeAvailable(teamCode, excludeTeamId?)`** - Check if team code is unique
- **`updateTeamPlayerCount(teamId, playerCount)`** - Update team's player count
- **`updateTeamBalance(teamId, balance)`** - Update team's balance

### UI Component (`app/dashboard/superadmin/teams/page.tsx`)

The main Team Management page with:
- Real-time data loading from Firebase
- Statistics cards (total teams, active, inactive, total players)
- Search and filter functionality
- Responsive table/card view
- Add/Edit team modals
- Error handling and loading states
- Integration with season management

## Usage Examples

### Creating a Team

```typescript
import { createTeam } from '@/lib/firebase/teams';

const newTeam = await createTeam({
  team_name: 'Manchester United FC',
  team_code: 'MUN',
  owner_name: 'John Doe',
  owner_email: 'john@example.com',
  initial_balance: 10000000,
  season_id: 'season_doc_id',
});
```

### Updating a Team

```typescript
import { updateTeam } from '@/lib/firebase/teams';

await updateTeam('team_doc_id', {
  team_name: 'Manchester United',
  balance: 8500000,
});
```

### Getting All Teams

```typescript
import { getAllTeams } from '@/lib/firebase/teams';

const teams = await getAllTeams();
```

### Toggling Team Status

```typescript
import { toggleTeamStatus } from '@/lib/firebase/teams';

await toggleTeamStatus('team_doc_id', false); // Deactivate
```

## Features

### Validation

- **Team Code Uniqueness**: Automatically checks if team code is already in use
- **Required Fields**: Validates required fields (team name, code, season, balance)
- **Uppercase Conversion**: Team codes are automatically converted to uppercase
- **Email Format**: Email validation on form submission

### Auto-Updates

- **Season Team Count**: Automatically updates the season's `totalTeams` field when teams are added or deleted
- **Timestamps**: Automatically manages `created_at` and `updated_at` timestamps
- **Season Names**: Fetches and displays season names alongside team data

### Error Handling

- Comprehensive try-catch blocks
- User-friendly error messages
- Console logging for debugging
- Alert dialogs for critical errors
- Error banner in UI

### Performance

- Parallel data loading (teams, stats, seasons)
- Efficient queries with Firestore indexes
- Optimistic UI updates

## Firestore Indexes Required

For optimal performance, create these composite indexes in Firebase Console:

1. **Teams by Season and Creation Date**
   - Collection: `teams`
   - Fields: `season_id` (Ascending), `created_at` (Descending)

2. **Teams by Code**
   - Collection: `teams`
   - Fields: `team_code` (Ascending)

## Security Rules

Recommended Firestore security rules for teams collection:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /teams/{teamId} {
      // Super admins can do anything
      allow read, write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'super_admin';
      
      // Team owners can read their own team
      allow read: if request.auth != null && 
        resource.data.owner_uid == request.auth.uid;
    }
  }
}
```

## Integration with Other Features

### Season Management
- Teams are linked to seasons via `season_id`
- Season team counts are automatically updated
- Season names are displayed with each team

### User Management
- Teams can be linked to user accounts via `owner_uid`
- Owner name and email are stored for reference

### Future Integrations
- Player management (track players in teams)
- Auction system (use team balance for bidding)
- Match management (assign teams to matches)

## Troubleshooting

### Teams not loading
- Check Firebase configuration in `.env.local`
- Verify Firestore rules allow read access
- Check browser console for errors

### Team code validation errors
- Ensure team codes are unique across all seasons
- Team codes are case-insensitive (converted to uppercase)

### Season count not updating
- Verify the season document exists
- Check that `season_id` in team matches actual season ID

## Testing

To test the Team Management feature:

1. **Create a Season First**: Go to Season Management and create a season
2. **Add Teams**: Use the "Add Team" button to create teams for the season
3. **Test Validation**: Try creating a team with a duplicate code
4. **Test Filtering**: Filter teams by season and status
5. **Test Search**: Search for teams by name, code, or owner
6. **Test Updates**: Edit a team and verify changes are saved
7. **Test Delete**: Delete a team and verify season count updates

## Future Enhancements

Potential improvements:
- Bulk team import from CSV/Excel
- Team analytics and performance metrics
- Team logos/images upload
- Team member management (multiple users per team)
- Team communication features
- Export team data to PDF/Excel
