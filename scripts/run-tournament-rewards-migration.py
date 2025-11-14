import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add parent directory to path
parent_dir = Path(__file__).parent.parent
sys.path.insert(0, str(parent_dir))

def run_migration():
    """Run the tournament rewards migration"""
    try:
        import psycopg2
        
        # Get DATABASE_URL from environment
        database_url = os.getenv('DATABASE_URL')
        if not database_url:
            print("Error: DATABASE_URL not found in environment variables")
            return False
        
        print("Connecting to database...")
        conn = psycopg2.connect(database_url)
        cursor = conn.cursor()
        
        # Read the migration file
        migration_path = parent_dir / 'migrations' / 'add_tournament_rewards.sql'
        print(f"Reading migration file: {migration_path}")
        
        with open(migration_path, 'r', encoding='utf-8') as f:
            sql = f.read()
        
        print("Executing migration...")
        cursor.execute(sql)
        conn.commit()
        
        print("✅ Migration completed successfully!")
        print("\nChanges applied:")
        print("  - Added 'rewards' JSONB column to tournaments table")
        print("  - Added 'number_of_teams' INTEGER column to tournaments table")
        print("  - Created GIN index on rewards column")
        print("  - Added column comments")
        
        cursor.close()
        conn.close()
        
        return True
        
    except Exception as e:
        print(f"❌ Error running migration: {e}")
        if 'conn' in locals():
            conn.rollback()
            conn.close()
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("Tournament Rewards Migration")
    print("=" * 60)
    success = run_migration()
    sys.exit(0 if success else 1)
