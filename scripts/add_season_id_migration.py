import os
import psycopg2
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables
env_path = Path(__file__).parent.parent / '.env.local'
load_dotenv(env_path)

DATABASE_URL = os.getenv('NEON_AUCTION_DB_URL')

if not DATABASE_URL:
    print("❌ NEON_AUCTION_DB_URL not found in environment variables")
    exit(1)

def run_migration():
    try:
        print("🚀 Starting migration: Add season_id to round_bids and round_players")
        
        # Connect to database
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        
        # Read migration file
        migration_path = Path(__file__).parent.parent / 'database' / 'migrations' / 'add-season-id-to-round-bids.sql'
        with open(migration_path, 'r') as f:
            migration_sql = f.read()
        
        print("📝 Running migration...\n")
        cur.execute(migration_sql)
        conn.commit()
        
        print("\n✅ Migration completed successfully!")
        print("\n📊 Verifying changes...")
        
        # Verify round_bids
        cur.execute("""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'round_bids'
            ORDER BY ordinal_position
        """)
        print("\n✅ round_bids columns:")
        for row in cur.fetchall():
            print(f"   {row[0]}: {row[1]} (nullable: {row[2]})")
        
        # Verify round_players
        cur.execute("""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'round_players'
            ORDER BY ordinal_position
        """)
        print("\n✅ round_players columns:")
        for row in cur.fetchall():
            print(f"   {row[0]}: {row[1]} (nullable: {row[2]})")
        
        # Check data backfill
        cur.execute("SELECT COUNT(*) as total, COUNT(season_id) as with_season_id FROM round_bids")
        result = cur.fetchone()
        print(f"\n📊 round_bids data:")
        print(f"   Total rows: {result[0]}")
        print(f"   With season_id: {result[1]}")
        
        cur.execute("SELECT COUNT(*) as total, COUNT(season_id) as with_season_id FROM round_players")
        result = cur.fetchone()
        print(f"\n📊 round_players data:")
        print(f"   Total rows: {result[0]}")
        print(f"   With season_id: {result[1]}")
        
        print("\n🎉 All done!")
        
        cur.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ Error running migration: {e}")
        exit(1)

if __name__ == "__main__":
    run_migration()
