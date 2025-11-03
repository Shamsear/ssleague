#!/usr/bin/env python3
import os
import psycopg2
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
env_file = Path(__file__).parent.parent / '.env.local'
if env_file.exists():
    load_dotenv(env_file)

database_url = os.getenv('NEON_DATABASE_URL')

if not database_url:
    print("❌ NEON_DATABASE_URL not set")
    exit(1)

try:
    conn = psycopg2.connect(database_url)
    cursor = conn.cursor()
    
    # Get bids table columns
    cursor.execute("""
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'bids'
        ORDER BY ordinal_position;
    """)
    
    columns = cursor.fetchall()
    
    print("=" * 80)
    print("BIDS TABLE COLUMNS")
    print("=" * 80)
    
    has_encrypted = False
    for col_name, col_type, nullable, default in columns:
        print(f"  • {col_name:<25} {col_type:<20} {'NULL' if nullable == 'YES' else 'NOT NULL':<10} {default or ''}")
        if col_name == 'encrypted_bid_data':
            has_encrypted = True
    
    print("\n" + "=" * 80)
    
    if has_encrypted:
        print("✅ Column 'encrypted_bid_data' EXISTS")
    else:
        print("❌ Column 'encrypted_bid_data' MISSING")
        print("\n🔧 Need to add encrypted_bid_data column to bids table")
    
    cursor.close()
    conn.close()
    
except Exception as e:
    print(f"❌ Error: {e}")
    exit(1)
