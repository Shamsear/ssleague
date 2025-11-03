import psycopg2
import os
import json

conn = psycopg2.connect(os.environ.get('DATABASE_URL') or os.environ.get('NEON_DATABASE_URL'))
cur = conn.cursor()

# Check tiebreakers with round info
print("=== TIEBREAKERS WITH ROUND INFO ===")
cur.execute("""
    SELECT 
        t.id,
        t.round_id,
        t.player_id,
        t.status as tiebreaker_status,
        t.original_amount,
        r.position as round_position,
        r.status as round_status,
        r.season_id
    FROM tiebreakers t
    LEFT JOIN rounds r ON t.round_id = r.id
    ORDER BY t.created_at DESC
    LIMIT 10
""")
tiebreakers = cur.fetchall()
if tiebreakers:
    for row in tiebreakers:
        print(f"\nTiebreaker ID: {row[0]}")
        print(f"  Round ID: {row[1]}")
        print(f"  Player ID: {row[2]}")
        print(f"  Tiebreaker Status: {row[3]}")
        print(f"  Original Amount: {row[4]}")
        print(f"  Round Position: {row[5]}")
        print(f"  Round Status: {row[6]}")
        print(f"  Season ID: {row[7]}")
else:
    print("No tiebreakers found")

# Check team_tiebreakers
print("\n\n=== TEAM TIEBREAKERS ===")
cur.execute("""
    SELECT 
        tt.id,
        tt.tiebreaker_id,
        tt.submitted,
        tt.new_bid_amount,
        b.team_id
    FROM team_tiebreakers tt
    LEFT JOIN bids b ON tt.original_bid_id::uuid = b.id
    LIMIT 10
""")
team_tiebreakers = cur.fetchall()
if team_tiebreakers:
    for row in team_tiebreakers:
        print(f"\nTeam Tiebreaker ID: {row[0]}")
        print(f"  Tiebreaker ID: {row[1]}")
        print(f"  Submitted: {row[2]}")
        print(f"  New Bid Amount: {row[3]}")
        print(f"  Team ID: {row[4]}")
else:
    print("No team_tiebreakers found")

# Check active rounds
print("\n\n=== ACTIVE ROUNDS ===")
cur.execute("""
    SELECT 
        id,
        position,
        status,
        season_id,
        created_at
    FROM rounds
    WHERE status = 'active'
    ORDER BY created_at DESC
    LIMIT 5
""")
rounds = cur.fetchall()
if rounds:
    for row in rounds:
        print(f"\nRound ID: {row[0]}")
        print(f"  Position: {row[1]}")
        print(f"  Status: {row[2]}")
        print(f"  Season ID: {row[3]}")
        print(f"  Created At: {row[4]}")
else:
    print("No active rounds found")

cur.close()
conn.close()
