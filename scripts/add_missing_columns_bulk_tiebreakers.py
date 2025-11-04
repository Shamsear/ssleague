import os, psycopg2
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent.parent / '.env.local')
conn = psycopg2.connect(os.getenv('NEON_AUCTION_DB_URL'))
cur = conn.cursor()

print("🔧 Adding missing columns to bulk_tiebreakers\n")

try:
    # Add current_highest_bid
    print("Adding 'current_highest_bid' column...")
    cur.execute("""
        ALTER TABLE bulk_tiebreakers 
        ADD COLUMN IF NOT EXISTS current_highest_bid INTEGER
    """)
    print("   ✅ current_highest_bid added")
    
    # Add current_highest_team_id
    print("Adding 'current_highest_team_id' column...")
    cur.execute("""
        ALTER TABLE bulk_tiebreakers 
        ADD COLUMN IF NOT EXISTS current_highest_team_id VARCHAR(50)
    """)
    print("   ✅ current_highest_team_id added")
    
    # Add max_end_time (24 hour limit)
    print("Adding 'max_end_time' column...")
    cur.execute("""
        ALTER TABLE bulk_tiebreakers 
        ADD COLUMN IF NOT EXISTS max_end_time TIMESTAMP WITH TIME ZONE
    """)
    print("   ✅ max_end_time added")
    
    # Add start_time
    print("Adding 'start_time' column...")
    cur.execute("""
        ALTER TABLE bulk_tiebreakers 
        ADD COLUMN IF NOT EXISTS start_time TIMESTAMP WITH TIME ZONE
    """)
    print("   ✅ start_time added")
    
    # Add last_activity_time
    print("Adding 'last_activity_time' column...")
    cur.execute("""
        ALTER TABLE bulk_tiebreakers 
        ADD COLUMN IF NOT EXISTS last_activity_time TIMESTAMP WITH TIME ZONE
    """)
    print("   ✅ last_activity_time added")
    
    # Add teams_remaining
    print("Adding 'teams_remaining' column...")
    cur.execute("""
        ALTER TABLE bulk_tiebreakers 
        ADD COLUMN IF NOT EXISTS teams_remaining INTEGER
    """)
    print("   ✅ teams_remaining added")
    
    # Add base_price
    print("Adding 'base_price' column...")
    cur.execute("""
        ALTER TABLE bulk_tiebreakers 
        ADD COLUMN IF NOT EXISTS base_price INTEGER
    """)
    print("   ✅ base_price added")
    
    # Add tie_amount (alias for original_amount)
    print("Adding 'tie_amount' column...")
    cur.execute("""
        ALTER TABLE bulk_tiebreakers 
        ADD COLUMN IF NOT EXISTS tie_amount INTEGER
    """)
    print("   ✅ tie_amount added")
    
    # Add tied_team_count
    print("Adding 'tied_team_count' column...")
    cur.execute("""
        ALTER TABLE bulk_tiebreakers 
        ADD COLUMN IF NOT EXISTS tied_team_count INTEGER
    """)
    print("   ✅ tied_team_count added")
    
    # Add player_team
    print("Adding 'player_team' column...")
    cur.execute("""
        ALTER TABLE bulk_tiebreakers 
        ADD COLUMN IF NOT EXISTS player_team VARCHAR(100)
    """)
    print("   ✅ player_team added")
    
    # Add player_position
    print("Adding 'player_position' column...")
    cur.execute("""
        ALTER TABLE bulk_tiebreakers 
        ADD COLUMN IF NOT EXISTS player_position VARCHAR(50)
    """)
    print("   ✅ player_position added")
    
    conn.commit()
    
    print("\n🎉 All columns added successfully!")
    
    # Show final schema
    cur.execute("""
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'bulk_tiebreakers' 
        ORDER BY ordinal_position
    """)
    print("\nFinal schema:")
    for row in cur.fetchall():
        print(f"   {row[0]}: {row[1]}")
    
except Exception as e:
    print(f"\n❌ Error: {e}")
    conn.rollback()
finally:
    cur.close()
    conn.close()
