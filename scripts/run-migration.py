#!/usr/bin/env python3
"""
Database Migration Script
Adds missing columns to rounds table for bulk rounds support
"""

import os
import sys
from urllib.parse import urlparse
import psycopg2
from dotenv import load_dotenv

# Load environment variables from .env.local
load_dotenv('.env.local')

def run_migration():
    """Run the database migration to add bulk round columns"""
    
    print("🔍 Starting database migration...\n")
    print("="*80)
    
    # Get database URL from environment
    db_url = os.getenv('NEON_DATABASE_URL') or os.getenv('DATABASE_URL')
    
    if not db_url:
        print("❌ Error: No database connection string found!")
        print("   Make sure NEON_DATABASE_URL or DATABASE_URL is set in .env.local")
        sys.exit(1)
    
    print(f"✅ Found database connection string")
    
    # Parse the URL
    try:
        result = urlparse(db_url)
        conn_params = {
            'host': result.hostname,
            'port': result.port or 5432,
            'database': result.path[1:],
            'user': result.username,
            'password': result.password,
            'sslmode': 'require'
        }
        print(f"✅ Connecting to: {result.hostname}")
        
    except Exception as e:
        print(f"❌ Error parsing database URL: {e}")
        sys.exit(1)
    
    # Connect to database
    try:
        conn = psycopg2.connect(**conn_params)
        conn.autocommit = False
        cursor = conn.cursor()
        print("✅ Connected to database\n")
        
    except Exception as e:
        print(f"❌ Error connecting to database: {e}")
        sys.exit(1)
    
    # Read and execute migration SQL
    migration_sql = """
-- Add missing columns for bulk rounds support
ALTER TABLE rounds
  ADD COLUMN IF NOT EXISTS round_number INTEGER,
  ADD COLUMN IF NOT EXISTS round_type VARCHAR(20) DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS base_price INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS duration_seconds INTEGER DEFAULT 300,
  ADD COLUMN IF NOT EXISTS start_time TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS position_group VARCHAR(10);

-- Make position nullable (not required for bulk rounds)
ALTER TABLE rounds ALTER COLUMN position DROP NOT NULL;

-- Make end_time nullable (not required for draft rounds)
ALTER TABLE rounds ALTER COLUMN end_time DROP NOT NULL;

-- Add check constraint for round_type
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'rounds_round_type_check'
  ) THEN
    ALTER TABLE rounds 
      ADD CONSTRAINT rounds_round_type_check 
      CHECK (round_type IN ('normal', 'bulk', 'tiebreaker'));
  END IF;
END $$;

-- Add unique constraint for season + round_number
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'rounds_season_round_unique'
  ) THEN
    ALTER TABLE rounds 
      ADD CONSTRAINT rounds_season_round_unique 
      UNIQUE (season_id, round_number) 
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END $$;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_rounds_round_type ON rounds(round_type);
CREATE INDEX IF NOT EXISTS idx_rounds_season_type ON rounds(season_id, round_type);

-- Ensure updated_at trigger exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_rounds_updated_at ON rounds;
CREATE TRIGGER update_rounds_updated_at
  BEFORE UPDATE ON rounds
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add helpful comments
COMMENT ON COLUMN rounds.round_type IS 'Type: normal (blind bidding), bulk (fixed price), tiebreaker (auction)';
COMMENT ON COLUMN rounds.round_number IS 'Sequential round number within a season (used for bulk rounds)';
COMMENT ON COLUMN rounds.base_price IS 'Fixed bid price for bulk rounds (default £10)';
COMMENT ON COLUMN rounds.position IS 'Player position for blind bidding rounds (optional for bulk rounds)';
"""
    
    try:
        print("📝 Running migration SQL...\n")
        
        # Execute the migration
        cursor.execute(migration_sql)
        
        print("✅ Migration SQL executed successfully\n")
        
        # Commit the transaction
        conn.commit()
        print("✅ Transaction committed\n")
        
        # Verify the changes
        print("="*80)
        print("\n🔍 Verifying changes...\n")
        
        cursor.execute("""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'rounds'
            ORDER BY ordinal_position;
        """)
        
        columns = cursor.fetchall()
        
        print("📊 Rounds table columns:\n")
        for col in columns:
            nullable = "NULL" if col[2] == 'YES' else "NOT NULL"
            print(f"   ✅ {col[0]:<20} ({col[1]:<25}) {nullable}")
        
        print("\n" + "="*80)
        print("\n🎉 SUCCESS! Migration completed!\n")
        print("Next steps:")
        print("  1. Restart your Next.js server")
        print("  2. Go to /dashboard/committee/bulk-rounds")
        print("  3. Try creating a bulk round")
        print("  4. It should work now! ✅\n")
        
    except Exception as e:
        print(f"\n❌ Error during migration: {e}")
        conn.rollback()
        print("❌ Transaction rolled back")
        sys.exit(1)
        
    finally:
        cursor.close()
        conn.close()
        print("✅ Database connection closed\n")

if __name__ == "__main__":
    try:
        run_migration()
    except KeyboardInterrupt:
        print("\n\n⚠️  Migration cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        sys.exit(1)
