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
    
    # Get all tables
    cursor.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name;
    """)
    
    tables = cursor.fetchall()
    
    print(f"📊 Found {len(tables)} tables:\n")
    
    for table in tables:
        table_name = table[0]
        print(f"📋 Table: {table_name}")
        
        # Get column information
        cursor.execute(f"""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = '{table_name}'
            ORDER BY ordinal_position;
        """)
        
        columns = cursor.fetchall()
        print(f"   Columns ({len(columns)}):")
        for col in columns[:10]:  # Show first 10 columns
            print(f"   - {col[0]} ({col[1]}) {'NULL' if col[2] == 'YES' else 'NOT NULL'}")
        
        if len(columns) > 10:
            print(f"   ... and {len(columns) - 10} more columns")
        
        # Get row count
        cursor.execute(f"SELECT COUNT(*) FROM {table_name};")
        count = cursor.fetchone()[0]
        print(f"   Rows: {count}\n")
    
    cursor.close()
    conn.close()
    
    print("✅ Database check completed!")
    
except Exception as e:
    print(f"❌ Error: {e}")
