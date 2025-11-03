import psycopg2
import os

conn = psycopg2.connect(os.environ.get('DATABASE_URL') or os.environ.get('NEON_DATABASE_URL'))
cur = conn.cursor()

# Find the active tiebreaker
print("=== ACTIVE TIEBREAKER ===")
cur.execute("""
    SELECT id, round_id, player_id, status
    FROM tiebreakers
    WHERE status = 'active'
    LIMIT 1
""")
tiebreaker = cur.fetchone()
if tiebreaker:
    tiebreaker_id = tiebreaker[0]
    print(f"Tiebreaker ID: {tiebreaker_id}")
    print(f"Round ID: {tiebreaker[1]}")
    print(f"Player ID: {tiebreaker[2]}")
    print(f"Status: {tiebreaker[3]}")
    
    # Check team_tiebreakers
    print("\n=== TEAM_TIEBREAKERS ===")
    cur.execute("""
        SELECT 
            tt.id,
            tt.tiebreaker_id,
            tt.original_bid_id,
            tt.submitted,
            tt.new_bid_amount
        FROM team_tiebreakers tt
        WHERE tt.tiebreaker_id = %s
    """, (tiebreaker_id,))
    team_tiebreakers = cur.fetchall()
    
    if team_tiebreakers:
        for tt in team_tiebreakers:
            print(f"\nTeam Tiebreaker ID: {tt[0]}")
            print(f"  Original Bid ID: {tt[2]}")
            print(f"  Submitted: {tt[3]}")
            print(f"  New Bid Amount: {tt[4]}")
            
            # Get the team_id from the bid
            cur.execute("""
                SELECT team_id, amount
                FROM bids
                WHERE id = %s
            """, (str(tt[2]),))
            bid = cur.fetchone()
            if bid:
                print(f"  Team ID (from bid): {bid[0]}")
                print(f"  Original Bid Amount: {bid[1]}")
    else:
        print("No team_tiebreakers found")
else:
    print("No active tiebreaker found")

cur.close()
conn.close()
