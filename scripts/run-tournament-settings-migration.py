#!/usr/bin/env python3
"""
Database Migration Script
Adds missing columns to tournament_settings table:
- enable_category_requirements (BOOLEAN)
- lineup_category_requirements (JSONB)
- rewards (JSONB)
- number_of_teams (INTEGER)
- tournament_id (TEXT)
"""

import os
import sys
from urllib.parse import urlparse
import psycopg2
from dotenv import load_dotenv

# Load environment variables from .env.local
load_dotenv('.env.local')

def run_migration():
    """Run the database migration to add columns to tournament_settings"""
    
    print("🔍 Starting tournament_settings migration...\n")
    print("="*80)
    
    # Get tournament database URL from environment
    db_url = os.getenv('NEON_TOURNAMENT_DB_URL')
    
    if not db_url:
        print("❌ Error: NEON_TOURNAMENT_DB_URL not found!")
        print("   Make sure NEON_TOURNAMENT_DB_URL is set in .env.local")
        sys.exit(1)
    
    print(f"✅ Found tournament database connection string")
    
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
        print("✅ Connected to tournament database\n")
        
    except Exception as e:
        print(f"❌ Error connecting to database: {e}")
        sys.exit(1)
    
    # Read migration SQL from file
    migration_file = os.path.join('migrations', 'update_tournament_settings_table.sql')
    
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
            AND column_name IN (
                'enable_category_requirements', 
                'lineup_category_requirements', 
                'rewards',
                'number_of_teams',
                'tournament_id'
            )
            ORDER BY column_name;
        """)
        
        columns = cursor.fetchall()
        
        if columns:
            print("📊 New/Updated columns in tournament_settings:\n")
            for col in columns:
                nullable = "NULL" if col[2] == 'YES' else "NOT NULL"
                default = col[3] if col[3] else "no default"
                print(f"   ✅ {col[0]:<35} {col[1]:<20} {nullable:<10} (default: {default})")
        else:
            print("⚠️  No columns found (may already exist)")
        
        # Check table structure
        cursor.execute("""
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'tournament_settings'
            ORDER BY ordinal_position;
        """)
        
        all_columns = cursor.fetchall()
        print(f"\n📋 Complete tournament_settings table structure ({len(all_columns)} columns):\n")
        for col in all_columns:
            print(f"   • {col[0]}: {col[1]}")
        
        print("\n" + "="*80)
        print("\n🎉 SUCCESS! Migration completed!\n")
        print("Next steps:")
        print("  1. Restart your Next.js server")
        print("  2. Go to /dashboard/committee/team-management/tournament")
        print("  3. Create or edit a tournament")
        print("  4. Toggle the category requirements ON/OFF")
        print("  5. Set rewards for matches, positions, and knockout stages")
        print("  6. Teams can now create lineups without restrictions when disabled! ✅\n")
        
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
