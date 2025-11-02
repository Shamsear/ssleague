#!/usr/bin/env python3
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv('.env.local')

conn = psycopg2.connect(os.getenv('FANTASY_DATABASE_URL'))
cur = conn.cursor()

cur.execute("""
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns 
    WHERE table_name = 'fantasy_player_points' 
    ORDER BY ordinal_position
""")

cols = cur.fetchall()
print("\nfantasy_player_points columns:")
for c in cols:
    print(f"  {c[0]}: {c[1]} (Nullable: {c[2]})")

cur.close()
conn.close()
