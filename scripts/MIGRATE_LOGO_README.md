# Logo Field Migration

## Overview
This script consolidates all logo-related fields in the `users` collection to a single standardized field: `logoUrl`.

## What it does:
1. ✅ Finds the best logo URL from: `logoUrl`, `teamLogoUrl`, or `team_logo_url`
2. ✅ Sets it as `logoUrl` (the standard field)
3. ✅ Removes old fields: `teamLogoUrl`, `team_logo_url`, `teamLogo`
4. ✅ Consolidates `teamLogoFileId` → `logoFileId`
5. ✅ Keeps only one field: `logoUrl`

## Before running:
Make sure your `.env.local` has these Firebase Admin credentials:
```
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account@firebase.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

## How to run:

```bash
# Using tsx (recommended)
npx tsx scripts/migrate-logo-fields.ts

# OR using ts-node
npx ts-node scripts/migrate-logo-fields.ts
```

## What to expect:
```
🚀 Starting logo field migration...

📊 Found 15 users

✅ Migrated psychoz
   Logo URL: https://ik.imagekit.io/ssleague/team-logos/...
   Removed fields: teamLogoUrl, teamLogo

✅ Migrated classic_tens
   Logo URL: https://ik.imagekit.io/ssleague/team-logos/...
   Removed fields: teamLogoUrl

⏭️  Skipping user123 - No logo URL found

📊 Migration Summary:
✅ Successfully migrated: 12
⏭️  Skipped (no logo): 2
❌ Errors: 0

✨ Migration complete!
```

## After migration:
- All users will have only `logoUrl` field for their team logo
- The `/api/teams` route now only checks for `logoUrl`
- All upload pages update only `logoUrl`
- Consistent data structure across the app ✨

## Rollback:
If you need to rollback, you would need to restore from a Firebase backup. **It's recommended to backup your Firestore data before running this migration.**

## Safety:
- ✅ Non-destructive: Only removes duplicate/old fields
- ✅ Preserves the logo URL (picks the best available)
- ✅ Shows detailed progress for each user
- ✅ Handles errors gracefully
