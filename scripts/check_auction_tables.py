import os
import psycopg2
from dotenv import load_dotenv
from pathlib import Path

env_path = Path(__file__).parent.parent / '.env.local'
load_dotenv(env_path)

DATABASE_URL = os.getenv('NEON_AUCTION_DB_URL')

conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

print("📋 Tables in auction database:\n")
cur.execute("""
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name
""")

for row in cur.fetchall():
    print(f"   {row[0]}")

cur.close()
conn.close()
