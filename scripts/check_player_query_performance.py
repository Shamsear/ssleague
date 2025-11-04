"""
Check player query performance and indexes
"""

import os
import psycopg2
import time
from dotenv import load_dotenv

# Load environment variables
load_dotenv('.env.local')

DATABASE_URL = os.getenv('DATABASE_URL') or os.getenv('NEON_DATABASE_URL')

def check_player_query():
    """Check player query performance"""
    
    conn = None
    try:
        print('🔍 Connecting to database...\n')
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        
        # Check indexes on footballplayers table
        print('📊 Checking indexes on footballplayers table...\n')
        cur.execute("""
            SELECT 
                indexname, 
                indexdef 
            FROM pg_indexes 
            WHERE tablename = 'footballplayers'
        """)
        
        indexes = cur.fetchall()
        print(f'Found {len(indexes)} indexes:')
        for idx_name, idx_def in indexes:
            print(f'  - {idx_name}')
            print(f'    {idx_def}\n')
        
        # Test query with player_id
        test_player_id = '110599'
        
        print(f'\n🔍 Testing query for player_id={test_player_id}...\n')
        
        # Explain analyze the query
        start_time = time.time()
        cur.execute("""
            EXPLAIN ANALYZE
            SELECT * FROM footballplayers WHERE id = %s
        """, (test_player_id,))
        
        explain_result = cur.fetchall()
        query_time_1 = time.time() - start_time
        
        print('Query plan for ID lookup:')
        for row in explain_result:
            print(f'  {row[0]}')
        print(f'\nQuery execution time: {query_time_1:.4f}s\n')
        
        # Try with player_id column
        print(f'\n🔍 Testing query with player_id column...\n')
        
        start_time = time.time()
        cur.execute("""
            EXPLAIN ANALYZE
            SELECT * FROM footballplayers WHERE player_id = %s
        """, (test_player_id,))
        
        explain_result = cur.fetchall()
        query_time_2 = time.time() - start_time
        
        print('Query plan for player_id lookup:')
        for row in explain_result:
            print(f'  {row[0]}')
        print(f'\nQuery execution time: {query_time_2:.4f}s\n')
        
        # Check table size
        print('\n📊 Table statistics:\n')
        cur.execute("""
            SELECT 
                COUNT(*) as total_rows,
                pg_size_pretty(pg_total_relation_size('footballplayers')) as total_size,
                pg_size_pretty(pg_relation_size('footballplayers')) as table_size,
                pg_size_pretty(pg_indexes_size('footballplayers')) as indexes_size
            FROM footballplayers
        """)
        
        stats = cur.fetchone()
        print(f'  Total rows: {stats[0]}')
        print(f'  Total size: {stats[1]}')
        print(f'  Table size: {stats[2]}')
        print(f'  Indexes size: {stats[3]}')
        
        cur.close()
        
    except Exception as error:
        print(f'❌ Error: {error}')
        raise error
    finally:
        if conn:
            conn.close()

if __name__ == '__main__':
    try:
        check_player_query()
        print('\n✅ Check completed successfully')
    except Exception as error:
        print(f'\n❌ Check failed: {error}')
        exit(1)
