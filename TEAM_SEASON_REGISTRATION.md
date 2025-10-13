# Team Season Registration Implementation

## Overview
This document describes the team season registration flow that allows committees to invite teams to join specific seasons via invitation links.

## Flow

### 1. Committee Generates Invitation Link
- Committee admin creates a season
- System generates invitation link: `/register/team?season=<seasonId>`
- Committee shares this link with teams

### 2. Team Receives Invitation
- Team clicks the invitation link
- Must be logged in (redirected to login if not)
- Must have 'team' role (redirected to dashboard if not)

### 3. Team Views Season Details
- **Frontend**: `app/register/team/page.tsx`
- **API**: `GET /api/seasons/[seasonId]`
- Displays:
  - Season name and status
  - Starting balance (£15,000)
  - Team information
  - Season features and expectations
  - Important notes about decision finality

### 4. Team Makes Decision
- **Join Season**: Team gets registered with starting balance
- **Decline Season**: Recorded as declined, can join future seasons

### 5. Registration Processing
- **API**: `POST /api/seasons/[seasonId]/register`
- Creates record in `team_seasons` collection
- Updates season participant count (if joining)
- Redirects to team dashboard

## API Endpoints

### GET `/api/seasons/[seasonId]`
Fetches season details for the registration page.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "season_id",
    "name": "Season Name",
    "short_name": "Short Name",
    "is_active": false,
    "status": "upcoming",
    "starting_balance": 15000,
    "created_at": "timestamp",
    "updated_at": "timestamp"
  }
}
```

### POST `/api/seasons/[seasonId]/register`
Handles team registration decision.

**Authentication:**
- Requires valid JWT token in cookies
- Only teams (role='team') can access
- Token verified using jose library

**Request Body:**
```json
{
  "action": "join" | "decline"
}
```

**Response (Join):**
```json
{
  "success": true,
  "message": "Successfully joined Season Name!",
  "data": {
    "season_id": "season_id",
    "season_name": "Season Name",
    "starting_balance": 15000,
    "status": "registered"
  }
}
```

**Response (Decline):**
```json
{
  "success": true,
  "message": "You have declined Season Name. You can join future seasons.",
  "data": {
    "season_id": "season_id",
    "season_name": "Season Name",
    "status": "declined"
  }
}
```

## Firestore Collections

### `team_seasons`
Stores team participation status for each season.

**Document ID:** `{userId}_{seasonId}`

**Fields (when joining):**
```javascript
{
  team_id: "user_id",
  season_id: "season_id",
  team_name: "Team Name",
  team_email: "team@example.com",
  team_logo: "base64_string_or_url",
  status: "registered",
  budget: 15000,
  starting_balance: 15000,
  total_spent: 0,
  players_count: 0,
  position_counts: {
    GK: 0,
    CB: 0,
    LB: 0,
    RB: 0,
    DMF: 0,
    CMF: 0,
    AMF: 0,
    LMF: 0,
    RMF: 0,
    LWF: 0,
    RWF: 0,
    SS: 0,
    CF: 0
  },
  joined_at: serverTimestamp(),
  created_at: serverTimestamp(),
  updated_at: serverTimestamp()
}
```

**Fields (when declining):**
```javascript
{
  team_id: "user_id",
  season_id: "season_id",
  team_name: "Team Name",
  team_email: "team@example.com",
  team_logo: "base64_string_or_url",
  status: "declined",
  budget: 0,
  starting_balance: 0,
  total_spent: 0,
  players_count: 0,
  position_counts: {
    GK: 0,
    CB: 0,
    LB: 0,
    RB: 0,
    DMF: 0,
    CMF: 0,
    AMF: 0,
    LMF: 0,
    RMF: 0,
    LWF: 0,
    RWF: 0,
    SS: 0,
    CF: 0
  },
  declined_at: serverTimestamp(),
  created_at: serverTimestamp(),
  updated_at: serverTimestamp()
}
```

### `seasons`
When a team joins, the season document is updated:
```javascript
{
  participant_count: increment(1),  // Incremented by 1
  updated_at: serverTimestamp()
}
```

## Security Features

### Authentication
- JWT token validation using `jose` library
- Token must be present in cookies
- Token must be valid and not expired
- User must have 'team' role

### Validation
- Season ID validation
- Action validation (must be 'join' or 'decline')
- Duplicate registration prevention
- Team existence verification
- Season existence verification

### Error Handling
- 401: Unauthorized (no token or invalid token)
- 403: Forbidden (non-team user)
- 404: Not found (invalid season or team)
- 400: Bad request (duplicate registration, invalid action)
- 500: Internal server error

## UI Features

### Design
- Beautiful gradient backgrounds
- Glass morphism effects
- Responsive layout (mobile-friendly)
- Loading states
- Confirmation dialogs

### User Experience
- Clear season information display
- Visual status badges (active/upcoming)
- "What to Expect" section
- Important notes section
- Disabled state during submission
- Success/error alerts
- Automatic redirect after decision

### Accessibility
- Semantic HTML
- Clear button labels
- Keyboard navigation support
- Loading indicators

## Dependencies

### NPM Packages
- `jose`: JWT verification library
- Installed via: `npm install jose`

### Next.js Features
- Server Components
- Client Components (with 'use client')
- Suspense for loading states
- Next.js App Router
- Cookie handling (next/headers)

### Firebase
- Firestore for data storage
- Authentication context
- Server timestamps
- Incremental updates

## Testing Checklist

- [ ] Team can access registration page via invitation link
- [ ] Non-authenticated users redirected to login
- [ ] Non-team users redirected to dashboard
- [ ] Season details display correctly
- [ ] Join action creates team_seasons record
- [ ] Join action increments season participant_count
- [ ] Decline action creates declined record
- [ ] Duplicate registration is prevented
- [ ] Invalid season ID returns 404
- [ ] Invalid token returns 401
- [ ] Non-team role returns 403
- [ ] Success messages display correctly
- [ ] Redirects to dashboard after decision
- [ ] Loading states work correctly
- [ ] Responsive on mobile devices

## Future Enhancements

1. **Email Notifications**: Send confirmation emails after registration
2. **Team Dashboard Integration**: Show registered seasons on team dashboard
3. **Withdrawal Feature**: Allow teams to withdraw from seasons (with committee approval)
4. **Multi-Season Support**: Allow teams to be invited to multiple seasons
5. **Invitation Expiry**: Add expiration dates to invitation links
6. **Custom Messages**: Allow committees to add custom welcome messages
7. **Bulk Invitations**: Send invitations to multiple teams at once
8. **Registration History**: Track registration decisions and timestamps

## Related Files

- **Frontend**: `app/register/team/page.tsx`
- **API (Season Details)**: `app/api/seasons/[seasonId]/route.ts`
- **API (Registration)**: `app/api/seasons/[seasonId]/register/route.ts`
- **Auth Context**: `contexts/AuthContext.tsx`
- **Firebase Config**: `lib/firebase/config.ts`

## Environment Variables

Ensure these are set in your `.env.local`:

```env
JWT_SECRET=your-secret-key-min-32-characters
```

## Support

For issues or questions:
1. Check Firestore security rules allow team_seasons read/write
2. Verify JWT_SECRET is set correctly
3. Ensure Firebase collections exist
4. Check browser console for detailed errors
5. Review API logs for backend errors
