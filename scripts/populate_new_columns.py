import os, psycopg2
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent.parent / '.env.local')
conn = psycopg2.connect(os.getenv('NEON_AUCTION_DB_URL'))
cur = conn.cursor()

print("🔧 Populating new columns in existing tiebreaker\n")

try:
    # Update existing record with initial values
    cur.execute("""
        UPDATE bulk_tiebreakers
        SET 
            current_highest_bid = COALESCE(original_amount, 10),
            base_price = COALESCE(original_amount, 10),
            tie_amount = COALESCE(original_amount, 10),
            tied_team_count = jsonb_array_length(tied_teams),
            teams_remaining = jsonb_array_length(tied_teams),
            start_time = created_at,
            last_activity_time = created_at
        WHERE current_highest_bid IS NULL
    """)
    
    rows_updated = cur.rowcount
    print(f"✅ Updated {rows_updated} tiebreaker records")
    
    conn.commit()
    
    # Verify
    cur.execute("SELECT id, current_highest_bid, base_price, tied_team_count FROM bulk_tiebreakers")
    print("\nVerification:")
    for row in cur.fetchall():
        print(f"  ID: {row[0]}, Highest Bid: {row[1]}, Base Price: {row[2]}, Team Count: {row[3]}")
    
    print("\n🎉 Done!")
    
except Exception as e:
    print(f"\n❌ Error: {e}")
    conn.rollback()
finally:
    cur.close()
    conn.close()
