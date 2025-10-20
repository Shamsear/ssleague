import psycopg2
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv('.env.local')

# Connect to database
DATABASE_URL = os.getenv('NEON_DATABASE_URL')
conn = psycopg2.connect(DATABASE_URL)
cur = conn.cursor()

print("🔍 Adding MOTM columns to fixtures table...")

try:
    # Add columns
    cur.execute('ALTER TABLE fixtures ADD COLUMN IF NOT EXISTS motm_player_id TEXT')
    cur.execute('ALTER TABLE fixtures ADD COLUMN IF NOT EXISTS motm_player_name TEXT')
    conn.commit()
    print("✅ Columns added successfully!")
    
    # Verify columns exist
    cur.execute("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'fixtures' 
        AND column_name LIKE 'motm%'
    """)
    cols = cur.fetchall()
    print(f"\n✅ MOTM columns in fixtures table: {[col[0] for col in cols]}")
    
    # Also remove man_of_the_match from matchups if it exists
    print("\n🔍 Removing old man_of_the_match column from matchups...")
    cur.execute("""
        ALTER TABLE matchups 
        DROP COLUMN IF EXISTS man_of_the_match
    """)
    conn.commit()
    print("✅ Old column removed!")
    
except Exception as e:
    print(f"❌ Error: {e}")
    conn.rollback()
finally:
    cur.close()
    conn.close()
    print("\n✅ Done!")
