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
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()
    
    print("✅ Connected to Neon database successfully!\n")
    print("Adding max_bids_per_team column to rounds table...")
    
    # Add the missing column
    cursor.execute("""
        ALTER TABLE rounds 
        ADD COLUMN IF NOT EXISTS max_bids_per_team INTEGER DEFAULT 5;
    """)
    
    conn.commit()
    
    print("✅ Column added successfully!\n")
    
    # Verify the column exists
    cursor.execute("""
        SELECT column_name, data_type, column_default
        FROM information_schema.columns
        WHERE table_name = 'rounds' AND column_name = 'max_bids_per_team';
    """)
    
    result = cursor.fetchone()
    if result:
        col_name, data_type, default = result
        print(f"✅ Verified: {col_name} ({data_type}) DEFAULT {default}\n")
    else:
        print("❌ Column not found after addition\n")
    
    cursor.close()
    conn.close()
    
    print("✅ Fix completed!")
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
