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
    
    # Check if round_players table exists
    cursor.execute("""
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = 'round_players'
        );
    """)
    
    exists = cursor.fetchone()[0]
    
    if not exists:
        print("❌ Table 'round_players' does not exist")
        print("\n💡 The rounds table doesn't have a corresponding round_players table.")
        print("   Either:")
        print("   1. Create the round_players table")
        print("   2. Remove the JOIN from the query")
    else:
        # Get round_players columns
        cursor.execute("""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'round_players'
            ORDER BY ordinal_position;
        """)
        
        columns = cursor.fetchall()
        
        print("=" * 80)
        print("ROUND_PLAYERS TABLE COLUMNS")
        print("=" * 80)
        
        for col_name, col_type, nullable in columns:
            print(f"  • {col_name:<25} {col_type:<20} {'NULL' if nullable == 'YES' else 'NOT NULL'}")
        
        # Check rounds table id column type
        cursor.execute("""
            SELECT data_type
            FROM information_schema.columns 
            WHERE table_name = 'rounds' AND column_name = 'id';
        """)
        
        rounds_id_type = cursor.fetchone()[0]
        
        print("\n" + "=" * 80)
        print(f"ROUNDS.ID type: {rounds_id_type}")
        
        # Check round_players.round_id column type
        cursor.execute("""
            SELECT data_type
            FROM information_schema.columns 
            WHERE table_name = 'round_players' AND column_name = 'round_id';
        """)
        
        rp_result = cursor.fetchone()
        if rp_result:
            rp_round_id_type = rp_result[0]
            print(f"ROUND_PLAYERS.ROUND_ID type: {rp_round_id_type}")
            
            if rounds_id_type != rp_round_id_type:
                print("\n❌ TYPE MISMATCH!")
                print(f"   rounds.id is {rounds_id_type}")
                print(f"   round_players.round_id is {rp_round_id_type}")
                print("\n🔧 Need to fix the type mismatch")
            else:
                print("\n✅ Types match!")
        else:
            print("❌ round_id column not found in round_players")
    
    cursor.close()
    conn.close()
    
except Exception as e:
    print(f"❌ Error: {e}")
    exit(1)
