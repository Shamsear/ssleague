#!/usr/bin/env python3
"""
Database Migration Script
Adds enable_category_requirements column to tournament_settings table
"""

import os
import sys
from urllib.parse import urlparse
import psycopg2
from dotenv import load_dotenv

# Load environment variables from .env.local
load_dotenv('.env.local')

def run_migration():
    """Run the database migration to add enable_category_requirements column"""
    
    print("🔍 Starting database migration...\n")
    print("="*80)
    
    # Get database URL from environment
    db_url = os.getenv('NEON_DATABASE_URL') or os.getenv('DATABASE_URL')
    
    if not db_url:
        print("❌ Error: No database connection string found!")
        print("   Make sure NEON_DATABASE_URL or DATABASE_URL is set in .env.local")
        sys.exit(1)
    
    print(f"✅ Found database connection string")
    
    # Parse the URL
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
        
    except Exception as e:
        print(f"❌ Error parsing database URL: {e}")
        sys.exit(1)
    
    # Connect to database
    try:
        conn = psycopg2.connect(**conn_params)
        conn.autocommit = False
        cursor = conn.cursor()
        print("✅ Connected to database\n")
        
    except Exception as e:
        print(f"❌ Error connecting to database: {e}")
        sys.exit(1)
    
    # Read migration SQL from file
    migration_file = os.path.join('migrations', 'add_enable_category_requirements.sql')
    
    try:
        with open(migration_file, 'r') as f:
            migration_sql = f.read()
        print(f"✅ Loaded migration file: {migration_file}\n")
    except Exception as e:
        print(f"❌ Error reading migration file: {e}")
        sys.exit(1)
    
    try:
        print("📝 Running migration SQL...\n")
        
        # Execute the migration
        cursor.execute(migration_sql)
        
        print("✅ Migration SQL executed successfully\n")
        
        # Commit the transaction
        conn.commit()
        print("✅ Transaction committed\n")
        
        # Verify the changes
        print("="*80)
        print("\n🔍 Verifying changes...\n")
        
        cursor.execute("""
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_name = 'tournament_settings'
            AND column_name = 'enable_category_requirements';
        """)
        
        column = cursor.fetchone()
        
        if column:
            print("📊 New column added to tournament_settings:\n")
            print(f"   ✅ Column: {column[0]}")
            print(f"   ✅ Type: {column[1]}")
            print(f"   ✅ Nullable: {column[2]}")
            print(f"   ✅ Default: {column[3]}")
        else:
            print("⚠️  Column not found (may already exist)")
        
        print("\n" + "="*80)
        print("\n🎉 SUCCESS! Migration completed!\n")
        print("Next steps:")
        print("  1. Restart your Next.js server")
        print("  2. Go to /dashboard/committee/team-management/tournament")
        print("  3. Create or edit a tournament")
        print("  4. Toggle the category requirements ON/OFF")
        print("  5. Teams can now create lineups without restrictions when disabled! ✅\n")
        
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
