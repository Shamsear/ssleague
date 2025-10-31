#!/usr/bin/env python3
"""
Create player_awards table for individual and category awards
Similar to team_trophies but for player achievements
"""

import os
import sys
from pathlib import Path
import psycopg2
from dotenv import load_dotenv

env_path = Path(__file__).parent.parent / '.env.local'
load_dotenv(dotenv_path=env_path)

def main():
    print("🚀 Creating player_awards table...\n")
    
    db_url = os.getenv('NEON_TOURNAMENT_DB_URL')
    if not db_url:
        print("❌ ERROR: NEON_TOURNAMENT_DB_URL not found")
        sys.exit(1)
    
    try:
        conn = psycopg2.connect(db_url)
        cursor = conn.cursor()
        
        # Read migration SQL
        migration_path = Path(__file__).parent.parent / 'database' / 'migrations' / 'create-player-awards-table.sql'
        with open(migration_path, 'r') as f:
            migration_sql = f.read()
        
        print("📄 Migration SQL:")
        print(migration_sql)
        print("\n🔧 Executing migration...\n")
        
        # Execute migration
        cursor.execute(migration_sql)
        conn.commit()
        
        print("✅ Migration completed successfully!")
        
        # Verify the table was created
        print("\n📊 Verifying table structure...")
        cursor.execute("""
            SELECT column_name, data_type, character_maximum_length
            FROM information_schema.columns
            WHERE table_name = 'player_awards'
            ORDER BY ordinal_position
        """)
        
        columns = cursor.fetchall()
        if columns:
            print("\nplayer_awards table columns:")
            for col in columns:
                max_len = f"({col[2]})" if col[2] else ""
                print(f"  - {col[0]}: {col[1]}{max_len}")
            print(f"\n✅ Table created with {len(columns)} columns")
        else:
            print("\n⚠️  Warning: Table not found after creation")
        
        # Check constraints
        cursor.execute("""
            SELECT constraint_name, constraint_type
            FROM information_schema.table_constraints
            WHERE table_name = 'player_awards'
        """)
        
        constraints = cursor.fetchall()
        if constraints:
            print("\nConstraints:")
            for name, ctype in constraints:
                print(f"  - {name}: {ctype}")
        
        # Check indexes
        cursor.execute("""
            SELECT indexname
            FROM pg_indexes
            WHERE tablename = 'player_awards'
        """)
        
        indexes = cursor.fetchall()
        if indexes:
            print(f"\nIndexes ({len(indexes)}):")
            for idx in indexes:
                print(f"  - {idx[0]}")
        
        cursor.close()
        conn.close()
        
        print("\n🎉 player_awards table ready!")
        print("\n📋 Example Usage:")
        print("\n  Individual Award:")
        print("    award_category: 'individual'")
        print("    award_type: 'Golden Boot'")
        print("    award_position: 'Winner'")
        print("    player_category: NULL")
        print("\n  Category Award:")
        print("    award_category: 'category'")
        print("    award_type: 'Best Attacker'")
        print("    award_position: 'Winner'")
        print("    player_category: 'Attacker'")
        
        return 0
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    sys.exit(main())
