# Migration Scripts

## migrate-realplayers.js

**Purpose:** Clean up the `realplayers` collection by removing all season-specific data.

### What it does:

1. **Removes season-specific fields:**
   - `category`, `category_id`
   - `team`, `team_id`
   - `season_id`, `season_name`
   - `stats` (all statistics)
   - `round_performance`
   - `potm_awards`, `is_potm`
   - `ranking`, `played`, `points`, `goals_scored`, `clean_sheets`

2. **Keeps permanent fields:**
   - `player_id`, `name`, `display_name`
   - `email`, `phone`
   - `role` (player/captain/vice_captain)
   - `psn_id`, `xbox_id`, `steam_id`
   - `is_registered`, `is_active`, `is_available`
   - `notes`, `profile_image`
   - Timestamps: `created_at`, `updated_at`, `joined_date`, `registered_at`

3. **Handles duplicate documents:**
   - Ensures document ID matches `player_id`
   - Removes duplicate documents if found
   - Consolidates player data into single document per player

### Prerequisites:

1. Make sure you have `serviceAccountKey.json` in the project root
2. Node.js installed on your system
3. Firebase Admin SDK installed:
   ```bash
   npm install firebase-admin
   ```

### How to run:

```bash
# Navigate to project directory
cd C:\Drive d\SS\nosqltest\nextjs-project

# Run the migration script
node scripts/migrate-realplayers.js
```

### Expected Output:

```
🚀 Starting migration of realplayers collection...

📊 Found 50 documents to process

Processing: SHAMEEM H (sspslpsl0015)
  🗑️  Removing: category
  🗑️  Removing: team
  🗑️  Removing: season_id
  🗑️  Removing: stats
  ✅ Processed successfully

...

💾 Committing batch of 50 operations...

============================================================
✅ Migration completed!
============================================================
📊 Total documents processed: 50
❌ Errors encountered: 0

📝 Next steps:
   1. Re-import historical seasons to populate realplayerstats collection
   2. Verify player data in the UI
   3. Check that all season-specific data is removed from realplayers
```

### After Migration:

1. **Re-import all historical seasons:**
   - Go to Super Admin > Historical Seasons
   - Import each season's Excel file again
   - This will populate the `realplayerstats` collection

2. **Verify the data:**
   - Check Firebase Console:
     - `realplayers` should have only permanent fields
     - `realplayerstats` should have all season-specific data
   - Check player detail pages in the UI
   - Verify that all tabs show correct data

### Safety:

- ✅ **Non-destructive:** Only removes specified fields from documents
- ✅ **Batch operations:** Commits in batches to avoid timeouts
- ✅ **Error handling:** Continues processing even if individual documents fail
- ✅ **Logging:** Detailed console output for tracking progress

### Troubleshooting:

**Error: "serviceAccountKey.json not found"**
- Make sure the service account key file is in the project root directory

**Error: "Permission denied"**
- Check that your service account has Firestore read/write permissions

**Script hangs or times out:**
- The script processes in batches of 400 documents
- For very large collections (1000+ documents), this may take several minutes
- Let it complete - you'll see progress messages

### Rollback:

If something goes wrong:
1. You still have all the data in `realplayers` (just with fields deleted)
2. Re-importing historical seasons will restore the season-specific data
3. Or restore from a Firestore backup if you have one

### Questions?

This migration is designed to prepare your database for the new two-collection architecture where:
- `realplayers` = permanent player info
- `realplayerstats` = season-specific stats (one doc per player per season)
