import psycopg2
import os

conn = psycopg2.connect(os.environ.get('DATABASE_URL') or os.environ.get('NEON_DATABASE_URL'))
cur = conn.cursor()

print("=== BIDS TABLE SCHEMA ===")
cur.execute("""
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'bids' 
    ORDER BY ordinal_position
""")
columns = cur.fetchall()
for row in columns:
    print(f"{row[0]}: {row[1]}")

print("\n=== SAMPLE BID DATA ===")
cur.execute("""
    SELECT id, team_id, player_id, amount, created_at
    FROM bids
    ORDER BY created_at DESC
    LIMIT 3
""")
samples = cur.fetchall()
for row in samples:
    print(f"\nBid ID: {row[0]}")
    print(f"  Team ID: {row[1]}")
    print(f"  Player ID: {row[2]}")
    print(f"  Amount: {row[3]}")
    print(f"  Created: {row[4]}")

cur.close()
conn.close()
