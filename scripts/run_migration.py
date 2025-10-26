#!/usr/bin/env python3
"""
Run SQL migration for fixture audit trail
"""

import os
import sys
import psycopg2
from pathlib import Path
from dotenv import load_dotenv

def run_migration():
    # Load environment variables from .env.local
    env_file = Path(__file__).parent.parent / '.env.local'
    if env_file.exists():
        load_dotenv(env_file)
        print(f"✅ Loaded environment from {env_file}")
    else:
        print(f"⚠️  .env.local not found, using system environment variables")
    
    # Get database URL from environment
    database_url = os.getenv('NEON_DATABASE_URL')
    
    if not database_url:
        print("❌ Error: NEON_DATABASE_URL environment variable not set")
        print("Please set it in your .env.local file")
        sys.exit(1)
    
    # Path to migration file
    migration_file = Path(__file__).parent.parent / 'database' / 'migrations' / 'add-fixture-audit-trail.sql'
    
    if not migration_file.exists():
        print(f"❌ Error: Migration file not found at {migration_file}")
        sys.exit(1)
    
    print(f"📄 Reading migration file: {migration_file}")
    
    # Read SQL file
    with open(migration_file, 'r', encoding='utf-8') as f:
        sql_content = f.read()
    
    print("🔌 Connecting to database...")
    
    try:
        # Connect to database
        conn = psycopg2.connect(database_url)
        conn.autocommit = False
        cursor = conn.cursor()
        
        print("✅ Connected successfully")
        print("🚀 Running migration...")
        
        # Execute SQL
        cursor.execute(sql_content)
        
        # Commit transaction
        conn.commit()
        
        print("✅ Migration completed successfully!")
        print("\n📊 Verifying changes...")
        
        # Verify audit_log table was created
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'fixture_audit_log'
            );
        """)
        
        audit_table_exists = cursor.fetchone()[0]
        
        if audit_table_exists:
            print("✅ fixture_audit_log table created")
        else:
            print("⚠️  fixture_audit_log table not found")
        
        # Check new columns in fixtures table
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'fixtures' 
                AND column_name IN ('created_by', 'updated_by', 'match_status_reason', 'declared_by')
            ORDER BY column_name;
        """)
        
        new_columns = cursor.fetchall()
        
        if new_columns:
            print(f"✅ New columns added to fixtures table:")
            for col in new_columns:
                print(f"   - {col[0]}")
        else:
            print("⚠️  New columns not found in fixtures table")
        
        # Close connection
        cursor.close()
        conn.close()
        
        print("\n🎉 Migration complete! Audit trail system is ready.")
        
    except psycopg2.Error as e:
        print(f"\n❌ Database error occurred:")
        print(f"   {e}")
        if 'conn' in locals():
            conn.rollback()
            conn.close()
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error occurred:")
        print(f"   {e}")
        if 'conn' in locals():
            conn.close()
        sys.exit(1)

if __name__ == '__main__':
    print("=" * 60)
    print("  FIXTURE AUDIT TRAIL MIGRATION")
    print("=" * 60)
    print()
    run_migration()
