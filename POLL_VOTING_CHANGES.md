# Poll Voting System Changes

## Summary
Removed Gmail authentication and IP address tracking from the poll voting system. The system now uses simple name-based voting with device fingerprint tracking.

## Changes Made

### 1. Frontend Changes (`app/polls/[pollId]/page.tsx`)

**Removed:**
- All Google authentication imports and dependencies
- `useAuth` hook usage
- `fetchWithTokenRefresh` usage
- Google Sign-In button and handler
- Authentication state checks (`isAuthenticated`, `authLoading`)
- Redirect result handling for mobile sign-in
- Page caching prevention logic
- `checkIfVoted` function that required email

**Added:**
- `voterName` state for capturing user's name
- Name input field in the UI
- Simple name validation (minimum 3 characters)

**Modified:**
- Vote submission now only requires:
  - Voter name (entered by user)
  - Device fingerprint (auto-generated)
  - Selected option
- Vote button is disabled until both name and option are selected

### 2. Backend Changes (`app/api/polls/[pollId]/vote/route.ts`)

**Removed:**
- `voter_email` requirement
- IP address tracking (`x-forwarded-for`, `x-real-ip` headers)
- Email-based authentication check

**Modified:**
- `user_id` generation: Changed from email-based to name + device fingerprint based
  ```typescript
  // Old: Based on email
  const userId = `user_${Buffer.from(voter_email).toString('base64').slice(0, 20)}`;
  
  // New: Based on name + device fingerprint
  const userId = `user_${Buffer.from(voter_name.toLowerCase().trim() + device_fingerprint).toString('base64').slice(0, 20)}`;
  ```

- Database INSERT: IP address field now set to `NULL` instead of actual IP
- Console logging: Removed email reference
- GET endpoint: Now accepts `voter_name` and `device_fingerprint` instead of `voter_email`

## Duplicate Vote Prevention

The system prevents duplicate votes using:

1. **Primary Check**: Unique combination of `voter_name` + `device_fingerprint`
   - Each unique name + device combination can only vote once
   - Database constraint: `(poll_id, user_id)` where `user_id` is derived from name + fingerprint

2. **Device Fingerprint**: Generated from:
   - User agent
   - Screen resolution
   - Canvas fingerprinting
   - Combined into a unique hash

3. **Flagging System**: Still active
   - Votes from the same device with different names are flagged
   - Flagged votes are recorded but marked for admin review

## Benefits

✅ **No Authentication Required**: Users can vote without signing in
✅ **Privacy Friendly**: No IP address tracking (prevents issues for users behind same network/NAT)
✅ **Simple UX**: Just enter name and vote
✅ **Still Secure**: Device fingerprinting prevents most duplicate votes
✅ **Name Validation**: 
   - Minimum 3 characters
   - Only letters and spaces allowed
   - Blocks common fake names (test, asdf, admin, etc.)

## Potential Limitations

⚠️ **Name Collisions**: Two different people with the same name on the same device cannot both vote
⚠️ **Device Switching**: Same person can vote from multiple devices
⚠️ **Incognito Mode**: May allow duplicate votes if device fingerprint changes
⚠️ **Name Spoofing**: Users could potentially use someone else's name (mitigated by device fingerprint)

## Database Schema

The `poll_votes` table still has the `ip_address` column but it's now set to `NULL` for all new votes. This maintains backward compatibility with existing data.

## Testing Recommendations

1. Test voting with same name on different devices
2. Test voting with different names on same device (should flag)
3. Test name validation (special characters, short names, fake names)
4. Verify device fingerprint generation works across browsers
5. Test in incognito/private browsing mode
