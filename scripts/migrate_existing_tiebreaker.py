import os, psycopg2, json
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent.parent / '.env.local')
conn = psycopg2.connect(os.getenv('NEON_AUCTION_DB_URL'))
cur = conn.cursor()

tiebreaker_id = 'SSPSLTR00001'

print(f"🔧 Migrating existing tiebreaker {tiebreaker_id} to bulk tiebreaker system\n")

try:
    # Get tiebreaker details from regular tiebreakers table
    cur.execute(f"""
        SELECT id, round_id, season_id, player_id, player_name, 
               original_amount, tied_teams, status
        FROM tiebreakers 
        WHERE id = '{tiebreaker_id}'
    """)
    
    tiebreaker = cur.fetchone()
    if not tiebreaker:
        print(f"❌ Tiebreaker {tiebreaker_id} not found")
        exit(1)
    
    (tb_id, round_id, season_id, player_id, player_name, 
     original_amount, tied_teams_json, status) = tiebreaker
    
    # tied_teams_json is already a Python list from psycopg2
    tied_teams = tied_teams_json if tied_teams_json else []
    
    print(f"✅ Found tiebreaker: {player_name}")
    print(f"   Round ID: {round_id}")
    print(f"   Season ID: {season_id}")
    print(f"   Tied teams: {len(tied_teams)}")
    
    # Create bulk_tiebreakers record
    print("\n📝 Creating bulk_tiebreakers record...")
    cur.execute("""
        INSERT INTO bulk_tiebreakers (
            id, bulk_round_id, season_id, player_id, player_name,
            original_amount, tied_teams, status, duration_minutes,
            created_at, updated_at
        ) VALUES (
            %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
            bulk_round_id = EXCLUDED.bulk_round_id,
            season_id = EXCLUDED.season_id,
            player_name = EXCLUDED.player_name,
            updated_at = NOW()
    """, (tb_id, round_id, season_id, player_id, player_name,
          original_amount, json.dumps(tied_teams), status, 1440))
    
    print("   ✅ bulk_tiebreakers record created")
    
    # Create bulk_tiebreaker_teams records
    print("\n📝 Creating bulk_tiebreaker_teams records...")
    for team in tied_teams:
        cur.execute("""
            INSERT INTO bulk_tiebreaker_teams (
                tiebreaker_id, team_id, team_name, status,
                current_bid, joined_at
            ) VALUES (
                %s, %s, %s, 'active', %s, NOW()
            )
            ON CONFLICT (tiebreaker_id, team_id) DO UPDATE SET
                team_name = EXCLUDED.team_name,
                status = 'active'
        """, (tb_id, team['team_id'], team['team_name'], original_amount))
        print(f"   ✅ Added team: {team['team_name']}")
    
    conn.commit()
    
    print(f"\n🎉 Migration completed successfully!")
    print(f"\n✅ Tiebreaker {tiebreaker_id} now has bulk tiebreaker infrastructure")
    print(f"   Teams can now use the Last Person Standing auction system")
    
except Exception as e:
    print(f"\n❌ Error: {e}")
    conn.rollback()
finally:
    cur.close()
    conn.close()
