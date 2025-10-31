#!/usr/bin/env python3
"""
Check player stats and awards structure
"""

import os
import sys
from pathlib import Path
import psycopg2
from dotenv import load_dotenv

env_path = Path(__file__).parent.parent / '.env.local'
load_dotenv(dotenv_path=env_path)

def main():
    print("🔍 Checking player stats and awards structure...\n")
    
    db_url = os.getenv('NEON_TOURNAMENT_DB_URL')
    if not db_url:
        print("❌ ERROR: NEON_TOURNAMENT_DB_URL not found")
        sys.exit(1)
    
    try:
        conn = psycopg2.connect(db_url)
        cursor = conn.cursor()
        
        # Check playerstats table
        print("=" * 60)
        print("📊 PLAYERSTATS TABLE SCHEMA")
        print("=" * 60)
        cursor.execute("""
            SELECT column_name, data_type, character_maximum_length
            FROM information_schema.columns
            WHERE table_name = 'playerstats'
            ORDER BY ordinal_position
        """)
        
        columns = cursor.fetchall()
        if columns:
            for col in columns:
                max_len = f"({col[2]})" if col[2] else ""
                print(f"  {col[0]}: {col[1]}{max_len}")
        else:
            print("  ⚠️  No playerstats table found")
        
        # Check for trophy/award related columns
        print("\n" + "=" * 60)
        print("🏆 TROPHY/AWARD COLUMNS IN PLAYERSTATS")
        print("=" * 60)
        
        trophy_cols = [col for col in columns if any(keyword in col[0].lower() for keyword in ['trophy', 'award', 'individual', 'category'])]
        if trophy_cols:
            for col in trophy_cols:
                print(f"  {col[0]}: {col[1]}")
        else:
            print("  ℹ️  No trophy/award columns found in playerstats")
        
        # Sample some data
        print("\n" + "=" * 60)
        print("📋 SAMPLE PLAYER DATA (with trophies/awards)")
        print("=" * 60)
        
        cursor.execute("""
            SELECT player_name, season_id, individual_trophy, category_trophy
            FROM playerstats
            WHERE individual_trophy IS NOT NULL OR category_trophy IS NOT NULL
            LIMIT 10
        """)
        
        samples = cursor.fetchall()
        if samples:
            for player_name, season_id, individual, category in samples:
                print(f"\n  {player_name} ({season_id}):")
                if individual:
                    print(f"    Individual Trophy: {individual}")
                if category:
                    print(f"    Category Trophy: {category}")
        else:
            print("  ℹ️  No players with trophies found")
        
        # Check player_awards table if it exists
        print("\n" + "=" * 60)
        print("🎖️  PLAYER_AWARDS TABLE")
        print("=" * 60)
        
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'player_awards'
            )
        """)
        
        awards_table_exists = cursor.fetchone()[0]
        
        if awards_table_exists:
            print("  ✅ player_awards table exists\n")
            
            cursor.execute("""
                SELECT column_name, data_type
                FROM information_schema.columns
                WHERE table_name = 'player_awards'
                ORDER BY ordinal_position
            """)
            
            award_cols = cursor.fetchall()
            for col in award_cols:
                print(f"  {col[0]}: {col[1]}")
            
            # Sample awards
            print("\n  Sample awards:")
            cursor.execute("""
                SELECT player_name, season_id, award_type, award_name
                FROM player_awards
                LIMIT 5
            """)
            
            award_samples = cursor.fetchall()
            for award in award_samples:
                print(f"    - {award[0]} ({award[1]}): {award[2]} - {award[3]}")
        else:
            print("  ⚠️  player_awards table does NOT exist")
        
        cursor.close()
        conn.close()
        
        print("\n🎉 Check complete!")
        return 0
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    sys.exit(main())
