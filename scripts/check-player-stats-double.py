#!/usr/bin/env python3
"""Check if player_seasons has processed_fixtures column and optionally divide stats by 2"""

import os
import psycopg2
from dotenv import load_dotenv

load_dotenv('.env.local')

conn = psycopg2.connect(os.getenv('NEON_TOURNAMENT_DB_URL'))
cur = conn.cursor()

print("\n" + "="*60)
print("CHECKING PLAYER_SEASONS TABLE")
print("="*60)

# Check if processed_fixtures column exists
cur.execute("""
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'player_seasons' 
    AND column_name = 'processed_fixtures'
""")

result = cur.fetchone()
if result:
    print(f"\n✓ processed_fixtures column EXISTS: {result[1]}")
else:
    print("\n✗ processed_fixtures column DOES NOT EXIST")
    print("   Need to add this column to track fixtures and prevent double counting")

# Show sample stats
cur.execute("""
    SELECT 
        player_name,
        matches_played,
        goals_scored,
        wins,
        draws,
        losses,
        processed_fixtures
    FROM player_seasons
    WHERE matches_played > 0
    ORDER BY matches_played DESC
    LIMIT 10
""")

stats = cur.fetchall()
print(f"\n\nSample player stats (top 10 by matches played):")
print(f"{'Player':<20} {'MP':<4} {'Goals':<6} {'W':<3} {'D':<3} {'L':<3} {'Proc Fixtures'}")
print("-" * 80)
for s in stats:
    proc_fixtures = len(s[6]) if s[6] else 0
    print(f"{s[0]:<20} {s[1]:<4} {s[2]:<6} {s[3]:<3} {s[4]:<3} {s[5]:<3} {proc_fixtures}")

cur.close()
conn.close()

print("\n✅ Check complete")
