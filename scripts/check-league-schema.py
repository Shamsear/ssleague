#!/usr/bin/env python3
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv('.env.local')

conn = psycopg2.connect(os.getenv('FANTASY_DATABASE_URL'))
cur = conn.cursor()

# Check schema
cur.execute("""
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns 
    WHERE table_name = 'fantasy_leagues' 
    ORDER BY ordinal_position
""")
print("\nfantasy_leagues schema:")
for col in cur.fetchall():
    print(f"  {col[0]}: {col[1]} (Nullable: {col[2]})")

# Check actual data and type
cur.execute("SELECT id, season_id, is_active, pg_typeof(id) FROM fantasy_leagues")
print("\nCurrent data:")
for row in cur.fetchall():
    print(f"  ID: {row[0]} (type: {row[3]}), Season: {row[1]}, Active: {row[2]}")

cur.close()
conn.close()
