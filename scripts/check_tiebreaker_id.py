import os, psycopg2
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent.parent / '.env.local')
conn = psycopg2.connect(os.getenv('NEON_AUCTION_DB_URL'))
cur = conn.cursor()

tiebreaker_id = 'SSPSLTR00001'

print(f"Searching for tiebreaker {tiebreaker_id}...\n")

# Check in tiebreakers table
cur.execute(f"SELECT * FROM tiebreakers WHERE id = '{tiebreaker_id}'")
if cur.fetchone():
    print("✅ Found in 'tiebreakers' table")
else:
    print("❌ NOT found in 'tiebreakers' table")

# Check in bulk_tiebreakers table
cur.execute(f"SELECT * FROM bulk_tiebreakers WHERE id = '{tiebreaker_id}'")
if cur.fetchone():
    print("✅ Found in 'bulk_tiebreakers' table")
else:
    print("❌ NOT found in 'bulk_tiebreakers' table")
