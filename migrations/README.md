# Database Migrations

## How to Run Migrations

### Option 1: Using Neon Console
1. Go to your Neon dashboard: https://console.neon.tech
2. Select your project
3. Go to the SQL Editor
4. Copy and paste the SQL from the migration file
5. Click "Run"

### Option 2: Using psql
```bash
psql "postgresql://[user]:[password]@[host]/[database]?sslmode=require" -f migrations/add_footballplayers_indexes.sql
```

### Option 3: Using Node.js script
```bash
node scripts/run-migration.js migrations/add_footballplayers_indexes.sql
```

## Available Migrations

### add_footballplayers_indexes.sql
Adds performance indexes to the footballplayers table for:
- Position filtering
- Position group filtering
- Playing style filtering
- Name search (case-insensitive)
- Overall rating sorting
- Team lookups
- Auction eligibility

**Impact**: Significantly improves query performance for the players database page.

**Safe to run**: Yes, these are CREATE INDEX IF NOT EXISTS statements, so they won't fail if indexes already exist.
