#!/usr/bin/env python3
"""Analyze fantasy_players and fantasy_squad tables"""

import os
import psycopg2
from dotenv import load_dotenv

load_dotenv('.env.local')

conn = psycopg2.connect(os.getenv('FANTASY_DATABASE_URL'))
cur = conn.cursor()

print("\n" + "="*80)
print("FANTASY PLAYERS VS FANTASY SQUAD ANALYSIS")
print("="*80)

# Check fantasy_players table
print("\n1. FANTASY_PLAYERS TABLE:")
print("-" * 80)

try:
    cur.execute("""
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'fantasy_players' 
        ORDER BY ordinal_position
    """)
    cols = cur.fetchall()
    
    if cols:
        print("\nColumns:")
        for c in cols:
            print(f"  {c[0]}: {c[1]}")
        
        cur.execute("SELECT COUNT(*) FROM fantasy_players")
        count = cur.fetchone()[0]
        print(f"\nTotal records: {count}")
        
        if count > 0:
            cur.execute("SELECT * FROM fantasy_players LIMIT 5")
            sample = cur.fetchall()
            print(f"\nSample data (first 5):")
            for row in sample:
                print(f"  {row}")
    else:
        print("  ✗ Table does not exist")
except Exception as e:
    print(f"  ✗ Error: {e}")

# Check fantasy_squad table
print("\n2. FANTASY_SQUAD TABLE:")
print("-" * 80)

cur.execute("""
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'fantasy_squad' 
    ORDER BY ordinal_position
""")
cols = cur.fetchall()

print("\nColumns:")
for c in cols:
    print(f"  {c[0]}: {c[1]}")

cur.execute("SELECT COUNT(*) FROM fantasy_squad WHERE league_id = 'SSPSLFLS16'")
count = cur.fetchone()[0]
print(f"\nTotal drafted players in league SSPSLFLS16: {count}")

if count > 0:
    cur.execute("""
        SELECT team_id, real_player_id, player_name, position, purchase_price 
        FROM fantasy_squad 
        WHERE league_id = 'SSPSLFLS16' 
        LIMIT 10
    """)
    sample = cur.fetchall()
    print(f"\nSample drafted players:")
    print(f"{'Team ID':<15} {'Player ID':<20} {'Player Name':<20} {'Position':<10} {'Price'}")
    print("-" * 90)
    for row in sample:
        print(f"{row[0]:<15} {row[1]:<20} {row[2]:<20} {row[3] or 'N/A':<10} {row[4] or 0}")

# Check how fantasy_players is used in the codebase
print("\n3. USAGE COMPARISON:")
print("-" * 80)

print("\nfantasy_squad:")
print("  Purpose: Stores which players are drafted by each fantasy team")
print("  Key columns: team_id, real_player_id, player_name, position, salary")
print("  Usage: Links fantasy teams to real players in their squad")

print("\nfantasy_players:")
cur.execute("""
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'fantasy_players'
""")
fp_cols = cur.fetchall()

if fp_cols:
    print("  Purpose: Should store player-level stats/info for fantasy league")
    print("  Columns:", [c[0] for c in fp_cols])
else:
    print("  Status: Table does not exist or is empty")

cur.close()
conn.close()

print("\n" + "="*80)
print("✅ Analysis complete")
print("="*80)
