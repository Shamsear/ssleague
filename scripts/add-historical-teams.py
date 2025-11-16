#!/usr/bin/env python3
"""
Add Historical Teams to Neon Database

This script:
1. Fetches all teams from Firebase team_seasons collection
2. Finds their final/latest name from the most recent season
3. Adds missing teams to Neon database
4. Shows a preview before making changes
"""

import firebase_admin
from firebase_admin import credentials, firestore
import psycopg2
from psycopg2.extras import execute_values
import os
from datetime import datetime
from collections import defaultdict
from dotenv import load_dotenv

# Load environment variables from .env.local
load_dotenv('.env.local')

# Neon database URL
NEON_URL = os.getenv('DATABASE_URL')

def init_firebase():
    """Initialize Firebase Admin SDK"""
    try:
        firebase_admin.get_app()
    except ValueError:
        # Try to load from service account file
        service_account_path = os.path.join(os.path.dirname(__file__), '..', 'firebase-service-account.json')
        if os.path.exists(service_account_path):
            cred = credentials.Certificate(service_account_path)
        else:
            # Fall back to environment variables
            cred = credentials.ApplicationDefault()
        firebase_admin.initialize_app(cred)
    return firestore.client()

def fetch_team_history(db):
    """Fetch all teams from Firebase and track their name history"""
    print("🔍 Fetching all teams from Firebase...")
    
    team_history = defaultdict(lambda: {
        'seasons': [],
        'names': set(),
        'latest_season': '',
        'latest_name': ''
    })
    
    # Get all team_seasons documents
    docs = db.collection('team_seasons').stream()
    
    count = 0
    for doc in docs:
        data = doc.to_dict()
        team_id = data.get('team_id')
        team_name = data.get('team_name')
        season_id = data.get('season_id')
        
        if not all([team_id, team_name, season_id]):
            continue
        
        team_history[team_id]['seasons'].append(season_id)
        team_history[team_id]['names'].add(team_name)
        
        # Track latest season (lexicographic comparison)
        if season_id > team_history[team_id]['latest_season']:
            team_history[team_id]['latest_season'] = season_id
            team_history[team_id]['latest_name'] = team_name
        
        count += 1
    
    print(f"📄 Processed {count} team_seasons documents")
    print(f"✅ Found {len(team_history)} unique teams\n")
    
    return team_history

def fetch_neon_teams():
    """Fetch existing teams from Neon database"""
    print("🔍 Fetching existing teams from Neon...")
    
    conn = psycopg2.connect(NEON_URL)
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT team_uid, team_name, is_active 
        FROM teams 
        ORDER BY team_name
    """)
    
    teams = {}
    for row in cursor.fetchall():
        teams[row[0]] = {'name': row[1], 'active': row[2]}
    
    cursor.close()
    conn.close()
    
    print(f"✅ Found {len(teams)} teams in Neon\n")
    
    return teams

def preview_changes(team_history, neon_teams):
    """Show what will be added"""
    print("=" * 80)
    print("\n📊 CURRENT TEAMS IN NEON:\n")
    
    for i, (uid, info) in enumerate(sorted(neon_teams.items(), key=lambda x: x[1]['name']), 1):
        status = "🟢 Active" if info['active'] else "⚪ Inactive"
        print(f"{i}. {info['name']:<30} ({uid}) {status}")
    
    print("\n" + "=" * 80)
    print("\n🔍 TEAMS THAT WILL BE ADDED:\n")
    
    teams_to_add = []
    teams_with_name_changes = []
    
    for team_id, data in team_history.items():
        if team_id not in neon_teams:
            team_info = {
                'team_id': team_id,
                'final_name': data['latest_name'],
                'latest_season': data['latest_season'],
                'total_seasons': len(data['seasons']),
                'seasons': sorted(data['seasons']),
                'had_multiple_names': len(data['names']) > 1,
                'all_names': sorted(data['names'])
            }
            teams_to_add.append(team_info)
            
            if len(data['names']) > 1:
                teams_with_name_changes.append(team_info)
    
    if not teams_to_add:
        print("✅ All historical teams are already in Neon! Nothing to add.\n")
        return None
    
    for i, team in enumerate(sorted(teams_to_add, key=lambda x: x['final_name']), 1):
        print(f"{i}. {team['final_name']:<30} ({team['team_id']})")
        print(f"   Latest Season: {team['latest_season']}")
        print(f"   Total Seasons: {team['total_seasons']}")
        print(f"   Seasons: {', '.join(team['seasons'])}")
        
        if team['had_multiple_names']:
            print(f"   ⚠️  HAD MULTIPLE NAMES: {' → '.join(team['all_names'])}")
        
        print()
    
    print("=" * 80)
    print("\n🎯 TEAMS WITH NAME CHANGES (The important ones!):\n")
    
    if not teams_with_name_changes:
        print("✅ No teams with name changes found.\n")
    else:
        for i, team in enumerate(teams_with_name_changes, 1):
            print(f"{i}. {' → '.join(team['all_names'])}")
            print(f"   ID: {team['team_id']}")
            print(f"   Final Name: {team['final_name']}")
            print(f"   This will fix {team['total_seasons']} seasons ({', '.join(team['seasons'])})")
            print()
    
    print("=" * 80)
    print("\n📈 SUMMARY:\n")
    print(f"Total unique teams in Firebase: {len(team_history)}")
    print(f"Already in Neon: {len(neon_teams)}")
    print(f"Will be added: {len(teams_to_add)}")
    print(f"Teams with name changes: {len(teams_with_name_changes)}")
    
    if teams_with_name_changes:
        print("\n" + "=" * 80)
        print("\n🔍 EXAMPLE - How This Fixes the Issue:\n")
        example = teams_with_name_changes[0]
        print(f"Example: Team \"{example['all_names'][0]}\" (old name in {example['seasons'][0]})")
        print(f"├─ Will be added to Neon as: \"{example['final_name']}\"")
        print(f"├─ All {example['total_seasons']} seasons will show: \"{example['final_name']}\"")
        print(f"└─ This fixes the inconsistency across seasons!\n")
    
    return teams_to_add

def add_teams_to_neon(teams_to_add):
    """Add teams to Neon database"""
    print("\n" + "=" * 80)
    print("\n💾 Adding teams to Neon database...\n")
    
    conn = psycopg2.connect(NEON_URL)
    cursor = conn.cursor()
    
    values = [
        (team['team_id'], team['final_name'], False)
        for team in teams_to_add
    ]
    
    try:
        execute_values(
            cursor,
            """
            INSERT INTO teams (team_uid, team_name, is_active, created_at, updated_at)
            VALUES %s
            ON CONFLICT (team_uid) DO NOTHING
            """,
            values,
            template="(%s, %s, %s, NOW(), NOW())"
        )
        
        conn.commit()
        print(f"✅ Successfully added {len(teams_to_add)} teams to Neon!")
        
        # Show what was added
        print("\n📋 Teams added:\n")
        for team in sorted(teams_to_add, key=lambda x: x['final_name']):
            print(f"  • {team['final_name']} ({team['team_id']})")
        
        print("\n✅ Migration complete!")
        
    except Exception as e:
        conn.rollback()
        print(f"❌ Error adding teams: {e}")
        raise
    
    finally:
        cursor.close()
        conn.close()

def main():
    """Main function"""
    print("\n" + "=" * 80)
    print("🔧 HISTORICAL TEAMS MIGRATION")
    print("=" * 80 + "\n")
    
    try:
        # Initialize Firebase
        db = init_firebase()
        
        # Fetch data
        team_history = fetch_team_history(db)
        neon_teams = fetch_neon_teams()
        
        # Show preview
        teams_to_add = preview_changes(team_history, neon_teams)
        
        if not teams_to_add:
            return
        
        # Ask for confirmation
        print("\n" + "=" * 80)
        print("\n⚠️  READY TO PROCEED?\n")
        response = input("Type 'yes' to add these teams to Neon, or anything else to cancel: ")
        
        if response.lower() == 'yes':
            add_teams_to_neon(teams_to_add)
        else:
            print("\n❌ Migration cancelled. No changes made.")
    
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
