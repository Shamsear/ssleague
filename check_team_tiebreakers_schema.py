import psycopg2
import os

conn = psycopg2.connect(os.environ.get('DATABASE_URL') or os.environ.get('NEON_DATABASE_URL'))
cur = conn.cursor()

print("=== TEAM_TIEBREAKERS TABLE SCHEMA ===")
cur.execute("""
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'team_tiebreakers' 
    ORDER BY ordinal_position
""")
columns = cur.fetchall()
for row in columns:
    print(f"{row[0]}: {row[1]}")

cur.close()
conn.close()
