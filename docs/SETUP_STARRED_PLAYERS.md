# Quick Setup Guide: Starred Players Feature

## Step 1: Run the Database Migration

You need to create the `starred_players` table in your Neon database.

### Option A: Using Neon Dashboard (Recommended)

1. Go to your Neon Dashboard: https://console.neon.tech/
2. Select your project and database
3. Click on **SQL Editor**
4. Copy and paste the contents of `migrations/create_starred_players_table.sql`
5. Click **Run** to execute the migration

### Option B: Using psql Command Line

```bash
# Get your connection string from Neon dashboard
psql "postgresql://[your-connection-string]"

# Run the migration
\i migrations/create_starred_players_table.sql

# Verify the table was created
\d starred_players

# Exit psql
\q
```

### Option C: Using a SQL Client (DBeaver, TablePlus, etc.)

1. Connect to your Neon database using your preferred SQL client
2. Open the migration file: `migrations/create_starred_players_table.sql`
3. Execute the SQL script

## Step 2: Verify the Migration

Run this query to confirm the table exists:

```sql
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'starred_players';
```

Expected output:
```
table_name       | column_name | data_type
-----------------|-------------|--------------------
starred_players  | id          | integer
starred_players  | team_id     | character varying
starred_players  | player_id   | integer
starred_players  | starred_at  | timestamp without time zone
```

## Step 3: Test the Feature

The API endpoints are already updated and ready to use. No code changes needed!

### Test with curl (or Postman)

**Star a player:**
```bash
curl -X POST http://localhost:3000/api/players/star/1 \
  -H "Cookie: session=YOUR_SESSION_COOKIE"
```

**Unstar a player:**
```bash
curl -X POST http://localhost:3000/api/players/unstar/1 \
  -H "Cookie: session=YOUR_SESSION_COOKIE"
```

**Get starred players:**
```bash
curl http://localhost:3000/api/players/starred \
  -H "Cookie: session=YOUR_SESSION_COOKIE"
```

### Test in the Browser

1. Navigate to the **Player Database** page in your team dashboard
2. Click the star icon next to any player
3. The star should fill/unfill based on the starred status
4. Check the "Show Only Starred Players" checkbox to filter
5. Refresh the page - starred status should persist

## Step 4: (Optional) Migrate Existing Data

If you have existing starred players in the old `is_starred` column, you can migrate them:

**⚠️ Important**: Replace `YOUR_TEAM_ID` with an actual Firebase team UID

```sql
-- Check if there are any starred players
SELECT COUNT(*) FROM footballplayers WHERE is_starred = true;

-- Migrate them to the new table (replace YOUR_TEAM_ID)
INSERT INTO starred_players (team_id, player_id)
SELECT 'YOUR_TEAM_ID', id
FROM footballplayers
WHERE is_starred = true
ON CONFLICT (team_id, player_id) DO NOTHING;
```

## Step 5: (Optional) Clean Up Old Column

After confirming everything works with the new system, you can remove the old column:

```sql
-- ⚠️ Only run this after thorough testing!
ALTER TABLE footballplayers DROP COLUMN IF EXISTS is_starred;
```

## Troubleshooting

### Error: foreign key constraint cannot be implemented (SQLSTATE 42804)
- This means there's a data type mismatch
- The `footballplayers.id` is `VARCHAR(255)`, not `INTEGER`
- **Solution**: Use the fixed migration script `migrations/fix_starred_players_table.sql`
- If you already created the table with wrong data type:
  ```sql
  -- Drop the incorrect table
  DROP TABLE IF EXISTS starred_players CASCADE;
  
  -- Then run: migrations/fix_starred_players_table.sql
  ```

### Error: relation "starred_players" does not exist
- The migration hasn't been run yet
- Solution: Run the migration script from Step 1

### Error: duplicate key value violates unique constraint
- Trying to star a player that's already starred
- This is expected behavior (prevented by UNIQUE constraint)
- The API handles this gracefully with ON CONFLICT DO NOTHING

### Starred status not showing
- Check if you're logged in (session cookie exists)
- Check browser console for API errors
- Verify the `/api/players/database` endpoint is returning `is_starred` field

### Stars not persisting after refresh
- Check if the star/unstar API calls are returning success
- Verify database has the starred record: 
  ```sql
  SELECT * FROM starred_players WHERE team_id = 'YOUR_TEAM_ID';
  ```

## Verification Checklist

- [ ] Migration executed successfully
- [ ] `starred_players` table exists with correct schema
- [ ] Indexes are created
- [ ] Can star a player from the UI
- [ ] Can unstar a player from the UI
- [ ] Starred status persists after page reload
- [ ] "Show Only Starred Players" filter works
- [ ] Different teams see different starred players (test with 2 accounts)

## Next Steps

Once the feature is working:

1. Test with multiple team accounts to ensure independence
2. Consider setting a limit on starred players per team
3. Add analytics to track most-starred players
4. Consider adding categories or notes to starred players

## Support

If you encounter issues:
1. Check the browser console for errors
2. Check the server logs for API errors
3. Verify your Neon database connection string
4. Ensure Firebase authentication is working

## API Documentation

See `docs/STARRED_PLAYERS_FEATURE.md` for complete API documentation and usage examples.
