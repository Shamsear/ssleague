"""
Check footballplayers table structure and data
"""

import os
import psycopg2
from dotenv import load_dotenv

# Load environment variables
load_dotenv('.env.local')

DATABASE_URL = os.getenv('DATABASE_URL') or os.getenv('NEON_DATABASE_URL')

def check_table():
    """Check footballplayers table"""
    
    conn = None
    try:
        print('🔍 Connecting to database...\n')
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        
        # Get table columns
        print('📊 Checking footballplayers table columns...\n')
        cur.execute("""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'footballplayers'
            ORDER BY ordinal_position
        """)
        
        columns = cur.fetchall()
        print(f'Found {len(columns)} columns:')
        for col_name, data_type, nullable in columns:
            print(f'  - {col_name}: {data_type} {"NULL" if nullable == "YES" else "NOT NULL"}')
        
        # Get sample data for player 110599
        print('\n\n📊 Sample data for player_id=110599:\n')
        cur.execute("""
            SELECT *
            FROM footballplayers
            WHERE player_id = %s
        """, ('110599',))
        
        result = cur.fetchone()
        if result:
            colnames = [desc[0] for desc in cur.description]
            for i, col in enumerate(colnames):
                print(f'  {col}: {result[i]}')
        else:
            print('Player not found')
        
        cur.close()
        
    except Exception as error:
        print(f'❌ Error: {error}')
        raise error
    finally:
        if conn:
            conn.close()

if __name__ == '__main__':
    try:
        check_table()
        print('\n✅ Check completed')
    except Exception as error:
        print(f'\n❌ Check failed: {error}')
        exit(1)
