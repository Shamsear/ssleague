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
    
    migration_file = Path(__file__).parent.parent / 'database' / 'migrations' / 'add-budget-columns-to-teams.sql'
    
    if not migration_file.exists():
        print(f"❌ Migration file not found: {migration_file}")
        sys.exit(1)
    
    with open(migration_file, 'r', encoding='utf-8') as f:
        sql_content = f.read()
    
    try:
        conn = psycopg2.connect(database_url)
        conn.autocommit = False
        cursor = conn.cursor()
        
        print("🚀 Adding football budget columns to teams table...")
        cursor.execute(sql_content)
        conn.commit()
        
        # Verify
        cursor.execute("""
            SELECT column_name, data_type, column_default
            FROM information_schema.columns 
            WHERE table_name = 'teams'
            ORDER BY ordinal_position;
        """)
        
        columns = cursor.fetchall()
        
        print("\n✅ Migration completed!")
        print("\n📋 Teams table columns:")
        for col_name, col_type, col_default in columns:
            default_str = f" DEFAULT {col_default}" if col_default else ""
            print(f"   • {col_name:<25} {col_type:<20}{default_str}")
        
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
    print("  ADD FOOTBALL BUDGET COLUMNS TO TEAMS")
    print("=" * 60)
    run_migration()
