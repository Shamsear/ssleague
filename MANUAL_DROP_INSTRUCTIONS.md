# Manual Instructions to Drop Unused Tables

## Issue
The automated scripts successfully execute DROP TABLE commands, but the tables persist in the database. This suggests there may be:
- Multiple database connections
- Schema/connection issues
- Replication lag

## Tables to Drop Manually

Please go to your Neon console (https://console.neon.tech) and execute these SQL commands:

```sql
-- Drop old/unused tables
DROP TABLE IF EXISTS auction_rounds CASCADE;
DROP TABLE IF EXISTS round_players CASCADE;
DROP TABLE IF EXISTS round_bids CASCADE;
DROP TABLE IF EXISTS teams CASCADE;
```

## Tables to KEEP

These tables are actively used by your application:

1. ✅ **rounds** - Current auction rounds
2. ✅ **bids** - Team bids for players
3. ✅ **team_players** - Player assignments after finalization
4. ✅ **footballplayers** - Player data (imported from API)
5. ✅ **starred_players** - Players favorited by teams
6. ✅ **auction_settings** - Auction configuration settings

## Why Drop These Tables?

- **auction_rounds** - Old schema, replaced by `rounds` table
- **round_players** - Old schema, replaced by `bids` table
- **round_bids** - Duplicate/old schema
- **teams** - Teams are stored in Firebase, not needed in Neon

## Verification

After dropping, verify with:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

You should only see:
- auction_settings
- bids
- footballplayers
- rounds
- starred_players
- team_players
