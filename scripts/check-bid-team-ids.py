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
    
    # Get all bids with their team_ids
    cursor.execute("""
        SELECT 
            b.id,
            b.team_id,
            b.team_name,
            b.player_id,
            b.round_id,
            b.status,
            p.name as player_name
        FROM bids b
        LEFT JOIN footballplayers p ON b.player_id = p.id
        ORDER BY b.created_at DESC
        LIMIT 20;
    """)
    
    bids = cursor.fetchall()
    
    print("=" * 100)
    print("RECENT BIDS")
    print("=" * 100)
    
    if not bids:
        print("No bids found in database")
    else:
        for bid_id, team_id, team_name, player_id, round_id, status, player_name in bids:
            print(f"\nBid ID: {bid_id}")
            print(f"  Team ID: {team_id}")
            print(f"  Team Name: {team_name or 'N/A'}")
            print(f"  Player: {player_name} ({player_id})")
            print(f"  Round: {round_id}")
            print(f"  Status: {status}")
    
    # Also check teams table
    print("\n" + "=" * 100)
    print("TEAMS IN DATABASE")
    print("=" * 100)
    
    cursor.execute("""
        SELECT id, name, firebase_uid, season_id
        FROM teams
        ORDER BY created_at DESC
        LIMIT 10;
    """)
    
    teams = cursor.fetchall()
    
    if not teams:
        print("No teams found in database")
    else:
        for team_id, name, firebase_uid, season_id in teams:
            print(f"\nTeam ID: {team_id}")
            print(f"  Name: {name or 'N/A'}")
            print(f"  Firebase UID: {firebase_uid}")
            print(f"  Season: {season_id}")
    
    cursor.close()
    conn.close()
    
except Exception as e:
    print(f"❌ Error: {e}")
    exit(1)
