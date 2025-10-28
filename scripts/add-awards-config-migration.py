#!/usr/bin/env python3
"""
Database Migration Script
Adds awards configuration to tournament_settings table
"""

import os
import sys
from urllib.parse import urlparse
import psycopg2
from dotenv import load_dotenv

# Load environment variables from .env.local
load_dotenv('.env.local')

def run_migration():
    """Run the database migration to add awards configuration"""
    
    print("🏆 Starting awards configuration migration...\n")
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
-- Add awards system configuration columns
ALTER TABLE tournament_settings ADD COLUMN IF NOT EXISTS awards_enabled BOOLEAN DEFAULT true;
ALTER TABLE tournament_settings ADD COLUMN IF NOT EXISTS awards_config JSONB DEFAULT '{}'::jsonb;

-- Add comments for documentation
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
            WHERE table_name = 'tournament_settings'
            AND column_name IN ('awards_enabled', 'awards_config')
            ORDER BY ordinal_position;
        """)
        
        columns = cursor.fetchall()
        
        print("📊 New tournament_settings columns:\n")
        for col in columns:
            nullable = "NULL" if col[2] == 'YES' else "NOT NULL"
            print(f"   ✅ {col[0]:<20} ({col[1]:<25}) {nullable}")
        
        # Check if there are tournaments with the new config
        cursor.execute("""
            SELECT COUNT(*) as total_tournaments,
                   COUNT(CASE WHEN awards_enabled = true THEN 1 END) as awards_enabled_count
            FROM tournament_settings
            WHERE awards_enabled IS NOT NULL;
        """)
        
        stats = cursor.fetchone()
        
        print(f"\n📈 Configuration status:")
        print(f"   Total tournaments: {stats[0]}")
        print(f"   Awards enabled: {stats[1]}")
        
        print("\n" + "="*80)
        print("\n🎉 SUCCESS! Awards configuration migration completed!\n")
        print("Next steps:")
        print("  1. Update the tournament settings API to handle awards_enabled and awards_config")
        print("  2. Create UI components for managing awards configuration")
        print("  3. Update the awards API to check if awards are enabled for tournaments")
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