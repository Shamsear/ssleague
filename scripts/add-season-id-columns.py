#!/usr/bin/env python3
import os
import sys
import psycopg2
from pathlib import Path
from dotenv import load_dotenv

def run_migration():
    env_file = Path(__file__).parent.parent / '.env.local'
    if env_file.exists():
        load_dotenv(env_file)
    
    database_url = os.getenv('NEON_DATABASE_URL')
    
    if not database_url:
        print("❌ Error: NEON_DATABASE_URL not set")
        sys.exit(1)
    
    migration_file = Path(__file__).parent.parent / 'database' / 'migrations' / 'add-season-id-to-all-tables.sql'
    
    if not migration_file.exists():
        print(f"❌ Migration file not found: {migration_file}")
        sys.exit(1)
    
    with open(migration_file, 'r', encoding='utf-8') as f:
        sql_content = f.read()
    
    try:
        conn = psycopg2.connect(database_url)
        conn.autocommit = False
        cursor = conn.cursor()
        
        print("🚀 Adding season_id to all tables...")
        cursor.execute(sql_content)
        conn.commit()
        
        print("\n✅ Migration completed!")
        print("\n📊 Verifying season_id columns:")
        
        tables = ['bids', 'round_players', 'round_bids', 'starred_players', 
                  'team_tiebreakers', 'bulk_tiebreaker_teams', 'bulk_tiebreaker_bids', 
                  'tournament_settings']
        
        for table in tables:
            cursor.execute(f"""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = '{table}' AND column_name = 'season_id'
            """)
            
            has_it = cursor.fetchone() is not None
            status = "✅" if has_it else "❌"
            print(f"   {status} {table}")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        if 'conn' in locals():
            conn.rollback()
            conn.close()
        sys.exit(1)

if __name__ == '__main__':
    print("=" * 60)
    print("  ADD SEASON_ID TO ALL AUCTION TABLES")
    print("=" * 60)
    run_migration()
