"""
Check database schema for match, player, and salary/points tracking
"""

import os
import psycopg2
from dotenv import load_dotenv

load_dotenv('.env.local')

DATABASE_URL = os.getenv('DATABASE_URL') or os.getenv('NEON_DATABASE_URL')

def check_schema():
    """Check relevant tables"""
    
    conn = None
    try:
        print('🔍 Connecting to database...\n')
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        
        # Get all tables
        print('📊 Checking all tables...\n')
        cur.execute("""
            SELECT tablename 
            FROM pg_tables 
            WHERE schemaname = 'public'
            ORDER BY tablename
        """)
        
        tables = [row[0] for row in cur.fetchall()]
        print(f'Found {len(tables)} tables')
        
        # Filter relevant tables
        relevant_keywords = ['match', 'fixture', 'player', 'season', 'stat', 'lineup', 'salary', 'wage', 'payment', 'transaction', 'performance']
        relevant_tables = [t for t in tables if any(kw in t.lower() for kw in relevant_keywords)]
        
        print(f'\nRelevant tables for salary/match tracking ({len(relevant_tables)}):')
        for table in relevant_tables:
            print(f'  - {table}')
        
        # Check specific tables in detail
        tables_to_check = ['fixtures', 'lineups', 'realplayerstats', 'player_seasons', 'team_players', 'footballplayers']
        
        for table_name in tables_to_check:
            if table_name in tables:
                print(f'\n\n📋 Table: {table_name}')
                print('=' * 60)
                
                cur.execute("""
                    SELECT column_name, data_type, is_nullable
                    FROM information_schema.columns
                    WHERE table_name = %s
                    ORDER BY ordinal_position
                """, (table_name,))
                
                columns = cur.fetchall()
                for col_name, data_type, nullable in columns:
                    print(f'  {col_name}: {data_type} {"NULL" if nullable == "YES" else "NOT NULL"}')
                
                # Get row count
                cur.execute(f'SELECT COUNT(*) FROM {table_name}')
                count = cur.fetchone()[0]
                print(f'\n  Total rows: {count}')
        
        cur.close()
        
    except Exception as error:
        print(f'❌ Error: {error}')
        raise error
    finally:
        if conn:
            conn.close()

if __name__ == '__main__':
    try:
        check_schema()
        print('\n✅ Schema check completed')
    except Exception as error:
        print(f'\n❌ Check failed: {error}')
        exit(1)
