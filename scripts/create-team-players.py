#!/usr/bin/env python3
import os
import psycopg2
from pathlib import Path
from dotenv import load_dotenv

env_file = Path(__file__).parent.parent / '.env.local'
if env_file.exists():
    load_dotenv(env_file)

database_url = os.getenv('NEON_DATABASE_URL')
migration_file = Path(__file__).parent.parent / 'database' / 'migrations' / 'create-team-players-table.sql'

conn = psycopg2.connect(database_url)
cur = conn.cursor()

with open(migration_file, 'r') as f:
    sql = f.read()

print("🚀 Creating team_players table in auction database...")
cur.execute(sql)
conn.commit()

print("✅ Created team_players table")

cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'team_players' ORDER BY ordinal_position")
columns = [r[0] for r in cur.fetchall()]
print("\n📋 Columns:", columns)

cur.close()
conn.close()
