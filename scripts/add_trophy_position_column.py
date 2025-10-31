#!/usr/bin/env python3
"""
Migration Script: Add trophy_position Column to team_trophies Table
Separates trophy name from position/achievement
"""

import os
import sys
from pathlib import Path
import psycopg2
from dotenv import load_dotenv

# Load environment variables from .env.local
env_path = Path(__file__).parent.parent / '.env.local'
load_dotenv(dotenv_path=env_path)

def run_migration():
    """Run the migration to add trophy_position column"""
    
    print("🚀 Starting trophy_position column migration...\n")
    
    # Get database URL from environment
    db_url = os.getenv('NEON_TOURNAMENT_DB_URL')
    
    if not db_url:
        print("❌ ERROR: NEON_TOURNAMENT_DB_URL not found in environment variables")
        print("   Please ensure .env.local exists and contains NEON_TOURNAMENT_DB_URL")
        sys.exit(1)
    
    # Migration SQL
    migration_sql = """
-- ============================================
-- ADD TROPHY_POSITION COLUMN TO TEAM_TROPHIES
-- Separates trophy name from position/achievement
-- Note: 'position' column (INTEGER) is for league position (1, 2, 3)
--       'trophy_position' column (VARCHAR) is for achievement text (Winner, Runner Up, etc.)
-- ============================================

-- Add trophy_position column for text-based position/achievement
ALTER TABLE team_trophies 
ADD COLUMN IF NOT EXISTS trophy_position VARCHAR(50);

-- Update comments
COMMENT ON COLUMN team_trophies.trophy_name IS 'Trophy name only: League, UCL, FA Cup, etc. (without position)';
COMMENT ON COLUMN team_trophies.trophy_position IS 'Trophy achievement: Winner, Runner Up, Champions, Third Place, etc.';
COMMENT ON COLUMN team_trophies.position IS 'League standing position (INTEGER): 1, 2, 3, etc. - for league position only';

-- Update unique constraint to include trophy_position
ALTER TABLE team_trophies 
DROP CONSTRAINT IF EXISTS team_trophies_team_id_season_id_trophy_name_key;

ALTER TABLE team_trophies 
ADD CONSTRAINT team_trophies_unique_trophy 
UNIQUE(team_id, season_id, trophy_name, trophy_position);

-- Add index for trophy_position
CREATE INDEX IF NOT EXISTS idx_team_trophies_trophy_position 
ON team_trophies(trophy_position);
"""
    
    try:
        # Connect to database
        print("📡 Connecting to database...")
        conn = psycopg2.connect(db_url)
        cursor = conn.cursor()
        
        print("📄 Migration SQL:")
        print(migration_sql)
        print("\n🔧 Executing migration...\n")
        
        # Execute migration
        cursor.execute(migration_sql)
        conn.commit()
        
        print("✅ Migration completed successfully!")
        
        # Verify the new column exists
        print("\n📊 Verifying schema...")
        cursor.execute("""
            SELECT column_name, data_type, character_maximum_length
            FROM information_schema.columns
            WHERE table_name = 'team_trophies'
            ORDER BY ordinal_position
        """)
        
        columns = cursor.fetchall()
        print("\nCurrent team_trophies schema:")
        for col in columns:
            max_len = f"({col[2]})" if col[2] else ""
            print(f"  - {col[0]}: {col[1]}{max_len}")
        
        # Check if trophy_position was added
        trophy_position_exists = any(col[0] == 'trophy_position' for col in columns)
        if trophy_position_exists:
            print("\n✅ trophy_position column successfully added!")
        else:
            print("\n⚠️  Warning: trophy_position column not found in schema")
        
        cursor.close()
        conn.close()
        
        print("\n🎉 Migration complete!")
        return 0
        
    except psycopg2.Error as e:
        print(f"\n❌ Database error: {e}")
        return 1
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(run_migration())
