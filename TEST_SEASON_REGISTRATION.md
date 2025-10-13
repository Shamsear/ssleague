# Testing Team Season Registration

## Prerequisites

1. **Create a Season in Firestore**
   - Go to Firebase Console > Firestore Database
   - Add a document to the `seasons` collection
   - Example document:
     ```json
     {
       "name": "Test Season 2024",
       "short_name": "TS24",
       "status": "upcoming",
       "is_active": false,
       "starting_balance": 15000,
       "participant_count": 0,
       "created_at": [Firebase Timestamp],
       "updated_at": [Firebase Timestamp]
     }
     ```
   - Note the document ID (e.g., `abc123xyz`)

2. **Create a Test Team Account**
   - Register a team account via `/register`
   - Or use an existing team account
   - Make sure the account is approved (isApproved = true)
   - Note the team's email and password

## Test Steps

### Test 1: Access Registration Page
1. Log out if logged in
2. Access: `http://localhost:3000/register/team?season=<seasonId>`
3. **Expected**: Redirected to login page

### Test 2: Login as Team
1. Login with team credentials
2. **Expected**: Successful login

### Test 3: View Season Details
1. Access: `http://localhost:3000/register/team?season=<seasonId>`
2. **Expected**: 
   - Season registration page displays
   - Shows season name: "Test Season 2024"
   - Shows starting balance: £15,000
   - Shows your team name
   - Two buttons: "Join Test Season 2024" and "Skip This Season"

### Test 4: Join Season
1. Click "Join Test Season 2024" button
2. **Expected**: 
   - Confirmation dialog appears
   - Confirm the action
   - Success alert: "Successfully joined Test Season 2024!"
   - Redirected to team dashboard

### Test 5: Verify in Firestore
1. Go to Firebase Console > Firestore Database
2. Check `team_seasons` collection
3. **Expected**: New document with ID `{teamId}_{seasonId}`
   - status: "registered"
   - budget: 15000
   - starting_balance: 15000
   - team_name: Your team name
   - etc.

4. Check `seasons` collection
5. **Expected**: Season document updated
   - participant_count: 1 (or incremented by 1)

### Test 6: Duplicate Registration Prevention
1. Access registration page again: `http://localhost:3000/register/team?season=<seasonId>`
2. Try to join again
3. **Expected**: 
   - Error alert: "You have already joined this season"

### Test 7: Decline Season (Create New Season First)
1. Create another season in Firestore
2. Access: `http://localhost:3000/register/team?season=<newSeasonId>`
3. Click "Skip This Season" button
4. **Expected**: 
   - Confirmation dialog appears
   - Confirm the action
   - Success alert: "You have declined [Season Name]. You can join future seasons."
   - Redirected to team dashboard

### Test 8: Verify Declined Status
1. Go to Firebase Console > Firestore Database
2. Check `team_seasons` collection
3. **Expected**: New document with ID `{teamId}_{newSeasonId}`
   - status: "declined"
   - budget: 0
   - declined_at: [timestamp]

### Test 9: Invalid Season ID
1. Access: `http://localhost:3000/register/team?season=invalid123`
2. **Expected**: 
   - Error alert: "Season not found or link is invalid"
   - Redirected to team dashboard

### Test 10: No Season Parameter
1. Access: `http://localhost:3000/register/team`
2. **Expected**: 
   - Error alert: "No season ID provided in the link"
   - Redirected to team dashboard

### Test 11: Non-Team User
1. Logout
2. Login as committee admin or super admin
3. Access: `http://localhost:3000/register/team?season=<seasonId>`
4. **Expected**: 
   - Redirected to appropriate dashboard (not team dashboard)

### Test 12: Responsive Design
1. Open browser DevTools
2. Toggle device toolbar (mobile view)
3. Access registration page
4. **Expected**: 
   - Page displays correctly on mobile
   - Buttons are accessible
   - Text is readable

## API Testing with cURL

### Test API Directly (Season Details)
```bash
curl -X GET http://localhost:3000/api/seasons/<seasonId>
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "id": "abc123xyz",
    "name": "Test Season 2024",
    "short_name": "TS24",
    "is_active": false,
    "status": "upcoming",
    "starting_balance": 15000
  }
}
```

### Test API Directly (Registration)
Note: This requires a valid JWT token in cookies, so it's easier to test via the UI.

## Troubleshooting

### Issue: "Unauthorized - No token provided"
- **Solution**: Make sure you're logged in
- Check browser cookies for 'token'

### Issue: "Season not found"
- **Solution**: Verify the season document exists in Firestore
- Check the season ID in the URL

### Issue: "Team not found"
- **Solution**: Verify the user document exists in Firestore
- Check that the user has role='team'

### Issue: Page doesn't load
- **Solution**: 
  - Check Next.js dev server is running
  - Check browser console for errors
  - Verify Firebase config is correct

### Issue: "Internal server error"
- **Solution**: 
  - Check server logs in terminal
  - Verify JWT_SECRET is set in .env.local
  - Check Firebase security rules

## Security Testing

### Test 1: Token Validation
1. Open browser DevTools
2. Go to Application > Cookies
3. Delete or modify the 'token' cookie
4. Try to register for a season
5. **Expected**: "Unauthorized - Invalid token" error

### Test 2: Role Validation
1. Login as a non-team user
2. Manually navigate to registration URL
3. **Expected**: Redirected to dashboard or "Unauthorized" error

## Performance Testing

1. Open browser DevTools > Network tab
2. Access registration page
3. Check:
   - Page loads within 2 seconds
   - API calls complete quickly
   - No unnecessary requests

## Checklist

- [ ] Logged out users are redirected to login
- [ ] Non-team users are redirected to dashboard
- [ ] Season details display correctly
- [ ] Join button creates team_seasons record
- [ ] Join button increments participant_count
- [ ] Decline button creates declined record
- [ ] Duplicate registrations are prevented
- [ ] Invalid season IDs show error
- [ ] Success messages display
- [ ] Redirects work correctly
- [ ] Loading states appear
- [ ] Mobile responsive
- [ ] API security works
- [ ] Firestore data is correct

## Next Steps After Testing

1. **Update Firestore Security Rules** (if needed):
```javascript
match /team_seasons/{teamSeasonId} {
  allow read: if request.auth != null;
  allow write: if request.auth != null && 
               request.auth.token.role == 'team';
}
```

2. **Add to Committee Dashboard**:
   - Add "Generate Invitation Link" button
   - Display link with copy button
   - Show registered teams count

3. **Enhance Team Dashboard**:
   - Show list of registered seasons
   - Display current season status
   - Show budget and remaining balance
