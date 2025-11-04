"""
Check player data for ID 110599
"""

import os
import psycopg2
from dotenv import load_dotenv

# Load environment variables
load_dotenv('.env.local')

DATABASE_URL = os.getenv('DATABASE_URL') or os.getenv('NEON_DATABASE_URL')

def check_player():
    """Check player 110599"""
    
    conn = None
    try:
        print('🔍 Connecting to database...\n')
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        
        player_id = '110599'
        
        # Check by ID
        print(f'🔍 Checking player with id={player_id}...\n')
        cur.execute("""
            SELECT id, player_id, name, position, team_id, team_name, 
                   is_sold, acquisition_value, season_id
            FROM footballplayers 
            WHERE id = %s
        """, (player_id,))
        
        result = cur.fetchone()
        if result:
            print(f'Found by ID:')
            print(f'  Database ID: {result[0]}')
            print(f'  Player ID: {result[1]}')
            print(f'  Name: {result[2]}')
            print(f'  Position: {result[3]}')
            print(f'  Team ID: {result[4]}')
            print(f'  Team Name: {result[5]}')
            print(f'  Is Sold: {result[6]}')
            print(f'  Acquisition Value: {result[7]}')
            print(f'  Season ID: {result[8]}')
        else:
            print('Not found by ID')
        
        # Check by player_id
        print(f'\n🔍 Checking player with player_id={player_id}...\n')
        cur.execute("""
            SELECT id, player_id, name, position, team_id, team_name, 
                   is_sold, acquisition_value, season_id
            FROM footballplayers 
            WHERE player_id = %s
        """, (player_id,))
        
        result = cur.fetchone()
        if result:
            print(f'Found by player_id:')
            print(f'  Database ID: {result[0]}')
            print(f'  Player ID: {result[1]}')
            print(f'  Name: {result[2]}')
            print(f'  Position: {result[3]}')
            print(f'  Team ID: {result[4]}')
            print(f'  Team Name: {result[5]}')
            print(f'  Is Sold: {result[6]}')
            print(f'  Acquisition Value: {result[7]}')
            print(f'  Season ID: {result[8]}')
        else:
            print('Not found by player_id')
        
        # Check team_players table
        print(f'\n🔍 Checking team_players table...\n')
        cur.execute("""
            SELECT tp.id, tp.team_id, tp.player_id, tp.purchase_price, tp.acquired_at,
                   t.name as team_name
            FROM team_players tp
            LEFT JOIN teams t ON tp.team_id = t.id
            WHERE tp.player_id = %s
        """, (player_id,))
        
        results = cur.fetchall()
        if results:
            print(f'Found {len(results)} record(s) in team_players:')
            for r in results:
                print(f'  Team: {r[5]} ({r[1]})')
                print(f'  Purchase Price: £{r[3]}')
                print(f'  Acquired At: {r[4]}')
                print()
        else:
            print('Not found in team_players')
        
        cur.close()
        
    except Exception as error:
        print(f'❌ Error: {error}')
        raise error
    finally:
        if conn:
            conn.close()

if __name__ == '__main__':
    try:
        check_player()
        print('\n✅ Check completed')
    except Exception as error:
        print(f'\n❌ Check failed: {error}')
        exit(1)
