import os, psycopg2
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent.parent / '.env.local')
conn = psycopg2.connect(os.getenv('NEON_AUCTION_DB_URL'))
cur = conn.cursor()

print("🔧 Fixing tiebreaker_id column type in bulk_tiebreaker_teams\n")

try:
    # Change tiebreaker_id from INTEGER to VARCHAR to match tiebreakers.id
    print("Changing tiebreaker_id from INTEGER to VARCHAR...")
    cur.execute("""
        ALTER TABLE bulk_tiebreaker_teams 
        ALTER COLUMN tiebreaker_id TYPE VARCHAR(50)
    """)
    print("   ✅ tiebreaker_id type changed to VARCHAR(50)")
    
    conn.commit()
    
    print("\n🎉 Column type updated successfully!")
    
    # Show schema
    cur.execute("""
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'bulk_tiebreaker_teams' 
        AND column_name IN ('tiebreaker_id', 'team_id')
    """)
    print("\nKey columns:")
    for row in cur.fetchall():
        print(f"   {row[0]}: {row[1]}")
    
except Exception as e:
    print(f"\n❌ Error: {e}")
    conn.rollback()
finally:
    cur.close()
    conn.close()
