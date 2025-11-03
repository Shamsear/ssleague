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

print("🗑️  Dropping old budget column...")
cur.execute("ALTER TABLE teams DROP COLUMN IF EXISTS budget")
conn.commit()

print("✅ Dropped old budget column")

cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'teams' ORDER BY ordinal_position")
columns = [r[0] for r in cur.fetchall()]
print("\n📋 Remaining columns:", columns)

cur.close()
conn.close()
