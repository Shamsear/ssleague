#!/usr/bin/env python3
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv('.env.local')

conn = psycopg2.connect(os.getenv('FANTASY_DATABASE_URL'))
cur = conn.cursor()

# Check fantasy_teams columns
cur.execute("""
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'fantasy_teams' 
    ORDER BY ordinal_position
""")
print("\nfantasy_teams columns:")
for col in cur.fetchall():
    print(f"  - {col[0]}: {col[1]}")

# Check fantasy_scoring_rules columns
cur.execute("""
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'fantasy_scoring_rules' 
    ORDER BY ordinal_position
""")
print("\nfantasy_scoring_rules columns:")
for col in cur.fetchall():
    print(f"  - {col[0]}: {col[1]}")

# Check data
cur.execute("SELECT COUNT(*) FROM fantasy_teams WHERE league_id = '1'")
print(f"\nTotal teams in league 1: {cur.fetchone()[0]}")

cur.execute("SELECT COUNT(*) FROM fantasy_scoring_rules WHERE league_id = '1'")
print(f"Total scoring rules in league 1: {cur.fetchone()[0]}")

cur.close()
conn.close()
