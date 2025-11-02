#!/usr/bin/env python3
"""Remove redundant columns from fantasy_players table"""

import os
import psycopg2
from dotenv import load_dotenv

load_dotenv('.env.local')

conn = psycopg2.connect(os.getenv('FANTASY_DATABASE_URL'))
cur = conn.cursor()

print("\n" + "="*80)
print("CLEANING UP fantasy_players TABLE SCHEMA")
print("="*80)

print("\nCurrent columns:")
cur.execute("""
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'fantasy_players' 
    ORDER BY ordinal_position
""")
for col in cur.fetchall():
    print(f"  {col[0]}: {col[1]}")

# Drop redundant columns that should be fetched from player_seasons
redundant_columns = [
    'player_name',
    'position', 
    'real_team_id',
    'real_team_name',
    'star_rating',
    'category',
    'current_price'  # Can calculate on-demand from player stats
]

print("\nRemoving redundant columns...")
for col in redundant_columns:
    try:
        cur.execute(f"""
            ALTER TABLE fantasy_players 
            DROP COLUMN IF EXISTS {col}
        """)
        print(f"  ✓ Dropped {col}")
    except Exception as e:
        print(f"  ✗ Failed to drop {col}: {e}")

conn.commit()

print("\n" + "="*80)
print("UPDATED SCHEMA")
print("="*80)

cur.execute("""
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns 
    WHERE table_name = 'fantasy_players' 
    ORDER BY ordinal_position
""")

print("\nMinimal fantasy_players columns:")
for col in cur.fetchall():
    print(f"  {col[0]}: {col[1]} (Nullable: {col[2]})")

print("\n" + "="*80)
print("COLUMN PURPOSES")
print("="*80)

print("""
KEEP in fantasy_players (fantasy-specific):
  ✓ id                 - Primary key
  ✓ league_id          - Which fantasy league
  ✓ real_player_id     - Link to player_seasons
  ✓ times_drafted      - How many teams drafted this player
  ✓ total_points       - Total fantasy points across all teams
  ✓ draft_price        - Price at draft time (cached)
  ✓ is_available       - Still available to draft
  ✓ created_at/updated_at

FETCH from player_seasons (real data):
  → player_name, position, real_team_id, real_team_name
  → star_rating, category (Legend/Classic)
  → goals, assists, matches, wins, etc.
""")

cur.close()
conn.close()

print("✅ Schema cleanup complete!")
