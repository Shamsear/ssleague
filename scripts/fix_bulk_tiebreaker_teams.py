import os, psycopg2
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent.parent / '.env.local')
conn = psycopg2.connect(os.getenv('NEON_AUCTION_DB_URL'))
cur = conn.cursor()

print("🔧 Adding missing columns to bulk_tiebreaker_teams table\n")

try:
    # Add status column
    print("Adding 'status' column...")
    cur.execute("""
        ALTER TABLE bulk_tiebreaker_teams 
        ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active'
    """)
    print("   ✅ status column added")
    
    # Add current_bid column
    print("Adding 'current_bid' column...")
    cur.execute("""
        ALTER TABLE bulk_tiebreaker_teams 
        ADD COLUMN IF NOT EXISTS current_bid INTEGER
    """)
    print("   ✅ current_bid column added")
    
    # Add joined_at column
    print("Adding 'joined_at' column...")
    cur.execute("""
        ALTER TABLE bulk_tiebreaker_teams 
        ADD COLUMN IF NOT EXISTS joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    """)
    print("   ✅ joined_at column added")
    
    # Add withdrawn_at column
    print("Adding 'withdrawn_at' column...")
    cur.execute("""
        ALTER TABLE bulk_tiebreaker_teams 
        ADD COLUMN IF NOT EXISTS withdrawn_at TIMESTAMP WITH TIME ZONE
    """)
    print("   ✅ withdrawn_at column added")
    
    # Add index on tiebreaker_id, team_id for faster lookups
    print("Creating unique index...")
    cur.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS idx_bulk_tiebreaker_teams_unique
        ON bulk_tiebreaker_teams(tiebreaker_id, team_id)
    """)
    print("   ✅ Unique index created")
    
    conn.commit()
    
    print("\n🎉 bulk_tiebreaker_teams table updated successfully!")
    
    # Show final schema
    cur.execute("""
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'bulk_tiebreaker_teams' 
        ORDER BY ordinal_position
    """)
    print("\nFinal schema:")
    for row in cur.fetchall():
        print(f"   {row[0]}: {row[1]} (nullable: {row[2]})")
    
except Exception as e:
    print(f"\n❌ Error: {e}")
    conn.rollback()
finally:
    cur.close()
    conn.close()
