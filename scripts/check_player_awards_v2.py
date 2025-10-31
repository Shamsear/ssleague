#!/usr/bin/env python3
"""
Check player stats and awards structure in tournament database
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
        
        # Check realplayerstats table
        print("=" * 60)
        print("📊 REALPLAYERSTATS TABLE SCHEMA")
        print("=" * 60)
        cursor.execute("""
            SELECT column_name, data_type, character_maximum_length
            FROM information_schema.columns
            WHERE table_name = 'realplayerstats'
            ORDER BY ordinal_position
        """)
        
        columns = cursor.fetchall()
        if columns:
            for col in columns:
                max_len = f"({col[2]})" if col[2] else ""
                print(f"  {col[0]}: {col[1]}{max_len}")
        else:
            print("  ⚠️  No realplayerstats table found")
        
        # Check for trophy/award related columns
        print("\n" + "=" * 60)
        print("🏆 TROPHY/AWARD COLUMNS IN REALPLAYERSTATS")
        print("=" * 60)
        
        trophy_cols = [col for col in columns if any(keyword in col[0].lower() for keyword in ['trophy', 'award', 'individual', 'category'])]
        if trophy_cols:
            for col in trophy_cols:
                max_len = f"({col[2]})" if col[2] else ""
                print(f"  {col[0]}: {col[1]}{max_len}")
        else:
            print("  ℹ️  No trophy/award columns found")
        
        # Sample some data from trophies JSONB column
        print("\n" + "=" * 60)
        print("📋 SAMPLE PLAYER DATA (with trophies)")
        print("=" * 60)
        
        cursor.execute("""
            SELECT player_name, season_id, trophies
            FROM realplayerstats
            WHERE trophies IS NOT NULL AND trophies::text != '[]'
            LIMIT 10
        """)
        
        samples = cursor.fetchall()
        if samples:
            for player_name, season_id, trophies_json in samples:
                print(f"\n  {player_name} ({season_id}):")
                print(f"    Trophies: {trophies_json}")
        else:
            print("  ℹ️  No players with trophies found")
        
        # Check awards table
        print("\n" + "=" * 60)
        print("🎖️  AWARDS TABLE")
        print("=" * 60)
        
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'awards'
            )
        """)
        
        awards_table_exists = cursor.fetchone()[0]
        
        if awards_table_exists:
            print("  ✅ awards table exists\n")
            
            cursor.execute("""
                SELECT column_name, data_type, character_maximum_length
                FROM information_schema.columns
                WHERE table_name = 'awards'
                ORDER BY ordinal_position
            """)
            
            award_cols = cursor.fetchall()
            for col in award_cols:
                max_len = f"({col[2]})" if col[2] else ""
                print(f"  {col[0]}: {col[1]}{max_len}")
            
            # Sample awards
            print("\n  Sample awards:")
            cursor.execute("""
                SELECT id, player_id, player_name, season_id, award_type, award_name
                FROM awards
                ORDER BY id
                LIMIT 10
            """)
            
            award_samples = cursor.fetchall()
            for award in award_samples:
                print(f"    ID {award[0]}: {award[2]} ({award[3]}) - {award[4]}: {award[5]}")
            
            # Check award structure
            print("\n" + "=" * 60)
            print("🔍 AWARDS ANALYSIS")
            print("=" * 60)
            
            # Check if awards have separate name/position
            cursor.execute("""
                SELECT DISTINCT award_type, award_name
                FROM awards
                WHERE award_name LIKE '%Winner%' OR award_name LIKE '%Runner%' OR award_name LIKE '%Champion%'
                ORDER BY award_type, award_name
            """)
            
            award_types = cursor.fetchall()
            if award_types:
                print("  Awards that need separation (name + position):")
                for award_type, award_name in award_types:
                    print(f"    - {award_type}: {award_name}")
            
        else:
            print("  ⚠️  awards table does NOT exist")
        
        # Check player_season table
        print("\n" + "=" * 60)
        print("👤 PLAYER_SEASON TABLE")
        print("=" * 60)
        
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'player_season'
            )
        """)
        
        ps_table_exists = cursor.fetchone()[0]
        
        if ps_table_exists:
            print("  ✅ player_season table exists\n")
            
            cursor.execute("""
                SELECT column_name, data_type, character_maximum_length
                FROM information_schema.columns
                WHERE table_name = 'player_season'
                ORDER BY ordinal_position
            """)
            
            ps_cols = cursor.fetchall()
            for col in ps_cols:
                max_len = f"({col[2]})" if col[2] else ""
                print(f"  {col[0]}: {col[1]}{max_len}")
            
            # Check for awards-related columns
            award_cols = [col for col in ps_cols if 'award' in col[0].lower()]
            if award_cols:
                print("\n  Awards-related columns:")
                for col in award_cols:
                    print(f"    - {col[0]}: {col[1]}")
                    
                # Sample data from award columns
                cursor.execute("""
                    SELECT player_name, season_id, awards_count
                    FROM player_season
                    WHERE awards_count > 0
                    LIMIT 10
                """)
                
                ps_samples = cursor.fetchall()
                if ps_samples:
                    print("\n  Sample players with awards:")
                    for player_name, season_id, awards_count in ps_samples:
                        print(f"    - {player_name} ({season_id}): {awards_count} awards")
            
        else:
            print("  ⚠️  player_season table does NOT exist")
        
        cursor.close()
        conn.close()
        
        print("\n" + "=" * 60)
        print("📝 SUMMARY")
        print("=" * 60)
        
        issues = []
        
        if trophy_cols:
            issues.append("✅ Player stats have trophy columns (need to be separated)")
        
        if awards_table_exists:
            issues.append("✅ Awards table exists (may need position separation)")
        
        if ps_table_exists:
            issues.append("✅ Player_season table exists (for awards counting)")
        
        if not issues:
            issues.append("⚠️  No player awards system found")
        
        for issue in issues:
            print(f"  {issue}")
        
        print("\n🎉 Check complete!")
        return 0
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    sys.exit(main())