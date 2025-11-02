#!/usr/bin/env python3
"""Check teamstats table structure"""

import os
import psycopg2
from dotenv import load_dotenv

load_dotenv('.env.local')

conn = psycopg2.connect(os.getenv('NEON_TOURNAMENT_DB_URL'))
cur = conn.cursor()

print("\n" + "="*60)
print("TEAMSTATS TABLE STRUCTURE")
print("="*60)

# Get column info
cur.execute("""
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns 
    WHERE table_name = 'teamstats'
    ORDER BY ordinal_position
""")

cols = cur.fetchall()
print(f"\nFound {len(cols)} columns:\n")
print(f"{'Column':<30} {'Type':<20} {'Nullable':<10} {'Default'}")
print("-" * 100)
for col in cols:
    default = str(col[3])[:30] if col[3] else 'None'
    print(f"{col[0]:<30} {col[1]:<20} {col[2]:<10} {default}")

# Check current data
print("\n" + "="*60)
print("CURRENT TEAMSTATS DATA")
print("="*60)

cur.execute("""
    SELECT 
        team_id,
        season_id,
        matches_played,
        wins,
        draws,
        losses,
        goals_for,
        goals_against,
        goal_difference,
        points,
        processed_fixtures
    FROM teamstats
    LIMIT 10
""")

teams = cur.fetchall()
print(f"\nFound {len(teams)} team records:\n")

if teams:
    print(f"{'Team ID':<15} {'Season':<12} {'MP':<4} {'W':<3} {'D':<3} {'L':<3} {'GF':<4} {'GA':<4} {'GD':<5} {'Pts':<4} {'Processed'}")
    print("-" * 100)
    for t in teams:
        processed_count = len(t[10]) if t[10] else 0
        print(f"{t[0]:<15} {t[1]:<12} {t[2] or 0:<4} {t[3] or 0:<3} {t[4] or 0:<3} {t[5] or 0:<3} {t[6] or 0:<4} {t[7] or 0:<4} {t[8] or 0:<5} {t[9] or 0:<4} {processed_count} fixtures")

cur.close()
conn.close()

print("\n✅ Table structure check complete")
