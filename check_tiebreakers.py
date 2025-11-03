import psycopg2
import os

conn = psycopg2.connect(os.environ.get('DATABASE_URL') or os.environ.get('NEON_DATABASE_URL'))
cur = conn.cursor()

# Check tiebreakers table schema
print("=== TIEBREAKERS TABLE SCHEMA ===")
cur.execute("""
    SELECT column_name, data_type, character_maximum_length 
    FROM information_schema.columns 
    WHERE table_name = 'tiebreakers' 
    ORDER BY ordinal_position
""")
columns = cur.fetchall()
if columns:
    for row in columns:
        print(f"{row[0]}: {row[1]}")
else:
    print("Table 'tiebreakers' not found")

# Check for status constraint
print("\n=== STATUS CONSTRAINT ===")
cur.execute("""
    SELECT constraint_name, check_clause
    FROM information_schema.check_constraints
    WHERE constraint_name LIKE '%tiebreakers%status%'
""")
constraints = cur.fetchall()
if constraints:
    for row in constraints:
        print(f"{row[0]}: {row[1]}")
else:
    print("No status constraint found")

# Check actual status values in use
print("\n=== ACTUAL STATUS VALUES IN USE ===")
cur.execute("SELECT DISTINCT status FROM tiebreakers ORDER BY status")
statuses = cur.fetchall()
if statuses:
    for row in statuses:
        print(f"- {row[0]}")
else:
    print("No tiebreakers found in database")

# Count tiebreakers by status
print("\n=== TIEBREAKERS COUNT BY STATUS ===")
cur.execute("SELECT status, COUNT(*) FROM tiebreakers GROUP BY status ORDER BY status")
counts = cur.fetchall()
if counts:
    for row in counts:
        print(f"{row[0]}: {row[1]}")
else:
    print("No tiebreakers found")

cur.close()
conn.close()
