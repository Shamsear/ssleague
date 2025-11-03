#!/usr/bin/env python3
import os
import sys
import psycopg2
from pathlib import Path
from dotenv import load_dotenv

def run_migration():
    # Load environment variables
    env_file = Path(__file__).parent.parent / '.env.local'
    if env_file.exists():
        load_dotenv(env_file)
    
    database_url = os.getenv('NEON_DATABASE_URL')
    
    if not database_url:
        print("❌ Error: NEON_DATABASE_URL not set")
        sys.exit(1)
    
    # Path to migration file
    migration_file = Path(__file__).parent.parent / 'database' / 'migrations' / 'create-team-tiebreakers-table.sql'
    
    if not migration_file.exists():
        print(f"❌ Migration file not found: {migration_file}")
        sys.exit(1)
    
    # Read SQL file
    with open(migration_file, 'r', encoding='utf-8') as f:
        sql_content = f.read()
    
    try:
        # Connect and run migration
        conn = psycopg2.connect(database_url)
        conn.autocommit = False
        cursor = conn.cursor()
        
        print("🚀 Creating team_tiebreakers table...")
        cursor.execute(sql_content)
        conn.commit()
        
        # Verify
        cursor.execute("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'team_tiebreakers'
            ORDER BY ordinal_position;
        """)
        
        columns = cursor.fetchall()
        
        if columns:
            print("\n✅ team_tiebreakers table created successfully!")
            print("\n📋 Columns:")
            for col_name, col_type in columns:
                print(f"   • {col_name:<20} {col_type}")
        else:
            print("⚠️  Table not found")
        
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
    print("  CREATE TEAM_TIEBREAKERS TABLE")
    print("=" * 60)
    run_migration()
