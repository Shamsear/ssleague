# Team Logo Migration Script

## Overview
This migration script copies team logos from the `users` collection to the `teams` collection in Firebase.

## Why This Migration?
Previously, team logos were only stored in the `users` collection (`logoUrl` field). To improve data consistency and make it easier to fetch team information, we now store logos in both places:
- `users.logoUrl` - For user account context
- `teams.logo_url` - For team entity context

## What This Script Does
1. Fetches all users with `role='team'`
2. For each user with a `logoUrl`:
   - Finds the corresponding team document
   - Updates the team document with `logo_url` from `users.logoUrl`
3. Provides detailed progress output and summary

## Prerequisites
- Node.js installed
- Firebase Admin SDK configured
- Environment variables set (`.env.local`)

## How to Run

```bash
# Using tsx (recommended)
npx tsx scripts/migrate-team-logos.ts

# Or compile and run
npx tsc scripts/migrate-team-logos.ts
node scripts/migrate-team-logos.js
```

## Expected Output

```
🚀 Starting team logo migration...

📋 Step 1: Fetching team users with logos...
Found 15 team users

⏭️  Skipping Team A (uid123) - No logo
✅ Updated Team B (uid456)
   Logo: https://ik.imagekit.io/...
✓ Team C (uid789) - Logo already up to date

============================================================
📊 Migration Summary:
============================================================
✅ Successfully updated: 10
⏭️  Skipped (no change needed): 5
❌ Errors: 0
📝 Total processed: 15

✨ Migration completed!

👋 Done!
```

## Safety Features
- **Idempotent**: Safe to run multiple times - skips teams that already have the correct logo
- **Non-destructive**: Only updates, never deletes
- **Error handling**: Continues processing even if individual teams fail
- **Detailed logging**: Shows exactly what's being updated

## What Happens After Migration?

After running this script:
1. All existing team logos will be available in `teams.logo_url`
2. Future logo uploads will automatically save to both collections
3. APIs will fetch logos from `teams` collection first, with fallback to `users`

## API Updates
The following APIs have been updated to fetch from `teams.logo_url`:
- `/api/teams` - List all teams
- `/api/teams/[id]/all-seasons` - Team detail page

## Manual Verification

You can verify the migration by checking a team document:

```javascript
// In Firebase console or using admin SDK
const team = await adminDb.collection('teams').doc('TEAM_ID').get();
console.log(team.data().logo_url); // Should show the logo URL
```

## Rollback
If you need to rollback, you can simply delete the `logo_url` field from teams:

```javascript
// This is just for reference - you don't need to run this
const teamsSnapshot = await adminDb.collection('teams').get();
const batch = adminDb.batch();
teamsSnapshot.docs.forEach(doc => {
  batch.update(doc.ref, { logo_url: null });
});
await batch.commit();
```

## Support
If you encounter any issues:
1. Check the error output from the script
2. Verify your Firebase credentials
3. Ensure the teams documents exist before running
