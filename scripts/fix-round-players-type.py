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
    
    migration_file = Path(__file__).parent.parent / 'database' / 'migrations' / 'fix-round-players-round-id-type.sql'
    
    if not migration_file.exists():
        print(f"❌ Migration file not found: {migration_file}")
        sys.exit(1)
    
    with open(migration_file, 'r', encoding='utf-8') as f:
        sql_content = f.read()
    
    try:
        conn = psycopg2.connect(database_url)
        conn.autocommit = False
        cursor = conn.cursor()
        
        print("🚀 Fixing round_players.round_id type mismatch...")
        cursor.execute(sql_content)
        conn.commit()
        
        # Verify
        cursor.execute("""
            SELECT data_type
            FROM information_schema.columns 
            WHERE table_name = 'round_players' AND column_name = 'round_id';
        """)
        
        new_type = cursor.fetchone()[0]
        
        cursor.execute("""
            SELECT data_type
            FROM information_schema.columns 
            WHERE table_name = 'rounds' AND column_name = 'id';
        """)
        
        rounds_type = cursor.fetchone()[0]
        
        print("\n✅ Migration completed!")
        print(f"   rounds.id type: {rounds_type}")
        print(f"   round_players.round_id type: {new_type}")
        
        if new_type == rounds_type:
            print("\n✅ Types now match!")
        else:
            print("\n⚠️  Types still don't match")
        
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
    print("  FIX ROUND_PLAYERS TYPE MISMATCH")
    print("=" * 60)
    run_migration()
