import os
import psycopg2
from dotenv import load_dotenv
from pathlib import Path

env_path = Path(__file__).parent.parent / '.env.local'
load_dotenv(env_path)

DATABASE_URL = os.getenv('NEON_AUCTION_DB_URL')

conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

print("📊 Comparing tiebreaker table structures:\n")
print("=" * 80)

# Get tiebreakers table structure
print("\n🔹 TIEBREAKERS table (used in code):")
cur.execute("""
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'tiebreakers'
    ORDER BY ordinal_position
""")
tiebreakers_cols = cur.fetchall()
for col in tiebreakers_cols:
    print(f"   {col[0]}: {col[1]} (nullable: {col[2]})")

cur.execute("SELECT COUNT(*) FROM tiebreakers")
print(f"\n   Rows: {cur.fetchone()[0]}")

# Get bulk_tiebreakers table structure
print("\n🔹 BULK_TIEBREAKERS table (empty):")
cur.execute("""
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'bulk_tiebreakers'
    ORDER BY ordinal_position
""")
bulk_tiebreakers_cols = cur.fetchall()
for col in bulk_tiebreakers_cols:
    print(f"   {col[0]}: {col[1]} (nullable: {col[2]})")

cur.execute("SELECT COUNT(*) FROM bulk_tiebreakers")
print(f"\n   Rows: {cur.fetchone()[0]}")

print("\n" + "=" * 80)
print("\n💡 Analysis:")
print("\n   The 'bulk_tiebreakers' table has DIFFERENT columns than 'tiebreakers'")
print("   They are designed for DIFFERENT purposes:")
print("   - tiebreakers: Regular auction tiebreaker system (used in code)")
print("   - bulk_tiebreakers: Intended for bulk round tiebreakers (not used)")
print("\n   The routes in /api/.../bulk-tiebreakers/ are MISLEADING")
print("   They actually query the 'tiebreakers' table, not 'bulk_tiebreakers'!")

cur.close()
conn.close()
