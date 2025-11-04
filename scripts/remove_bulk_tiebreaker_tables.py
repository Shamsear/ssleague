import os
import psycopg2
from dotenv import load_dotenv
from pathlib import Path

env_path = Path(__file__).parent.parent / '.env.local'
load_dotenv(env_path)

DATABASE_URL = os.getenv('NEON_AUCTION_DB_URL')

if not DATABASE_URL:
    print("❌ NEON_AUCTION_DB_URL not found")
    exit(1)

def remove_bulk_tiebreaker_tables():
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        
        print("🗑️  Removing unused bulk_tiebreaker tables\n")
        print("=" * 80)
        
        print("\n📋 Analysis:")
        print("   ✅ The code uses 'tiebreakers' table (has 1 row)")
        print("   ❌ The 'bulk_tiebreaker_*' tables are NOT used in the code")
        print("   ❌ The routes in /api/.../bulk-tiebreakers/ query 'tiebreakers', not 'bulk_tiebreakers'")
        
        tables_to_remove = [
            'bulk_tiebreaker_bids',
            'bulk_tiebreaker_teams',
            'bulk_tiebreakers'
        ]
        
        print("\n📋 Tables to be removed:")
        for table in tables_to_remove:
            cur.execute(f"SELECT COUNT(*) FROM {table}")
            count = cur.fetchone()[0]
            print(f"   - {table} ({count} rows)")
        
        print("\n⚠️  WARNING: This action cannot be undone!")
        print("   These tables were intended for a different bulk tiebreaker design")
        print("   that was never implemented. The current system uses 'tiebreakers' table.")
        
        # Check for foreign key dependencies
        print("\n🔍 Checking for foreign key dependencies...")
        has_dependencies = False
        for table in tables_to_remove:
            cur.execute(f"""
                SELECT
                    tc.table_name,
                    tc.constraint_name
                FROM information_schema.table_constraints AS tc
                JOIN information_schema.constraint_column_usage AS ccu
                    ON tc.constraint_name = ccu.constraint_name
                WHERE tc.constraint_type = 'FOREIGN KEY'
                    AND ccu.table_name = '{table}'
            """)
            dependencies = cur.fetchall()
            if dependencies:
                has_dependencies = True
                print(f"   ⚠️  {table} is referenced by:")
                for dep in dependencies:
                    print(f"      - {dep[0]} ({dep[1]})")
        
        if not has_dependencies:
            print("   ✅ No external dependencies found")
        
        print("\n" + "=" * 80)
        print("\nRemoving tables...")
        
        for table in tables_to_remove:
            print(f"\n   🗑️  Dropping {table}...")
            cur.execute(f"DROP TABLE IF EXISTS {table} CASCADE")
            print(f"   ✅ {table} removed")
        
        conn.commit()
        
        print("\n" + "=" * 80)
        print("\n🎉 Cleanup completed successfully!")
        print("\n✅ Current tiebreaker system:")
        print("   - tiebreakers (main table)")
        print("   - team_tiebreakers (team participation)")
        print("   - Both regular and bulk rounds use the same tables!")
        
        cur.close()
        conn.close()
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        exit(1)

if __name__ == "__main__":
    remove_bulk_tiebreaker_tables()
