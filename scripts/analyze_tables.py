import os
import psycopg2
from dotenv import load_dotenv
from pathlib import Path

env_path = Path(__file__).parent.parent / '.env.local'
load_dotenv(env_path)

DATABASE_URL = os.getenv('NEON_AUCTION_DB_URL')

conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

print("📊 Analyzing auction database tables:\n")
print("=" * 80)

# Get all tables
cur.execute("""
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name
""")

tables = [row[0] for row in cur.fetchall()]

for table in tables:
    print(f"\n📋 Table: {table}")
    
    # Get row count
    cur.execute(f"SELECT COUNT(*) FROM {table}")
    row_count = cur.fetchone()[0]
    print(f"   Rows: {row_count}")
    
    # Get column info
    cur.execute(f"""
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = '{table}'
        ORDER BY ordinal_position
    """)
    columns = cur.fetchall()
    print(f"   Columns ({len(columns)}):")
    for col in columns[:5]:  # Show first 5 columns
        print(f"      - {col[0]}: {col[1]}")
    if len(columns) > 5:
        print(f"      ... and {len(columns) - 5} more")
    
    # Check for foreign key references
    cur.execute(f"""
        SELECT
            tc.constraint_name,
            kcu.column_name,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_name = '{table}'
    """)
    fks = cur.fetchall()
    if fks:
        print(f"   Foreign Keys:")
        for fk in fks:
            print(f"      - {fk[1]} -> {fk[2]}.{fk[3]}")
    
    print("   " + "-" * 76)

print("\n" + "=" * 80)
print("\n💡 Tables Analysis Summary:")
print("\n   Empty tables (candidates for removal):")
empty_tables = []
for table in tables:
    cur.execute(f"SELECT COUNT(*) FROM {table}")
    if cur.fetchone()[0] == 0:
        empty_tables.append(table)
        print(f"      - {table}")

if not empty_tables:
    print("      (none)")

cur.close()
conn.close()
