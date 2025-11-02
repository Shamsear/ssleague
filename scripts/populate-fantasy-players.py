#!/usr/bin/env python3
"""Populate fantasy_players table from existing fantasy_squad data"""

import os
import psycopg2
from dotenv import load_dotenv

load_dotenv('.env.local')

conn = psycopg2.connect(os.getenv('FANTASY_DATABASE_URL'))
cur = conn.cursor()

print("\n" + "="*80)
print("POPULATING fantasy_players FROM fantasy_squad")
print("="*80)

# Get all drafted players from fantasy_squad
cur.execute("""
    SELECT 
        league_id,
        real_player_id,
        COUNT(*) as times_drafted,
        MIN(purchase_price) as draft_price
    FROM fantasy_squad
    GROUP BY league_id, real_player_id
    ORDER BY league_id, real_player_id
""")

drafted_players = cur.fetchall()
print(f"\nFound {len(drafted_players)} unique players across all leagues")

inserted = 0
updated = 0
skipped = 0

for player in drafted_players:
    league_id, real_player_id, times_drafted, draft_price = player
    
    # Check if already exists
    cur.execute("""
        SELECT id, times_drafted, total_points 
        FROM fantasy_players 
        WHERE league_id = %s AND real_player_id = %s
    """, (league_id, real_player_id))
    
    existing = cur.fetchone()
    
    if existing:
        # Update existing record
        cur.execute("""
            UPDATE fantasy_players
            SET 
                times_drafted = %s,
                is_available = false,
                updated_at = NOW()
            WHERE league_id = %s AND real_player_id = %s
        """, (times_drafted, league_id, real_player_id))
        updated += 1
        print(f"  ✓ Updated: {real_player_id} in league {league_id} (drafted {times_drafted} times)")
    else:
        # Insert new record
        try:
            cur.execute("""
                INSERT INTO fantasy_players (
                    league_id, 
                    real_player_id, 
                    draft_price,
                    times_drafted, 
                    total_points, 
                    is_available
                ) VALUES (
                    %s, %s, %s, %s, 0, false
                )
            """, (league_id, real_player_id, draft_price, times_drafted))
            inserted += 1
            print(f"  ✓ Inserted: {real_player_id} in league {league_id} (drafted {times_drafted} times, price: {draft_price})")
        except Exception as e:
            print(f"  ✗ Failed to insert {real_player_id}: {e}")
            skipped += 1

conn.commit()

print("\n" + "="*80)
print("SUMMARY")
print("="*80)
print(f"  Inserted: {inserted} new records")
print(f"  Updated:  {updated} existing records")
print(f"  Skipped:  {skipped} errors")
print(f"  Total:    {len(drafted_players)} players processed")

# Verify
print("\n" + "="*80)
print("VERIFICATION")
print("="*80)

cur.execute("""
    SELECT 
        league_id,
        COUNT(*) as player_count,
        SUM(times_drafted) as total_drafts,
        COUNT(CASE WHEN is_available = false THEN 1 END) as unavailable_count
    FROM fantasy_players
    GROUP BY league_id
""")

verification = cur.fetchall()
print("\nfantasy_players by league:")
print(f"{'League ID':<20} {'Players':<10} {'Total Drafts':<15} {'Unavailable'}")
print("-" * 70)
for row in verification:
    print(f"{row[0]:<20} {row[1]:<10} {row[2]:<15} {row[3]}")

cur.close()
conn.close()

print("\n✅ Population complete!")
print("\nNext steps:")
print("  1. Players currently in fantasy_squad are now in fantasy_players")
print("  2. times_drafted reflects how many teams own each player")
print("  3. is_available is set to false for drafted players")
print("  4. total_points will be updated as matches are played")
