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
    migration_file = Path(__file__).parent.parent / 'database' / 'migrations' / 'rename-encrypted-amount-column.sql'
    
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
        
        print("🚀 Renaming encrypted_amount to encrypted_bid_data...")
        cursor.execute(sql_content)
        conn.commit()
        
        # Verify
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'bids' AND column_name = 'encrypted_bid_data';
        """)
        
        result = cursor.fetchone()
        
        if result:
            print("\n✅ Column renamed successfully!")
            print(f"   Column 'encrypted_bid_data' now exists in bids table")
        else:
            print("⚠️  Column not found after migration")
        
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
    print("  RENAME ENCRYPTED_AMOUNT COLUMN")
    print("=" * 60)
    run_migration()
