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

def backfill_season_id():
    try:
        print("🚀 Starting backfill: Adding season_id to existing round_bids and round_players")
        
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        
        # First, check what the rounds table structure looks like
        print("\n📋 Checking rounds table structure...")
        cur.execute("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'rounds'
            ORDER BY ordinal_position
        """)
        print("rounds columns:")
        for row in cur.fetchall():
            print(f"   {row[0]}: {row[1]}")
        
        # Check if there are any rounds
        cur.execute("SELECT COUNT(*) FROM rounds")
        rounds_count = cur.fetchone()[0]
        print(f"\n📊 Found {rounds_count} rounds in rounds table")
        
        if rounds_count == 0:
            print("⚠️  No rounds found. Cannot backfill season_id.")
            cur.close()
            conn.close()
            return
        
        # Backfill round_bids using rounds
        print("\n📝 Backfilling round_bids...")
        cur.execute("""
            UPDATE round_bids rb
            SET season_id = r.season_id
            FROM rounds r
            WHERE rb.round_id = r.id::text
            AND rb.season_id IS NULL
        """)
        round_bids_updated = cur.rowcount
        print(f"   ✅ Updated {round_bids_updated} rows in round_bids")
        
        # Backfill round_players using rounds
        print("\n📝 Backfilling round_players...")
        cur.execute("""
            UPDATE round_players rp
            SET season_id = r.season_id
            FROM rounds r
            WHERE rp.round_id = r.id::text
            AND rp.season_id IS NULL
        """)
        round_players_updated = cur.rowcount
        print(f"   ✅ Updated {round_players_updated} rows in round_players")
        
        conn.commit()
        
        # Verify the backfill
        print("\n📊 Verifying backfill...")
        
        cur.execute("SELECT COUNT(*) as total, COUNT(season_id) as with_season_id FROM round_bids")
        result = cur.fetchone()
        print(f"\nround_bids:")
        print(f"   Total rows: {result[0]}")
        print(f"   With season_id: {result[1]}")
        
        cur.execute("SELECT COUNT(*) as total, COUNT(season_id) as with_season_id FROM round_players")
        result = cur.fetchone()
        print(f"\nround_players:")
        print(f"   Total rows: {result[0]}")
        print(f"   With season_id: {result[1]}")
        
        print("\n🎉 Backfill completed successfully!")
        
        cur.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ Error during backfill: {e}")
        exit(1)

if __name__ == "__main__":
    backfill_season_id()
