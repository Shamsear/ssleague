#!/usr/bin/env python3
"""
Fix duplicate stats issue by adding processed_fixtures tracking
"""

import os
import psycopg2
from dotenv import load_dotenv

# Load environment variables
load_dotenv('.env.local')

def fix_duplicate_stats():
    """Add processed_fixtures column and initialize it"""
    
    db_url = os.getenv('NEON_TOURNAMENT_DB_URL')
    
    if not db_url:
        print("❌ Error: NEON_TOURNAMENT_DB_URL not found in .env.local")
        return False
    
    print("🔧 Fixing duplicate stats issue...\n")
    
    try:
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        
        # Step 1: Add processed_fixtures column
        print("1️⃣ Adding processed_fixtures column...")
        cur.execute("""
            ALTER TABLE player_seasons 
            ADD COLUMN IF NOT EXISTS processed_fixtures JSONB DEFAULT '[]'::jsonb;
        """)
        conn.commit()
        print("   ✅ Column added\n")
        
        # Step 2: Add index
        print("2️⃣ Creating index...")
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_player_seasons_processed_fixtures 
            ON player_seasons USING GIN (processed_fixtures);
        """)
        conn.commit()
        print("   ✅ Index created\n")
        
        # Step 3: Check for players with inflated stats
        print("3️⃣ Checking for potential duplicate stats...")
        cur.execute("""
            SELECT 
                player_name,
                season_id,
                matches_played,
                goals_scored,
                wins,
                draws,
                losses
            FROM player_seasons
            WHERE matches_played > 0
            ORDER BY matches_played DESC
            LIMIT 10;
        """)
        
        rows = cur.fetchall()
        if rows:
            print("   Top 10 players by matches played:")
            for row in rows:
                print(f"      {row[0]} ({row[1]}): {row[2]} MP, {row[3]} G, {row[4]}W-{row[5]}D-{row[6]}L")
        
        print("\n4️⃣ Verifying column structure...")
        cur.execute("""
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'player_seasons' 
            AND column_name = 'processed_fixtures';
        """)
        
        col_info = cur.fetchone()
        if col_info:
            print(f"   ✅ processed_fixtures: {col_info[1]} (nullable: {col_info[2]})")
        
        cur.close()
        conn.close()
        
        print("\n" + "="*60)
        print("✅ Migration completed successfully!")
        print("="*60)
        print("\n📝 What was fixed:")
        print("   1. Added processed_fixtures column to track which fixtures")
        print("      have been processed for each player")
        print("   2. Created GIN index for efficient JSON array lookups")
        print("   3. Now when stats are updated, the fixture ID is added to")
        print("      processed_fixtures array to prevent duplicate counting")
        print("\n💡 Note:")
        print("   - Existing stats are preserved")
        print("   - New match results will not be double-counted")
        print("   - If you see inflated stats, you may need to manually reset them")
        
        return True
        
    except psycopg2.Error as e:
        print(f"\n❌ Database error: {e}")
        return False
    except Exception as e:
        print(f"\n❌ Error: {e}")
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("Fix Duplicate Stats Issue")
    print("=" * 60)
    print()
    
    success = fix_duplicate_stats()
    
    if success:
        exit(0)
    else:
        exit(1)
