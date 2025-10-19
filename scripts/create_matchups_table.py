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
    
    # Create matchups table
    print("📋 Creating matchups table...")
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS matchups (
          id SERIAL PRIMARY KEY,
          fixture_id TEXT NOT NULL,
          home_player_id TEXT NOT NULL,
          home_player_name TEXT NOT NULL,
          away_player_id TEXT NOT NULL,
          away_player_name TEXT NOT NULL,
          position INTEGER NOT NULL,
          created_by TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW(),
          
          UNIQUE(fixture_id, position)
        );
    """)
    
    print("✅ Matchups table created!")
    
    # Create indexes
    print("📋 Creating indexes...")
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_matchups_fixture_id ON matchups(fixture_id);
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_matchups_created_by ON matchups(created_by);
    """)
    
    print("✅ Indexes created!")
    
    # Commit changes
    conn.commit()
    
    # Verify table was created
    cursor.execute("""
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'matchups'
        ORDER BY ordinal_position;
    """)
    
    columns = cursor.fetchall()
    print(f"\n📊 Matchups table columns ({len(columns)}):")
    for col in columns:
        print(f"   - {col[0]} ({col[1]}) {'NULL' if col[2] == 'YES' else 'NOT NULL'}")
    
    cursor.close()
    conn.close()
    
    print("\n✅ Matchups table setup completed successfully!")
    
except Exception as e:
    print(f"❌ Error: {e}")
