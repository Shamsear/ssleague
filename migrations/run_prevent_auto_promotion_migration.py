"""
Database Migration Script
Adds prevent_auto_promotion column to player_seasons table
"""

import os
import sys
import psycopg2
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables from project root
project_root = Path(__file__).parent.parent
env_file = project_root / '.env.local'
if not env_file.exists():
    env_file = project_root / '.env'

load_dotenv(env_file)

def run_migration():
    """Run the migration to add prevent_auto_promotion column"""
    
    # Get database URL from environment
    database_url = os.getenv('DATABASE_URL') or os.getenv('NEON_DATABASE_URL')
    
    if not database_url:
        print("❌ Error: DATABASE_URL or NEON_DATABASE_URL not found in environment variables")
        print("Please set DATABASE_URL in your .env file")
        sys.exit(1)
    
    print("🔗 Connecting to database...")
    
    try:
        # Connect to database
        conn = psycopg2.connect(database_url)
        cursor = conn.cursor()
        
        print("✅ Connected to database")
        print("📝 Running migration...")
        
        # Read the migration SQL file
        migration_file = os.path.join(os.path.dirname(__file__), 'add_prevent_auto_promotion.sql')
        
        with open(migration_file, 'r') as f:
            migration_sql = f.read()
        
        # Execute the migration
        cursor.execute(migration_sql)
        conn.commit()
        
        print("✅ Migration completed successfully!")
        print("✅ Column 'prevent_auto_promotion' has been added to player_seasons table")
        
        # Verify the column exists
        cursor.execute("""
            SELECT EXISTS (
                SELECT 1 
                FROM information_schema.columns 
                WHERE table_name = 'player_seasons' 
                  AND column_name = 'prevent_auto_promotion'
            );
        """)
        
        exists = cursor.fetchone()[0]
        
        if exists:
            print("✅ Verified: Column exists in database")
        else:
            print("⚠️ Warning: Column verification failed")
        
        cursor.close()
        conn.close()
        
    except psycopg2.Error as e:
        print(f"❌ Database error: {e}")
        sys.exit(1)
    except FileNotFoundError:
        print(f"❌ Error: Migration file not found at {migration_file}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    print("=" * 60)
    print("Database Migration: Add prevent_auto_promotion column")
    print("=" * 60)
    run_migration()
    print("=" * 60)
    print("🎉 All done! You can now use the prevent auto-promotion feature.")
    print("=" * 60)
