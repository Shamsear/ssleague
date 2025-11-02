#!/usr/bin/env python3
"""
Run database migrations to fix match result saving issues:
1. Add MOTM and penalty goals columns to fixtures table
2. Ensure goals_conceded column exists in player_seasons table
"""

import os
import psycopg2
from dotenv import load_dotenv

# Load environment variables
load_dotenv('.env.local')

def run_migrations():
    """Run all required database migrations"""
    
    # Get database URL from environment
    db_url = os.getenv('NEON_TOURNAMENT_DB_URL')
    
    if not db_url:
        print("❌ Error: NEON_TOURNAMENT_DB_URL not found in .env.local")
        return False
    
    print("🔧 Connecting to database...")
    
    try:
        # Connect to database
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        
        print("✅ Connected to database\n")
        
        # Migration 1: Add MOTM and penalty goals columns to fixtures
        print("📝 Migration 1: Adding MOTM and penalty goals columns to fixtures table...")
        
        cur.execute("""
            -- Add MOTM player columns
            ALTER TABLE fixtures 
            ADD COLUMN IF NOT EXISTS motm_player_id TEXT,
            ADD COLUMN IF NOT EXISTS motm_player_name TEXT;
        """)
        
        cur.execute("""
            -- Add penalty goals columns
            ALTER TABLE fixtures
            ADD COLUMN IF NOT EXISTS home_penalty_goals INTEGER DEFAULT 0,
            ADD COLUMN IF NOT EXISTS away_penalty_goals INTEGER DEFAULT 0;
        """)
        
        cur.execute("""
            -- Add indexes
            CREATE INDEX IF NOT EXISTS idx_fixtures_motm ON fixtures(motm_player_id);
        """)
        
        conn.commit()
        print("   ✅ Added MOTM and penalty goals columns to fixtures")
        
        # Migration 2: Ensure goals_conceded column in player_seasons
        print("\n📝 Migration 2: Ensuring goals_conceded column in player_seasons table...")
        
        cur.execute("""
            ALTER TABLE player_seasons 
            ADD COLUMN IF NOT EXISTS goals_conceded INTEGER DEFAULT 0;
        """)
        
        conn.commit()
        print("   ✅ Added goals_conceded column to player_seasons")
        
        # Verify fixtures table structure
        print("\n🔍 Verifying fixtures table structure...")
        cur.execute("""
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'fixtures' 
            AND column_name IN ('motm_player_id', 'motm_player_name', 'home_penalty_goals', 'away_penalty_goals')
            ORDER BY column_name;
        """)
        
        fixtures_cols = cur.fetchall()
        if fixtures_cols:
            print("   Fixtures columns:")
            for col in fixtures_cols:
                print(f"      - {col[0]}: {col[1]} (nullable: {col[2]})")
        
        # Verify player_seasons table structure
        print("\n🔍 Verifying player_seasons table structure...")
        cur.execute("""
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_name = 'player_seasons' 
            AND column_name IN ('goals_scored', 'goals_conceded', 'matches_played', 'wins', 'draws', 'losses')
            ORDER BY column_name;
        """)
        
        player_cols = cur.fetchall()
        if player_cols:
            print("   Player_seasons stats columns:")
            for col in player_cols:
                print(f"      - {col[0]}: {col[1]} (nullable: {col[2]})")
        
        # Close connection
        cur.close()
        conn.close()
        
        print("\n✅ All migrations completed successfully!")
        print("\n📝 Changes applied:")
        print("   1. fixtures table now has: motm_player_id, motm_player_name, home_penalty_goals, away_penalty_goals")
        print("   2. player_seasons table now has: goals_conceded column")
        print("\n🎉 You can now save match results without errors!")
        
        return True
        
    except psycopg2.Error as e:
        print(f"\n❌ Database error: {e}")
        return False
    except Exception as e:
        print(f"\n❌ Error: {e}")
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("Database Migration Script")
    print("Fix Match Result Saving Issues")
    print("=" * 60)
    print()
    
    success = run_migrations()
    
    if success:
        exit(0)
    else:
        exit(1)
