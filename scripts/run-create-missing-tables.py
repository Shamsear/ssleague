#!/usr/bin/env python3
"""
Create Missing Tables Migration
Creates only the tables that don't exist, reuses what's already there
"""

import os
import sys
from urllib.parse import urlparse
import psycopg2
from dotenv import load_dotenv

# Load environment variables
load_dotenv('.env.local')

def run_migration():
    """Run the migration to create missing tables"""
    
    print("🔍 Creating missing database tables...\n")
    print("="*80)
    
    # Get database URL
    db_url = os.getenv('NEON_DATABASE_URL') or os.getenv('DATABASE_URL')
    
    if not db_url:
        print("❌ Error: No database connection string found!")
        sys.exit(1)
    
    print(f"✅ Found database connection string")
    
    # Parse and connect
    try:
        result = urlparse(db_url)
        conn_params = {
            'host': result.hostname,
            'port': result.port or 5432,
            'database': result.path[1:],
            'user': result.username,
            'password': result.password,
            'sslmode': 'require'
        }
        print(f"✅ Connecting to: {result.hostname}")
        
        conn = psycopg2.connect(**conn_params)
        conn.autocommit = False
        cursor = conn.cursor()
        print("✅ Connected to database\n")
        
    except Exception as e:
        print(f"❌ Error connecting: {e}")
        sys.exit(1)
    
    # Read migration SQL file
    sql_file = os.path.join('database', 'migrations', 'create-missing-tables-smart.sql')
    
    try:
        with open(sql_file, 'r', encoding='utf-8') as f:
            migration_sql = f.read()
        print(f"✅ Loaded migration from {sql_file}\n")
    except Exception as e:
        print(f"❌ Error reading SQL file: {e}")
        sys.exit(1)
    
    # Execute migration
    try:
        print("📝 Creating missing tables...\n")
        
        cursor.execute(migration_sql)
        
        print("✅ Migration SQL executed successfully\n")
        
        # Commit
        conn.commit()
        print("✅ Transaction committed\n")
        
        # Verify
        print("="*80)
        print("\n🔍 Verification:\n")
        
        cursor.execute("""
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name IN (
                'rounds', 'bids', 'tiebreakers', 'team_tiebreakers',
                'round_players', 'round_bids',
                'bulk_tiebreakers', 'bulk_tiebreaker_teams', 'bulk_tiebreaker_bids'
              )
            ORDER BY table_name;
        """)
        
        tables = cursor.fetchall()
        
        print("📊 All relevant tables:\n")
        
        existing_tables = ['rounds', 'bids', 'tiebreakers', 'team_tiebreakers']
        new_tables = ['round_players', 'round_bids', 'bulk_tiebreakers', 
                      'bulk_tiebreaker_teams', 'bulk_tiebreaker_bids']
        
        for table in tables:
            table_name = table[0]
            if table_name in existing_tables:
                print(f"   ✅ {table_name:<30} (EXISTING - reused)")
            elif table_name in new_tables:
                print(f"   🆕 {table_name:<30} (NEW - created)")
            else:
                print(f"   ✅ {table_name:<30}")
        
        print("\n" + "="*80)
        print("\n🎉 SUCCESS! All tables ready!\n")
        print("Next steps:")
        print("  1. Restart your Next.js server")
        print("  2. Try creating a bulk round")
        print("  3. Everything should work now! ✅\n")
        
    except Exception as e:
        print(f"\n❌ Error during migration: {e}")
        conn.rollback()
        print("❌ Transaction rolled back")
        sys.exit(1)
        
    finally:
        cursor.close()
        conn.close()
        print("✅ Database connection closed\n")

if __name__ == "__main__":
    try:
        run_migration()
    except KeyboardInterrupt:
        print("\n\n⚠️  Migration cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        sys.exit(1)
