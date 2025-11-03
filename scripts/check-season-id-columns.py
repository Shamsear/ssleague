#!/usr/bin/env python3
import os
import psycopg2
from pathlib import Path
from dotenv import load_dotenv

env_file = Path(__file__).parent.parent / '.env.local'
if env_file.exists():
    load_dotenv(env_file)

database_url = os.getenv('NEON_DATABASE_URL')

conn = psycopg2.connect(database_url)
cur = conn.cursor()

# Get all tables
cur.execute("""
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE' 
    ORDER BY table_name
""")

tables = [r[0] for r in cur.fetchall()]

print("=" * 80)
print("CHECKING SEASON_ID IN ALL TABLES")
print("=" * 80)

for table in tables:
    cur.execute(f"""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = '{table}' AND column_name = 'season_id'
    """)
    
    has_season_id = cur.fetchone() is not None
    
    status = "✅" if has_season_id else "❌"
    print(f"{status} {table:<30} {'HAS season_id' if has_season_id else 'MISSING season_id'}")

cur.close()
conn.close()
