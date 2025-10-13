# Registration Pages Implementation Plan

## Overview
The registration system allows committee admins to manage team and player registrations for their assigned season. Teams can register through unique links, and individual players can self-register.

## Pages to Create

### 1. Committee Registration Management (`/dashboard/committee/registration`)
**File:** `app/dashboard/committee/registration/page.tsx`

**Purpose:** Main control panel for committee admins to manage registrations

**Features:**
- Display registration statistics (total teams, registered, available)
- Season registration control (open/close)
- Team registration link generation and sharing
- Player registration link generation
- List of registered vs available teams
- Ability to manually add/remove teams from season

**Key Components:**
- Registration status toggle
- Copy-to-clipboard registration links
- Team lists with add/remove actions
- Statistics cards

---

### 2. Team Registration Form (`/registration/team/[seasonId]`)
**File:** `app/registration/team/[seasonId]/page.tsx`

**Purpose:** Public form for teams to register for a specific season

**Features:**
- Team name input
- Team logo upload
- Username and password creation
- Season information display
- Terms acceptance

**Note:** This creates both a user account and a team

---

### 3. Team Registration Success (`/registration/team/success`)
**File:** `app/registration/team/success/page.tsx`

**Purpose:** Confirmation page after successful team registration

**Features:**
- Display team details
- Registration ID
- Next steps information
- Links to dashboard

---

### 4. My Registrations (`/registration/my-team`)
**File:** `app/registration/my-team/page.tsx`

**Purpose:** Allow team users to view their registration status

**Features:**
- Team registration details
- Season assignment status
- Current balance (if assigned)
- Pending assignment notice

---

### 5. Player Registration Search (`/registration/player/[seasonId]`)
**File:** `app/registration/player/[seasonId]/page.tsx`

**Purpose:** Allow individual players to search and register themselves

**Features:**
- Search by Player ID or full name
- Live search with pagination
- Player list with status (available, registered)
- Select player for registration
- Player details display

---

### 6. Player Verification (`/registration/player/[seasonId]/verify`)
**File:** `app/registration/player/[seasonId]/verify/page.tsx`

**Purpose:** Verify player details before final registration

**Features:**
- Display selected player information
- Confirm/cancel options
- Important notes about registration

---

### 7. Player Registration Success (`/registration/player/success`)
**File:** `app/registration/player/success/page.tsx`

**Purpose:** Confirmation page after successful player registration

**Features:**
- Player details
- Season details
- What's next information
- Important notes

---

### 8. Season Invitation Form (`/registration/season/[teamId]`)
**File:** `app/registration/season/[teamId]/page.tsx`

**Purpose:** Allow existing teams to accept/decline season invitations

**Features:**
- Season details
- Team information
- Starting balance information
- Accept/decline buttons
- What to expect section

---

## Data Flow

### Team Registration Flow:
1. Committee admin opens registration
2. Admin shares team registration link
3. Team fills out registration form
4. Account and team created in Firebase
5. Team awaits admin approval/season assignment
6. Success page displays next steps

### Player Registration Flow:
1. Committee admin shares player registration link
2. Player searches for their profile by ID or name
3. Player selects their profile
4. System verifies player details
5. Player confirms registration
6. Player assigned to season
7. Success page displays confirmation

## Firebase Collections Involved

### Teams Collection
- `season_id`: Links team to season
- `team_name`, `team_code`, `balance`
- `is_active`: Registration status
- `owner_uid`: Link to user account

### Seasons Collection
- `registrationOpen`: Controls if registration is accepting new teams
- `status`: Season status (draft, active, completed)
- `totalTeams`: Count of registered teams

### Users Collection (for team accounts)
- `role`: 'team'
- `username`, `email`
- `team_id`: Link to team

### RealPlayers Collection (for individual players)
- `season_id`: Current season registration
- `player_id`: Unique identifier (sspslpsl###)
- `name`: Full name

## Routes Structure

```
/dashboard/committee/registration          → Committee management page

/registration/
  team/
    [seasonId]/                            → Team registration form
    success/                               → Team success page
  
  player/
    [seasonId]/                            → Player search page
    [seasonId]/verify                      → Player verification
    success/                               → Player success page
  
  season/
    [teamId]/                              → Season invitation
  
  my-team/                                 → View my registration
```

## API Endpoints Needed

### For Committee Admin:
- Toggle registration status
- Get teams by season
- Add/remove team to/from season

### For Team Registration:
- Create team account
- Upload team logo
- Check username availability

### For Player Registration:
- Search players by ID or name (with pagination)
- Get player details
- Confirm player registration

## Security Considerations

1. **Committee Pages:** Only accessible by committee_admin role
2. **Public Registration:** No authentication required but validated
3. **Season Assignment:** Only committee admins can assign teams
4. **Player Data:** Protect sensitive player information
5. **Registration Links:** Time-based or token-based validation

## Next Steps

1. Start with committee registration management page
2. Create team registration form
3. Create player registration search
4. Implement success pages
5. Add navigation links from committee dashboard
6. Test registration workflows

## Dependencies

- Firebase Auth (for team account creation)
- Firebase Storage (for logo uploads)
- Firestore (for all data)
- Next.js routing
- Permission hooks (usePermissions)
- Auth context (useAuth)

## Notes

- All pages use the existing design system (glass morphism, gradients)
- Mobile-responsive design required
- Real-time updates where possible
- Clear error handling and user feedback
- Clipboard functionality for sharing links
