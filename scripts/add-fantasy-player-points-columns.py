#!/usr/bin/env python3
"""Add missing columns to fantasy_player_points table"""

import os
import psycopg2
from dotenv import load_dotenv

load_dotenv('.env.local')

conn = psycopg2.connect(os.getenv('FANTASY_DATABASE_URL'))
cur = conn.cursor()

print("\n" + "="*80)
print("ADDING MISSING COLUMNS TO fantasy_player_points")
print("="*80)

# Add result column (win/draw/loss)
print("\n1. Adding 'result' column...")
try:
    cur.execute("""
        ALTER TABLE fantasy_player_points 
        ADD COLUMN IF NOT EXISTS result VARCHAR(10)
    """)
    print("✓ Added 'result' column")
except Exception as e:
    print(f"✗ Error: {e}")

# Add is_motm column (boolean, separate from motm for clarity)
print("\n2. Adding 'is_motm' column...")
try:
    cur.execute("""
        ALTER TABLE fantasy_player_points 
        ADD COLUMN IF NOT EXISTS is_motm BOOLEAN DEFAULT false
    """)
    print("✓ Added 'is_motm' column")
except Exception as e:
    print(f"✗ Error: {e}")

# Add fine_goals column
print("\n3. Adding 'fine_goals' column...")
try:
    cur.execute("""
        ALTER TABLE fantasy_player_points 
        ADD COLUMN IF NOT EXISTS fine_goals INTEGER DEFAULT 0
    """)
    print("✓ Added 'fine_goals' column")
except Exception as e:
    print(f"✗ Error: {e}")

# Add substitution_penalty column
print("\n4. Adding 'substitution_penalty' column...")
try:
    cur.execute("""
        ALTER TABLE fantasy_player_points 
        ADD COLUMN IF NOT EXISTS substitution_penalty INTEGER DEFAULT 0
    """)
    print("✓ Added 'substitution_penalty' column")
except Exception as e:
    print(f"✗ Error: {e}")

# Add is_clean_sheet column (boolean)
print("\n5. Adding 'is_clean_sheet' column...")
try:
    cur.execute("""
        ALTER TABLE fantasy_player_points 
        ADD COLUMN IF NOT EXISTS is_clean_sheet BOOLEAN DEFAULT false
    """)
    print("✓ Added 'is_clean_sheet' column")
except Exception as e:
    print(f"✗ Error: {e}")

# Add points_breakdown column (jsonb for detailed breakdown)
print("\n6. Adding 'points_breakdown' column...")
try:
    cur.execute("""
        ALTER TABLE fantasy_player_points 
        ADD COLUMN IF NOT EXISTS points_breakdown JSONB
    """)
    print("✓ Added 'points_breakdown' column")
except Exception as e:
    print(f"✗ Error: {e}")

# Add calculated_at column if it doesn't exist
print("\n7. Adding 'calculated_at' column...")
try:
    cur.execute("""
        ALTER TABLE fantasy_player_points 
        ADD COLUMN IF NOT EXISTS calculated_at TIMESTAMP DEFAULT NOW()
    """)
    print("✓ Added 'calculated_at' column")
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
    WHERE table_name = 'fantasy_player_points' 
    ORDER BY ordinal_position
""")

cols = cur.fetchall()
print("\nUpdated fantasy_player_points columns:")
for c in cols:
    print(f"  {c[0]}: {c[1]}")

cur.close()
conn.close()

print("\n✅ Migration complete!")
