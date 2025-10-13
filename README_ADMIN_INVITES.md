# Admin Invitation System - Documentation

## Overview

The Admin Invitation System allows Super Admins to create invitation codes for Committee Admins. Each Committee Admin is assigned to a specific season and has full permissions to manage that season only, while having view-only access to other seasons.

## System Architecture

### Key Concepts

1. **Super Admin**: Has full access to all seasons and can create/manage invites
2. **Committee Admin**: Has full access to manage their assigned season, view-only access to others
3. **Season-Specific Permissions**: Each invite is tied to a specific season
4. **Invite Codes**: Unique, time-limited codes for registration

## Files Created/Modified

### New Files

1. **types/invite.ts** - Type definitions for invites
2. **lib/firebase/invites.ts** - Firebase functions for managing invites
3. **lib/permissions.ts** - Permission checking utilities
4. **hooks/usePermissions.ts** - React hooks for permission checks

### Modified Files

1. **types/user.ts** - Updated CommitteeAdmin to include seasonId
2. **lib/firebase/auth.ts** - Updated createUserDocument to handle seasonId
3. **app/dashboard/superadmin/invites/page.tsx** - Full Firebase integration

## Database Structure

### Collections

#### `invites` Collection
```typescript
{
  code: string;                    // Document ID (e.g., "ABCD-1234-EFGH")
  description: string;             // "Head Admin for Season 2024"
  seasonId: string;                // Reference to season
  seasonName: string;              // Cached season name
  seasonYear: string;              // Cached season year
  maxUses: number;                 // Maximum number of uses
  usedCount: number;               // Current use count
  expiresAt: Timestamp;            // Expiration date
  createdAt: Timestamp;            // Creation date
  createdBy: string;               // UID of creator
  createdByUsername: string;       // Username of creator
  isActive: boolean;               // Is invite active?
  usedBy: string[];                // Array of user IDs who used it
}
```

#### `inviteUsages` Collection
```typescript
{
  inviteId: string;               // Invite code
  inviteCode: string;             // Same as inviteId (for querying)
  userId: string;                 // User who used the invite
  username: string;               // Username
  email: string;                  // Email
  usedAt: Timestamp;              // When it was used
  seasonId: string;               // Season ID
  seasonName: string;             // Season name
}
```

#### Updated `users` Collection (Committee Admin)
```typescript
{
  // ... existing fields ...
  role: 'committee_admin';
  seasonId: string;               // NEW: Assigned season
  seasonName: string;             // NEW: Cached season name
  seasonYear: string;             // NEW: Cached season year
  committeeId?: string;
  committeeName?: string;
  permissions: string[];
  canManageTeams: boolean;
  canManageAuctions: boolean;
}
```

## Permission System

### Permission Levels

1. **Full Access** (Super Admin only)
   - Create/edit/delete seasons
   - Create/manage invites
   - Full access to all data

2. **Modify** (Committee Admin for their season)
   - Manage teams in their season
   - Manage players in their season
   - Manage auctions in their season
   - Cannot modify season settings
   - Cannot create invites

3. **View** (Committee Admin for other seasons)
   - Can view other seasons' data
   - Cannot modify anything in other seasons

4. **None** (Teams and unauthenticated users)
   - No admin access

### Permission Functions

```typescript
// Check general permission
hasPermission(user, 'manage_teams') // boolean

// Check season-specific access
canAccessSeason(user, seasonId) // boolean
canModifySeason(user, seasonId) // boolean
canViewSeasonData(user, seasonId) // boolean

// Get permission level for a season
getSeasonPermissionLevel(user, seasonId) // 'none' | 'view' | 'modify' | 'full'

// Get accessible seasons
getAccessibleSeasons(user) // 'all' | string[]
```

### React Hooks

```typescript
// Individual hooks
const hasAccess = useHasPermission('manage_teams');
const canAccess = useCanAccessSeason(seasonId);
const canModify = useCanModifySeason(seasonId);
const permLevel = useSeasonPermissionLevel(seasonId);

// Combined hook
const {
  isSuperAdmin,
  isCommitteeAdmin,
  userSeasonId,
  hasPermission,
  canAccessSeason,
  canModifySeason,
  getSeasonPermissionLevel,
  accessibleSeasons
} = usePermissions();
```

## API Functions

### Invite Management

```typescript
// Create an invite
const invite = await createAdminInvite(
  {
    seasonId: 'season123',
    description: 'Head Committee Admin',
    maxUses: 1,
    expiresInHours: 48
  },
  creatorUid,
  creatorUsername
);

// Get all invites
const invites = await getAllAdminInvites();

// Get invites for a season
const seasonInvites = await getAdminInvitesBySeason(seasonId);

// Validate an invite
const validation = await validateAdminInvite(code);
if (validation.valid) {
  // Use the invite
}

// Use an invite (call during registration)
await useAdminInvite(code, userId, username, email);

// Delete an invite
await deleteAdminInvite(code);

// Deactivate an invite
await deactivateAdminInvite(code);
```

### Get Committee Admins

```typescript
// Get all committee admins for a season
const admins = await getCommitteeAdminsBySeason(seasonId);
```

## User Flow

### Creating an Invite (Super Admin)

1. Navigate to `/dashboard/superadmin/invites`
2. Click "Create Invite"
3. Select a season
4. Enter description (optional)
5. Set max uses (default: 1)
6. Set expiration hours (default: 24)
7. Click "Create Invitation"
8. Copy and share the generated URL

### Using an Invite (Committee Admin Registration)

1. Receive invite URL: `https://yoursite.com/register?invite=ABCD-1234-EFGH`
2. Click the URL
3. Fill in registration form
4. System automatically:
   - Validates the invite
   - Sets role to 'committee_admin'
   - Assigns seasonId from invite
   - Marks invite as used
5. Redirect to dashboard with season-specific access

## Security Considerations

### Firestore Rules

Add these rules to `firestore.rules`:

```javascript
// Invites collection
match /invites/{code} {
  // Only super admins can read/write invites
  allow read: if request.auth != null && 
    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'super_admin';
  allow write: if request.auth != null && 
    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'super_admin';
}

// Invite usages collection
match /inviteUsages/{usageId} {
  // Only super admins can read invite usages
  allow read: if request.auth != null && 
    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'super_admin';
  allow create: if request.auth != null;
  allow update, delete: if false;
}

// Users collection (updated rules)
match /users/{userId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null && request.auth.uid == userId;
  allow update: if request.auth != null && (
    request.auth.uid == userId || // Users can update their own profile
    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'super_admin' // Super admins can update any user
  );
  allow delete: if request.auth != null && 
    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'super_admin';
}
```

### Additional Security

1. **Invite Validation**: Always validate invites server-side
2. **Rate Limiting**: Consider rate limiting invite creation
3. **Expiration**: Invites automatically expire after set time
4. **Max Uses**: Invites can only be used a set number of times
5. **Deactivation**: Admins can deactivate invites at any time

## Testing

### Test Scenarios

1. **Create Invite**
   - Test with valid season
   - Test without season (should fail)
   - Test expiration calculation

2. **Use Invite**
   - Test with valid invite
   - Test with expired invite
   - Test with fully-used invite
   - Test with deactivated invite
   - Test using same invite twice

3. **Permissions**
   - Test super admin access (all seasons)
   - Test committee admin access (own season: full, others: view)
   - Test team access (no admin features)

4. **Invite Management**
   - Test listing invites
   - Test deleting invites
   - Test filtering by season

## Usage Examples

### Example 1: Check if User Can Manage Teams

```typescript
import { usePermissions } from '@/hooks/usePermissions';

function TeamManagement() {
  const { hasPermission, canModifySeason } = usePermissions();
  const seasonId = 'current-season-id';
  
  if (!hasPermission('view_teams')) {
    return <div>Access denied</div>;
  }
  
  const canEdit = canModifySeason(seasonId);
  
  return (
    <div>
      <TeamList readOnly={!canEdit} />
      {canEdit && <AddTeamButton />}
    </div>
  );
}
```

### Example 2: Filter Seasons by Access

```typescript
import { usePermissions } from '@/hooks/usePermissions';
import { filterSeasonsByPermission } from '@/lib/permissions';

function SeasonSelector() {
  const { user, accessibleSeasons } = usePermissions();
  const [allSeasons, setAllSeasons] = useState<Season[]>([]);
  
  useEffect(() => {
    // Load all seasons
    getAllSeasons().then(setAllSeasons);
  }, []);
  
  // Filter to only show accessible seasons
  const availableSeasons = accessibleSeasons === 'all' 
    ? allSeasons 
    : allSeasons.filter(s => accessibleSeasons.includes(s.id));
  
  return (
    <select>
      {availableSeasons.map(season => (
        <option key={season.id} value={season.id}>
          {season.name}
        </option>
      ))}
    </select>
  );
}
```

### Example 3: Create and Share Invite

```typescript
async function handleCreateInvite(seasonId: string) {
  try {
    const invite = await createAdminInvite(
      {
        seasonId,
        description: 'Head Admin',
        maxUses: 1,
        expiresInHours: 48
      },
      currentUser.uid,
      currentUser.username
    );
    
    // Generate invite URL
    const inviteUrl = `${window.location.origin}/register?invite=${invite.code}`;
    
    // Copy to clipboard
    await navigator.clipboard.writeText(inviteUrl);
    
    alert('Invite link copied to clipboard!');
  } catch (error) {
    console.error('Failed to create invite:', error);
  }
}
```

## Roadmap

### Future Enhancements

1. **Email Invitations**: Send invites directly via email
2. **Custom Permissions**: Allow super admin to customize committee admin permissions
3. **Invite Templates**: Pre-configured invite settings
4. **Bulk Invites**: Create multiple invites at once
5. **Invite Analytics**: Track invite usage statistics
6. **Auto-cleanup**: Automatically delete expired invites
7. **Notification System**: Notify when invites are used

## Support

For issues or questions, please refer to the main project documentation or contact the development team.
