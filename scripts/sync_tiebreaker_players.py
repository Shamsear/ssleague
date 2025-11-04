"""
Sync team_players table with bulk tiebreaker winners
Finds players won through bulk tiebreakers that are missing from team_players
"""

import os
import psycopg2
from dotenv import load_dotenv
from datetime import datetime

# Load environment variables
load_dotenv('.env.local')

DATABASE_URL = os.getenv('DATABASE_URL') or os.getenv('NEON_DATABASE_URL')

def sync_tiebreaker_players():
    """Sync team_players table with resolved bulk tiebreakers"""
    
    conn = None
    try:
        print('🔍 Connecting to database...\n')
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        
        print('🔍 Finding players won through bulk tiebreakers...\n')
        
        # Find resolved bulk tiebreakers with winners
        cur.execute("""
            SELECT 
                bt.id as tiebreaker_id,
                bt.player_id,
                bt.player_name,
                bt.current_highest_team_id as team_id,
                bt.current_highest_bid as winning_bid,
                bt.resolved_at,
                fp.name as player_actual_name,
                fp.position,
                fp.team_id as current_team_id,
                fp.acquisition_value,
                r.season_id,
                bt.bulk_round_id as round_id
            FROM bulk_tiebreakers bt
            INNER JOIN footballplayers fp ON bt.player_id = fp.id
            INNER JOIN rounds r ON bt.bulk_round_id = r.id
            WHERE bt.status = 'resolved'
            AND bt.current_highest_team_id IS NOT NULL
            ORDER BY bt.resolved_at DESC
        """)
        
        resolved_tiebreakers = cur.fetchall()
        
        print(f'✅ Found {len(resolved_tiebreakers)} resolved bulk tiebreakers\n')
        
        if len(resolved_tiebreakers) == 0:
            print('No resolved tiebreakers found. Exiting.')
            return
        
        # Check which players are missing from team_players
        missing_count = 0
        inserted_count = 0
        already_exists_count = 0
        
        for tb in resolved_tiebreakers:
            tiebreaker_id, player_id, player_name, team_id, winning_bid, resolved_at, \
            player_actual_name, position, current_team_id, acquisition_value, season_id, round_id = tb
            
            # Check if player exists in team_players for this team
            cur.execute("""
                SELECT id FROM team_players
                WHERE team_id = %s
                AND player_id = %s
            """, (team_id, player_id))
            
            existing_record = cur.fetchone()
            
            if existing_record:
                print(f'✓ Player {player_name} already in team_players for team {team_id}')
                already_exists_count += 1
                continue
            
            # Missing - insert it
            missing_count += 1
            print(f'\n❌ MISSING: Player {player_name} ({player_id}) for team {team_id}')
            print(f'   Winning bid: £{winning_bid}')
            print(f'   Resolved at: {resolved_at}')
            
            try:
                cur.execute("""
                    INSERT INTO team_players (
                        team_id,
                        player_id,
                        season_id,
                        round_id,
                        purchase_price,
                        acquired_at
                    ) VALUES (%s, %s, %s, %s, %s, %s)
                """, (team_id, player_id, season_id, round_id, winning_bid, resolved_at or datetime.now()))
                
                conn.commit()
                print(f'   ✅ Inserted into team_players')
                inserted_count += 1
            except Exception as e:
                conn.rollback()
                print(f'   ❌ Failed to insert: {str(e)}')
        
        print('\n' + '=' * 60)
        print('📊 SUMMARY:')
        print(f'   Total resolved tiebreakers: {len(resolved_tiebreakers)}')
        print(f'   Already in team_players: {already_exists_count}')
        print(f'   Missing from team_players: {missing_count}')
        print(f'   Successfully inserted: {inserted_count}')
        print('=' * 60)
        
        cur.close()
        
    except Exception as error:
        print(f'❌ Error syncing tiebreaker players: {error}')
        raise error
    finally:
        if conn:
            conn.close()

if __name__ == '__main__':
    try:
        sync_tiebreaker_players()
        print('\n✅ Sync completed successfully')
    except Exception as error:
        print(f'\n❌ Sync failed: {error}')
        exit(1)
