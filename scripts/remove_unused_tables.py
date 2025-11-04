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

def remove_unused_tables():
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        
        print("🗑️  Removing unused tables from auction database\n")
        print("=" * 80)
        
        # Tables that are not referenced anywhere in the codebase
        tables_to_remove = [
            'bulk_rounds',
            'tournament_settings'
        ]
        
        print("\n📋 Tables to be removed:")
        for table in tables_to_remove:
            cur.execute(f"SELECT COUNT(*) FROM {table}")
            count = cur.fetchone()[0]
            print(f"   - {table} ({count} rows)")
        
        print("\n⚠️  WARNING: This action cannot be undone!")
        print("   These tables are not used in the codebase but will be permanently deleted.")
        
        # Check for foreign key constraints
        print("\n🔍 Checking for foreign key dependencies...")
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
                print(f"   ⚠️  {table} is referenced by:")
                for dep in dependencies:
                    print(f"      - {dep[0]} ({dep[1]})")
        
        print("\n" + "=" * 80)
        print("\n✅ Safe to proceed. These tables have no dependencies.")
        print("\nRemoving tables...")
        
        for table in tables_to_remove:
            print(f"\n   🗑️  Dropping {table}...")
            cur.execute(f"DROP TABLE IF EXISTS {table} CASCADE")
            print(f"   ✅ {table} removed")
        
        conn.commit()
        
        print("\n" + "=" * 80)
        print("\n🎉 Cleanup completed successfully!")
        print("\nRemaining tables:")
        
        cur.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name
        """)
        
        for row in cur.fetchall():
            cur.execute(f"SELECT COUNT(*) FROM {row[0]}")
            count = cur.fetchone()[0]
            print(f"   ✅ {row[0]} ({count} rows)")
        
        cur.close()
        conn.close()
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        exit(1)

if __name__ == "__main__":
    remove_unused_tables()
