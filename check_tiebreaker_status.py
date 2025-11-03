import psycopg2
import os

conn = psycopg2.connect(os.environ.get('DATABASE_URL') or os.environ.get('NEON_DATABASE_URL'))
cur = conn.cursor()

print("=== TIEBREAKER STATUS ===")
cur.execute("""
    SELECT 
        t.id,
        t.status,
        t.player_id,
        t.winning_team_id,
        t.winning_bid,
        t.round_id,
        r.status as round_status,
        r.position as round_position
    FROM tiebreakers t
    LEFT JOIN rounds r ON t.round_id = r.id
    WHERE t.id = 18
""")
tb = cur.fetchone()

if tb:
    print(f"\nTiebreaker ID: {tb[0]}")
    print(f"Status: {tb[1]}")
    print(f"Player ID: {tb[2]}")
    print(f"Winning Team: {tb[3]}")
    print(f"Winning Bid: {tb[4]}")
    print(f"Round ID: {tb[5]}")
    print(f"Round Status: {tb[6]}")
    print(f"Round Position: {tb[7]}")
else:
    print("Tiebreaker not found")

print("\n=== TEAM TIEBREAKER SUBMISSIONS ===")
cur.execute("""
    SELECT 
        tt.id,
        tt.team_id,
        tt.team_name,
        tt.submitted,
        tt.new_bid_amount
    FROM team_tiebreakers tt
    WHERE tt.tiebreaker_id = 18
""")
submissions = cur.fetchall()

for sub in submissions:
    print(f"\nTeam: {sub[2] or sub[1]}")
    print(f"  Submitted: {sub[3]}")
    print(f"  Bid Amount: {sub[4]}")

print("\n=== ROUND STATUS ===")
if tb:
    cur.execute("""
        SELECT id, position, status, created_at
        FROM rounds
        WHERE id = %s
    """, (str(tb[5]),))
    round_info = cur.fetchone()
    
    if round_info:
        print(f"Round ID: {round_info[0]}")
        print(f"Position: {round_info[1]}")
        print(f"Status: {round_info[2]}")
        print(f"Created: {round_info[3]}")

cur.close()
conn.close()
