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
    
    # Get all teams
    cursor.execute("""
        SELECT id, name, firebase_uid, season_id, created_at
        FROM teams
        ORDER BY created_at DESC;
    """)
    
    teams = cursor.fetchall()
    
    print("=" * 100)
    print("ALL TEAMS IN DATABASE")
    print("=" * 100)
    
    if not teams:
        print("\n❌ No teams found in database!")
    else:
        print(f"\n✅ Found {len(teams)} teams:\n")
        for team_id, name, firebase_uid, season_id, created_at in teams:
            print(f"Team ID: {team_id}")
            print(f"  Name: {name}")
            print(f"  Firebase UID: {firebase_uid}")
            print(f"  Season: {season_id}")
            print(f"  Created: {created_at}")
            print()
    
    cursor.close()
    conn.close()
    
except Exception as e:
    print(f"❌ Error: {e}")
    exit(1)
