import os
import psycopg2
from dotenv import load_dotenv

# Load environment variables
load_dotenv('.env.local')

# Get database URL
DATABASE_URL = os.getenv('NEON_DATABASE_URL')

if not DATABASE_URL:
    print("❌ NEON_DATABASE_URL not found in .env.local")
    exit(1)

try:
    # Connect to database
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()
    
    print("✅ Connected to Neon database successfully!\n")
    
    # Add result columns to matchups table
    print("📋 Adding result columns to matchups table...")
    
    cursor.execute("""
        ALTER TABLE matchups 
        ADD COLUMN IF NOT EXISTS home_goals INTEGER,
        ADD COLUMN IF NOT EXISTS away_goals INTEGER,
        ADD COLUMN IF NOT EXISTS result_entered_by TEXT,
        ADD COLUMN IF NOT EXISTS result_entered_at TIMESTAMP;
    """)
    
    print("✅ Result columns added!")
    
    # Commit changes
    conn.commit()
    
    # Verify columns were added
    cursor.execute("""
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'matchups'
        ORDER BY ordinal_position;
    """)
    
    columns = cursor.fetchall()
    print(f"\n📊 Matchups table columns ({len(columns)}):")
    for col in columns:
        print(f"   - {col[0]} ({col[1]})")
    
    cursor.close()
    conn.close()
    
    print("\n✅ Matchup results columns setup completed successfully!")
    
except Exception as e:
    print(f"❌ Error: {e}")
