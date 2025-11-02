#!/usr/bin/env python3
import os, psycopg2
from dotenv import load_dotenv

load_dotenv('.env.local')
conn = psycopg2.connect(os.getenv('NEON_TOURNAMENT_DB_URL'))
cur = conn.cursor()

print("Adding processed_fixtures to teamstats...")
cur.execute("ALTER TABLE teamstats ADD COLUMN IF NOT EXISTS processed_fixtures JSONB DEFAULT '[]'::jsonb")
cur.execute("CREATE INDEX IF NOT EXISTS idx_teamstats_processed_fixtures ON teamstats USING GIN (processed_fixtures)")
conn.commit()

print("✅ Added processed_fixtures column to teamstats table")
cur.close()
conn.close()
