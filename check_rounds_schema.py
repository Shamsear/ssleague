import psycopg2
import os

conn = psycopg2.connect(os.environ.get('DATABASE_URL') or os.environ.get('NEON_DATABASE_URL'))
cur = conn.cursor()

print("=== ROUNDS TABLE SCHEMA ===")
cur.execute("""
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'rounds' 
    ORDER BY ordinal_position
""")
columns = cur.fetchall()
for row in columns:
    print(f"{row[0]}: {row[1]}")

print("\n=== SAMPLE ROUND DATA ===")
cur.execute("""
    SELECT id, position, status, round_number, season_id, created_at
    FROM rounds
    ORDER BY created_at DESC
    LIMIT 3
""")
samples = cur.fetchall()
for row in samples:
    print(f"\nRound ID: {row[0]}")
    print(f"  Position: {row[1]}")
    print(f"  Status: {row[2]}")
    print(f"  Round Number: {row[3]}")
    print(f"  Season ID: {row[4]}")

cur.close()
conn.close()
