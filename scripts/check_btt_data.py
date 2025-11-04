import os, psycopg2
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent.parent / '.env.local')
conn = psycopg2.connect(os.getenv('NEON_AUCTION_DB_URL'))
cur = conn.cursor()

tiebreaker_id = 'SSPSLTR00001'

print(f"📊 Data in bulk_tiebreaker_teams for {tiebreaker_id}:\n")

cur.execute(f"""
    SELECT tiebreaker_id, team_id, team_name, status, current_bid, joined_at
    FROM bulk_tiebreaker_teams
    WHERE tiebreaker_id = '{tiebreaker_id}'
""")

rows = cur.fetchall()
if rows:
    for row in rows:
        print(f"  Team ID: {row[1]}")
        print(f"  Team Name: {row[2]}")
        print(f"  Status: {row[3]}")
        print(f"  Current Bid: {row[4]}")
        print(f"  Joined At: {row[5]}")
        print()
else:
    print("  ❌ No teams found!")

print(f"\n📊 Data in bulk_tiebreakers:\n")
cur.execute(f"""
    SELECT id, player_name, original_amount, status, season_id
    FROM bulk_tiebreakers
    WHERE id = '{tiebreaker_id}'
""")

tb = cur.fetchone()
if tb:
    print(f"  ID: {tb[0]}")
    print(f"  Player: {tb[1]}")
    print(f"  Original Amount: {tb[2]}")
    print(f"  Status: {tb[3]}")
    print(f"  Season ID: {tb[4]}")
else:
    print("  ❌ Tiebreaker not found!")

cur.close()
conn.close()
