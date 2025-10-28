#!/usr/bin/env python3
"""
Run bonus conditions migration for scoring rules
"""

import os
import sys
from dotenv import load_dotenv
import psycopg2

# Load environment variables
load_dotenv()

def run_migration():
    """Execute the bonus conditions migration"""
    
    # Get database URL from environment
    database_url = os.getenv('FANTASY_DATABASE_URL') or os.getenv('DATABASE_URL')
    
    if not database_url:
        print("❌ Error: FANTASY_DATABASE_URL or DATABASE_URL not found in environment variables")
        sys.exit(1)
    
    print("🚀 Running bonus conditions migration...")
    print(f"📊 Database: {database_url.split('@')[1] if '@' in database_url else 'localhost'}")
    
    try:
        # Connect to database
        conn = psycopg2.connect(database_url)
        cur = conn.cursor()
        
        # Read and execute migration file
        migration_file = os.path.join(
            os.path.dirname(__file__),
            '..',
            'database',
            'migrations',
            'add-bonus-conditions-to-scoring-rules.sql'
        )
        
        with open(migration_file, 'r') as f:
            migration_sql = f.read()
        
        print("\n📝 Executing migration SQL...")
        cur.execute(migration_sql)
        
        # Fetch result message
        result = cur.fetchone()
        if result:
            print(f"\n{result[0]}")
        
        # Commit transaction
        conn.commit()
        
        print("\n✅ Migration completed successfully!")
        print("\n📋 New columns added:")
        print("   - is_bonus_rule (BOOLEAN)")
        print("   - bonus_conditions (JSONB)")
        print("   - priority (INTEGER)")
        print("\n💡 You can now create bonus/conditional scoring rules!")
        
    except psycopg2.Error as e:
        print(f"\n❌ Database error: {e}")
        sys.exit(1)
    except FileNotFoundError:
        print(f"\n❌ Migration file not found: {migration_file}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        sys.exit(1)
    finally:
        if 'cur' in locals():
            cur.close()
        if 'conn' in locals():
            conn.close()

if __name__ == '__main__':
    run_migration()
