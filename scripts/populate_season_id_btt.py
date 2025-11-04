import os, psycopg2
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent.parent / '.env.local')
conn = psycopg2.connect(os.getenv('NEON_AUCTION_DB_URL'))
cur = conn.cursor()

print("🔧 Populating season_id in bulk_tiebreaker_teams\n")

try:
    # Update season_id in bulk_tiebreaker_teams from bulk_tiebreakers
    print("Updating season_id from parent bulk_tiebreakers table...")
    cur.execute("""
        UPDATE bulk_tiebreaker_teams btt
        SET season_id = bt.season_id
        FROM bulk_tiebreakers bt
        WHERE btt.tiebreaker_id = bt.id
        AND btt.season_id IS NULL
    """)
    
    rows_updated = cur.rowcount
    print(f"   ✅ Updated {rows_updated} rows")
    
    conn.commit()
    
    # Verify
    print("\n📊 Verification:")
    cur.execute("""
        SELECT tiebreaker_id, team_id, season_id 
        FROM bulk_tiebreaker_teams
    """)
    
    for row in cur.fetchall():
        print(f"   Tiebreaker: {row[0]}, Team: {row[1]}, Season: {row[2]}")
    
    print("\n🎉 All done!")
    
except Exception as e:
    print(f"\n❌ Error: {e}")
    conn.rollback()
finally:
    cur.close()
    conn.close()
