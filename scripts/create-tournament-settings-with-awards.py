#!/usr/bin/env python3
"""
Database Migration Script
Creates tournament_settings table with awards configuration
"""

import os
import sys
from urllib.parse import urlparse
import psycopg2
from dotenv import load_dotenv

# Load environment variables from .env.local
load_dotenv('.env.local')

def run_migration():
    """Create tournament_settings table with awards configuration"""
    
    print("🏆 Creating tournament_settings table with awards configuration...\n")
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
    
    # Check if table exists
    try:
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'tournament_settings'
            );
        """)
        table_exists = cursor.fetchone()[0]
        print(f"Tournament settings table exists: {table_exists}")
    except Exception as e:
        print(f"Error checking table existence: {e}")
        table_exists = False
    
    # Create or update table with all columns including awards
    migration_sql = """
-- Create tournament_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS tournament_settings (
    id SERIAL PRIMARY KEY,
    tournament_id VARCHAR(255) UNIQUE NOT NULL,
    tournament_name VARCHAR(255),
    squad_size INTEGER DEFAULT 11,
    tournament_system VARCHAR(50) DEFAULT 'match_round',
    home_deadline_time VARCHAR(10) DEFAULT '17:00',
    away_deadline_time VARCHAR(10) DEFAULT '17:00',
    result_day_offset INTEGER DEFAULT 2,
    result_deadline_time VARCHAR(10) DEFAULT '00:30',
    has_knockout_stage BOOLEAN DEFAULT false,
    playoff_teams INTEGER DEFAULT 4,
    direct_semifinal_teams INTEGER DEFAULT 2,
    qualification_threshold INTEGER DEFAULT 75,
    is_two_legged BOOLEAN DEFAULT true,
    num_teams INTEGER,
    awards_enabled BOOLEAN DEFAULT true,
    awards_config JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add awards system configuration columns if they don't exist
ALTER TABLE tournament_settings ADD COLUMN IF NOT EXISTS awards_enabled BOOLEAN DEFAULT true;
ALTER TABLE tournament_settings ADD COLUMN IF NOT EXISTS awards_config JSONB DEFAULT '{}'::jsonb;

-- Add comments for documentation
COMMENT ON COLUMN tournament_settings.tournament_id IS 'Foreign key to tournaments table';
COMMENT ON COLUMN tournament_settings.awards_enabled IS 'Whether the awards system is enabled for this tournament';
COMMENT ON COLUMN tournament_settings.awards_config IS 'JSON configuration for awards system (award types, selection rules, etc.)';

-- Set default awards configuration for existing tournaments
UPDATE tournament_settings 
SET awards_config = '{
  "award_types": {
    "POTD": {"enabled": true, "label": "Player of the Day", "scope": "round"},
    "POTW": {"enabled": true, "label": "Player of the Week", "scope": "week"},
    "POTS": {"enabled": true, "label": "Player of the Season", "scope": "season"},
    "TOD": {"enabled": true, "label": "Team of the Day", "scope": "round"},
    "TOW": {"enabled": true, "label": "Team of the Week", "scope": "week"},
    "TOTS": {"enabled": true, "label": "Team of the Season", "scope": "season"}
  },
  "selection_rules": {
    "require_performance_stats": true,
    "require_committee_approval": false,
    "allow_duplicate_winners": false
  },
  "display_settings": {
    "show_on_public_page": true,
    "show_performance_stats": true,
    "show_selection_notes": true
  }
}'::jsonb
WHERE awards_config = '{}'::jsonb OR awards_config IS NULL;

-- Create or update trigger for auto-updating updated_at
CREATE OR REPLACE FUNCTION update_tournament_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_tournament_settings_updated_at ON tournament_settings;
CREATE TRIGGER trigger_update_tournament_settings_updated_at
    BEFORE UPDATE ON tournament_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_tournament_settings_updated_at();
"""
    
    try:
        print("📝 Creating/updating tournament_settings table...\n")
        
        # Execute the migration
        cursor.execute(migration_sql)
        
        print("✅ Table created/updated successfully\n")
        
        # Commit the transaction
        conn.commit()
        print("✅ Transaction committed\n")
        
        # Verify the changes
        print("="*80)
        print("\n🔍 Verifying changes...\n")
        
        cursor.execute("""
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_name = 'tournament_settings'
            ORDER BY ordinal_position;
        """)
        
        columns = cursor.fetchall()
        
        print("📊 Tournament settings table structure:\n")
        for col in columns:
            nullable = "NULL" if col[2] == 'YES' else "NOT NULL"
            default = f" DEFAULT {col[3]}" if col[3] else ""
            print(f"   ✅ {col[0]:<25} ({col[1]:<25}) {nullable}{default}")
        
        print("\n" + "="*80)
        print("\n🎉 SUCCESS! Tournament settings table with awards configuration ready!\n")
        print("Next steps:")
        print("  1. Update the tournament settings API to handle awards_enabled and awards_config")
        print("  2. Create UI components for managing awards configuration")
        print("  3. Update the awards API to check if awards are enabled for tournaments")
        print("  4. Test the configuration! ✅\n")
        
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