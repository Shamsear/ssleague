# Bulk Tiebreaker Database Migration

## 📋 What This Does

This migration creates 3 new tables for the **Last Person Standing** tiebreaker mechanism:

1. **`bulk_tiebreakers`** - Main tiebreaker records
2. **`bulk_tiebreaker_teams`** - Team participation tracking
3. **`bulk_tiebreaker_bids`** - Bid history for audit trail

Plus 2 helper functions:
- `check_tiebreaker_winner()` - Check if only 1 team left
- `get_tiebreaker_stats()` - Admin dashboard statistics

---

## 🚀 How to Run

### Option 1: Using Neon Dashboard (Recommended)
1. Go to your Neon dashboard: https://console.neon.tech
2. Select your project
3. Go to **SQL Editor**
4. Copy the entire content of `bulk-tiebreaker-tables.sql`
5. Paste and click **Run**
6. You should see success messages

### Option 2: Using psql Command Line
```bash
psql "postgresql://user:pass@host/dbname" -f database/migrations/bulk-tiebreaker-tables.sql
```

### Option 3: Using Node.js Script
```bash
node scripts/run-migration.js bulk-tiebreaker-tables
```

---

## ✅ Verification

After running, verify the tables exist:

```sql
-- Check tables were created
SELECT table_name 
FROM information_schema.tables 
WHERE table_name LIKE 'bulk_tiebreaker%';

-- Should return:
-- bulk_tiebreakers
-- bulk_tiebreaker_teams
-- bulk_tiebreaker_bids

-- Check helper functions
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name LIKE '%tiebreaker%';

-- Should return:
-- check_tiebreaker_winner
-- get_tiebreaker_stats
-- update_bulk_tiebreaker_timestamp
```

---

## 🧪 Test the Migration

You can test with sample data (commented out in the SQL file):

```sql
-- 1. Create a test tiebreaker
INSERT INTO bulk_tiebreakers (
    round_id, player_id, player_name, position, 
    status, teams_remaining, start_time, last_activity_time, max_end_time
) VALUES (
    1, 'player_123', 'John Doe', 'CF',
    'active', 3, NOW(), NOW(), NOW() + INTERVAL '24 hours'
) RETURNING id;

-- 2. Add teams (use the returned id from above)
INSERT INTO bulk_tiebreaker_teams (tiebreaker_id, team_id, team_name, status, current_bid) VALUES
    (1, 'team_a', 'Team Alpha', 'active', 10),
    (1, 'team_b', 'Team Beta', 'active', 10),
    (1, 'team_c', 'Team Gamma', 'active', 10);

-- 3. Place some bids
INSERT INTO bulk_tiebreaker_bids (tiebreaker_id, team_id, team_name, bid_amount) VALUES
    (1, 'team_a', 'Team Alpha', 20),
    (1, 'team_b', 'Team Beta', 25);

-- Update highest bid
UPDATE bulk_tiebreakers 
SET current_highest_bid = 25, current_highest_team_id = 'team_b'
WHERE id = 1;

UPDATE bulk_tiebreaker_teams
SET current_bid = 20
WHERE tiebreaker_id = 1 AND team_id = 'team_a';

UPDATE bulk_tiebreaker_teams
SET current_bid = 25
WHERE tiebreaker_id = 1 AND team_id = 'team_b';

-- 4. Simulate a withdrawal
UPDATE bulk_tiebreaker_teams 
SET status = 'withdrawn', withdrawn_at = NOW()
WHERE tiebreaker_id = 1 AND team_id = 'team_c';

UPDATE bulk_tiebreakers
SET teams_remaining = 2
WHERE id = 1;

-- 5. Check the state
SELECT * FROM bulk_tiebreakers WHERE id = 1;
SELECT * FROM bulk_tiebreaker_teams WHERE tiebreaker_id = 1;
SELECT * FROM bulk_tiebreaker_bids WHERE tiebreaker_id = 1;

-- 6. Check winner function
SELECT * FROM check_tiebreaker_winner(1);
-- Should show: teams_left=2, no winner yet

-- 7. Simulate another withdrawal (should trigger winner)
UPDATE bulk_tiebreaker_teams 
SET status = 'withdrawn', withdrawn_at = NOW()
WHERE tiebreaker_id = 1 AND team_id = 'team_a';

UPDATE bulk_tiebreakers
SET teams_remaining = 1
WHERE id = 1;

SELECT * FROM check_tiebreaker_winner(1);
-- Should show: teams_left=1, winner_team_id='team_b', winner_bid=25

-- 8. Get dashboard stats
SELECT * FROM get_tiebreaker_stats();

-- 9. Clean up test data
DELETE FROM bulk_tiebreakers WHERE id = 1;
```

---

## 🔄 Rollback (If Needed)

If you need to undo this migration:

```sql
DROP TABLE IF EXISTS bulk_tiebreaker_bids CASCADE;
DROP TABLE IF EXISTS bulk_tiebreaker_teams CASCADE;
DROP TABLE IF EXISTS bulk_tiebreakers CASCADE;
DROP FUNCTION IF EXISTS check_tiebreaker_winner(INTEGER);
DROP FUNCTION IF EXISTS get_tiebreaker_stats();
DROP FUNCTION IF EXISTS update_bulk_tiebreaker_timestamp();
```

---

## 📊 Table Structure

### bulk_tiebreakers
| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| round_id | INTEGER | Reference to bulk round |
| player_id | VARCHAR(255) | Player being auctioned |
| player_name | VARCHAR(255) | Player name |
| position | VARCHAR(50) | Player position |
| status | VARCHAR(20) | pending/active/resolved/cancelled |
| current_highest_bid | INTEGER | Current highest bid |
| current_highest_team_id | VARCHAR(255) | Team with highest bid |
| teams_remaining | INTEGER | Active teams count |
| start_time | TIMESTAMP | When auction started |
| last_activity_time | TIMESTAMP | Last bid/withdrawal |
| max_end_time | TIMESTAMP | start + 24 hours |

### bulk_tiebreaker_teams
| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| tiebreaker_id | INTEGER | FK to bulk_tiebreakers |
| team_id | VARCHAR(255) | Team ID |
| team_name | VARCHAR(255) | Team name |
| status | VARCHAR(20) | active/withdrawn |
| current_bid | INTEGER | Team's current bid |
| joined_at | TIMESTAMP | When joined |
| withdrawn_at | TIMESTAMP | When withdrawn (if applicable) |

### bulk_tiebreaker_bids
| Column | Type | Description |
|--------|------|-------------|
| id | SERIAL | Primary key |
| tiebreaker_id | INTEGER | FK to bulk_tiebreakers |
| team_id | VARCHAR(255) | Team ID |
| team_name | VARCHAR(255) | Team name |
| bid_amount | INTEGER | Bid amount |
| bid_time | TIMESTAMP | When bid placed |

---

## 🎯 Next Steps

After running this migration:

1. ✅ **Phase 1 Complete** - Database tables created
2. ⏭️ **Phase 2** - Create admin bulk round APIs
3. ⏭️ **Phase 3** - Create team bidding APIs
4. ⏭️ **Phase 4** - Create tiebreaker APIs
5. ⏭️ **Phase 5** - Implement WebSocket
6. ⏭️ **Phase 6** - Connect to UI
7. ⏭️ **Phase 7** - Testing

---

## 📝 Migration Log

- **Created**: 2025-10-09
- **Version**: 1.0
- **Author**: AI Assistant
- **Status**: ✅ Ready to run

---

## ❓ Troubleshooting

### Error: "relation already exists"
The tables might already exist. Drop them first:
```sql
DROP TABLE IF EXISTS bulk_tiebreaker_bids CASCADE;
DROP TABLE IF EXISTS bulk_tiebreaker_teams CASCADE;
DROP TABLE IF EXISTS bulk_tiebreakers CASCADE;
```

### Error: "permission denied"
Make sure your database user has CREATE TABLE permissions.

### Error: "syntax error"
Make sure you're using PostgreSQL (not MySQL). This migration is PostgreSQL-specific.

---

**Ready to proceed with Phase 2?** Let me know when the migration is complete! 🚀
