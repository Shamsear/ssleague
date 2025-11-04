import os, psycopg2
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent.parent / '.env.local')
conn = psycopg2.connect(os.getenv('NEON_AUCTION_DB_URL'))
cur = conn.cursor()

cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'bulk_tiebreaker_teams' ORDER BY ordinal_position")
print("bulk_tiebreaker_teams columns:")
for row in cur.fetchall():
    print(f"  {row[0]}: {row[1]}")
