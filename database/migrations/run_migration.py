"""
Database Migration Script
Applies the check_tiebreaker_winner function to the database
"""

import os
import sys
import psycopg2
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables from project root
project_root = Path(__file__).parent.parent.parent
env_file = project_root / '.env.local'
if not env_file.exists():
    env_file = project_root / '.env'

load_dotenv(env_file)

def run_migration():
    """Run the migration to create check_tiebreaker_winner function"""
    
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
        migration_file = os.path.join(os.path.dirname(__file__), 'cleanup-bulk-tiebreakers.sql')
        
        with open(migration_file, 'r') as f:
            migration_sql = f.read()
        
        # Execute the migration
        cursor.execute(migration_sql)
        conn.commit()
        
        print("✅ Migration completed successfully!")
        print("✅ Function 'check_tiebreaker_winner' has been created")
        
        # Test the function exists
        cursor.execute("""
            SELECT EXISTS (
                SELECT 1 
                FROM pg_proc 
                WHERE proname = 'check_tiebreaker_winner'
            );
        """)
        
        exists = cursor.fetchone()[0]
        
        if exists:
            print("✅ Verified: Function exists in database")
        else:
            print("⚠️ Warning: Function verification failed")
        
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
    print("Database Migration: check_tiebreaker_winner Function")
    print("=" * 60)
    run_migration()
    print("=" * 60)
    print("🎉 All done! You can now use the withdrawal feature.")
    print("=" * 60)
