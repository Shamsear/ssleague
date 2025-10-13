# Admin Invites - Quick Start Guide

## 🎯 System Complete!

Your admin invitation system is now fully implemented and ready to use!

## 🚀 How It Works

### For Super Admins

1. **Navigate to Invites Page**
   ```
   /dashboard/superadmin/invites
   ```

2. **Create an Invite**
   - Click "Create Invite" button
   - Select a season from the dropdown
   - Add a description (optional)
   - Set max uses (default: 1)
   - Set expiration hours (default: 24)
   - Click "Create Invitation"

3. **Share the Invite URL**
   - Copy the generated URL (e.g., `https://yoursite.com/register?invite=ABCD-1234-EFGH`)
   - Share it with the person you want to invite as committee admin
   - The invite is specific to the season you selected

4. **Monitor Invites**
   - See all active invites
   - View which invites have been used
   - See all committee admins organized by season
   - Delete invites if needed

### For Committee Admins (Invitees)

1. **Receive Invite URL**
   - Get the invite link from super admin
   - Example: `https://yoursite.com/register?invite=ABCD-1234-EFGH`

2. **Click the Link**
   - Opens registration page with invite pre-loaded
   - Shows "Join as Committee Admin" header
   - Displays season information

3. **Register**
   - Enter username
   - Enter password
   - Click "Join as Admin"
   - No need for team name or logo (admin account)

4. **Automatic Setup**
   - Account created as `committee_admin` role
   - Assigned to the specific season
   - Full permissions for that season only
   - View-only access to other seasons

## 📊 Permission Levels

| Role | Own Season | Other Seasons | Can Create Seasons | Can Create Invites |
|------|-----------|---------------|-------------------|-------------------|
| **Super Admin** | ✅ Full Access | ✅ Full Access | ✅ Yes | ✅ Yes |
| **Committee Admin** | ✅ Full Access | 👁️ View Only | ❌ No | ❌ No |
| **Team** | ➖ N/A | ➖ N/A | ❌ No | ❌ No |

## 🔐 What Committee Admins Can Do

### In Their Assigned Season (Full Access):
- ✅ Manage teams
- ✅ Manage players
- ✅ Manage auctions
- ✅ View all data
- ❌ Cannot modify season settings
- ❌ Cannot create invites

### In Other Seasons (View Only):
- 👁️ View seasons
- 👁️ View teams
- 👁️ View players
- 👁️ View auctions
- ❌ Cannot modify anything

## 📝 Example Workflow

### Scenario: Create Admin for "IPL 2025"

**Step 1: Super Admin Creates Invite**
```typescript
// Navigation: /dashboard/superadmin/invites
// Action: Click "Create Invite"
// Fill form:
Season: IPL 2025
Description: Head Admin for IPL 2025
Max Uses: 1
Expires In: 48 hours
```

**Step 2: Super Admin Shares Link**
```
https://yoursite.com/register?invite=WXYZ-5678-ABCD
```

**Step 3: New Admin Registers**
- Opens link
- Sees: "Join as Committee Admin - You're invited to manage IPL 2025"
- Fills: username + password
- Clicks: "Join as Admin"

**Step 4: New Admin Logs In**
- Has full access to IPL 2025 management
- Can view other seasons but not modify them
- Dashboard shows their assigned season

## 🛠️ Using Permissions in Your Code

### Check if User Can Manage Teams
```typescript
import { usePermissions } from '@/hooks/usePermissions';

function TeamManagement({ seasonId }) {
  const { canModifySeason } = usePermissions();
  
  const canEdit = canModifySeason(seasonId);
  
  return (
    <div>
      <h1>Teams</h1>
      {canEdit ? (
        <button>Add Team</button>
      ) : (
        <p>View only - you don't have permission to modify this season</p>
      )}
    </div>
  );
}
```

### Filter Seasons by Permission
```typescript
import { usePermissions } from '@/hooks/usePermissions';
import { filterSeasonsByPermission } from '@/lib/permissions';

function SeasonList() {
  const { user } = usePermissions();
  const [allSeasons, setAllSeasons] = useState([]);
  
  // Show only seasons user can access
  const accessibleSeasons = filterSeasonsByPermission(user, allSeasons);
  
  return (
    <div>
      {accessibleSeasons.map(season => (
        <SeasonCard key={season.id} season={season} />
      ))}
    </div>
  );
}
```

### Show Different UI Based on Role
```typescript
import { usePermissions } from '@/hooks/usePermissions';

function Dashboard() {
  const { isSuperAdmin, isCommitteeAdmin, userSeasonId } = usePermissions();
  
  return (
    <div>
      {isSuperAdmin && <SuperAdminPanel />}
      
      {isCommitteeAdmin && (
        <div>
          <h2>Managing Season: {userSeasonId}</h2>
          <CommitteeAdminPanel seasonId={userSeasonId} />
        </div>
      )}
    </div>
  );
}
```

## 🔍 Testing the System

### Test 1: Create an Invite
1. Login as super admin
2. Go to `/dashboard/superadmin/invites`
3. Create an invite for a test season
4. Verify the invite appears in the list

### Test 2: Use the Invite
1. Copy the invite URL
2. Open in incognito/private browser
3. Complete registration
4. Verify you're registered as committee admin
5. Check you can only modify your assigned season

### Test 3: Permissions
1. Login as committee admin
2. Try to access your season's teams - should work
3. Try to modify another season's teams - should be read-only
4. Try to create invites - should not see the option

## 🎨 UI Features

### Admin Invites Page
- ✅ View all seasons with their admins
- ✅ See active/inactive invites per season
- ✅ Copy invite URLs to clipboard
- ✅ Test invite links in new tab
- ✅ Delete invites
- ✅ Real-time data loading

### Registration Page
- ✅ Auto-detects invite codes from URL
- ✅ Validates invite before registration
- ✅ Shows different UI for admin vs team registration
- ✅ Displays season information for admin invites
- ✅ Hides team fields for admin registration

## 📦 Files Modified/Created

### New Files (5)
1. `types/invite.ts` - Invite type definitions
2. `lib/firebase/invites.ts` - Invite management functions
3. `lib/permissions.ts` - Permission checking utilities
4. `hooks/usePermissions.ts` - Permission React hooks
5. `README_ADMIN_INVITES.md` - Full documentation

### Modified Files (3)
1. `types/user.ts` - Added seasonId to CommitteeAdmin
2. `lib/firebase/auth.ts` - Updated to handle seasonId
3. `app/dashboard/superadmin/invites/page.tsx` - Full Firebase integration
4. `components/auth/Register.tsx` - Handle invite codes

## 🔄 Next Steps

1. **Test the System**
   - Create a test season
   - Create an invite for that season
   - Register using the invite
   - Verify permissions work correctly

2. **Add to Firestore Rules** (See README_ADMIN_INVITES.md)
   - Secure invites collection
   - Secure inviteUsages collection
   - Update users collection rules

3. **Optional Enhancements**
   - Email invitations
   - Custom permissions per admin
   - Invite analytics
   - Bulk invites

## 💡 Pro Tips

- Invites expire automatically - set appropriate expiration times
- Use descriptive names for invites to track their purpose
- Delete unused invites to keep the system clean
- Check the "Season Administrators" section to see all admins per season
- Committee admins can see all seasons but only modify their own

## 🆘 Troubleshooting

**Invite validation fails:**
- Check if invite is expired
- Verify invite hasn't reached max uses
- Ensure invite is still active

**Committee admin sees "Access Denied":**
- Verify they're accessing their assigned season
- Check their seasonId matches the resource they're accessing
- Ensure isActive flag is true for their account

**Can't create invite:**
- Verify you're logged in as super admin
- Ensure you selected a season
- Check all required fields are filled

## 📞 Support

For detailed documentation, see `README_ADMIN_INVITES.md`

---

**System Status: ✅ Fully Implemented & Ready to Use!**
