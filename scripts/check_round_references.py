import os
import psycopg2
from dotenv import load_dotenv
from pathlib import Path

env_path = Path(__file__).parent.parent / '.env.local'
load_dotenv(env_path)

DATABASE_URL = os.getenv('NEON_AUCTION_DB_URL')

conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

print("📋 Checking round_id values in round_bids and round_players:\n")

cur.execute("SELECT DISTINCT round_id FROM round_bids LIMIT 5")
print("Sample round_ids in round_bids:")
for row in cur.fetchall():
    print(f"   {row[0]}")

cur.execute("SELECT DISTINCT round_id FROM round_players LIMIT 5")
print("\nSample round_ids in round_players:")
for row in cur.fetchall():
    print(f"   {row[0]}")

# Check if these IDs exist in rounds table
print("\n📋 Checking 'rounds' table...")
cur.execute("SELECT COUNT(*) FROM rounds")
rounds_count = cur.fetchone()[0]
print(f"   Total rounds in 'rounds' table: {rounds_count}")

if rounds_count > 0:
    cur.execute("""
        SELECT id, season_id, position, status, end_time 
        FROM rounds 
        LIMIT 5
    """)
    print("\n   Sample rounds:")
    for row in cur.fetchall():
        print(f"      ID: {row[0]}, Season: {row[1]}, Position: {row[2]}, Status: {row[3]}")

cur.close()
conn.close()
