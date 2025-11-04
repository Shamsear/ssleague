import os, psycopg2
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent.parent / '.env.local')
conn = psycopg2.connect(os.getenv('NEON_AUCTION_DB_URL'))
cur = conn.cursor()

print("🔧 Fixing tiebreaker_id column type in bulk_tiebreaker_bids\n")

try:
    # Change tiebreaker_id from INTEGER to VARCHAR
    print("Changing tiebreaker_id from INTEGER to VARCHAR...")
    cur.execute("""
        ALTER TABLE bulk_tiebreaker_bids 
        ALTER COLUMN tiebreaker_id TYPE VARCHAR(50)
    """)
    print("   ✅ tiebreaker_id type changed to VARCHAR(50)")
    
    conn.commit()
    
    print("\n🎉 Column type updated successfully!")
    
    # Show schema
    cur.execute("""
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'bulk_tiebreaker_bids' 
        AND column_name = 'tiebreaker_id'
    """)
    row = cur.fetchone()
    print(f"\nVerification:")
    print(f"   tiebreaker_id: {row[1]}")
    
except Exception as e:
    print(f"\n❌ Error: {e}")
    conn.rollback()
finally:
    cur.close()
    conn.close()
