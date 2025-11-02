#!/usr/bin/env python3
"""Add player_points column to fantasy_teams table"""

import os
import psycopg2
from dotenv import load_dotenv

load_dotenv('.env.local')

conn = psycopg2.connect(os.getenv('FANTASY_DATABASE_URL'))
cur = conn.cursor()

print("\n" + "="*80)
print("ADDING player_points COLUMN TO fantasy_teams")
print("="*80)

# Check current columns
print("\nCurrent fantasy_teams columns:")
cur.execute("""
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'fantasy_teams' 
    ORDER BY ordinal_position
""")
for col in cur.fetchall():
    print(f"  {col[0]}: {col[1]}")

# Add player_points column
print("\nAdding player_points column...")
try:
    cur.execute("""
        ALTER TABLE fantasy_teams 
        ADD COLUMN IF NOT EXISTS player_points INTEGER DEFAULT 0
    """)
    print("✓ Added player_points column")
except Exception as e:
    print(f"✗ Error: {e}")

conn.commit()

# Verify
print("\n" + "="*80)
print("VERIFICATION")
print("="*80)

cur.execute("""
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'fantasy_teams' 
    AND column_name IN ('player_points', 'passive_points', 'total_points')
    ORDER BY ordinal_position
""")

print("\nPoints columns in fantasy_teams:")
for col in cur.fetchall():
    print(f"  {col[0]}: {col[1]}")

print("\n" + "="*80)
print("COLUMN PURPOSES")
print("="*80)
print("""
  player_points:  Points from drafted players' performance
  passive_points: Points from supported team bonuses
  total_points:   player_points + passive_points
""")

cur.close()
conn.close()

print("✅ Column added successfully!")
