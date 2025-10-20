"""
Migration script to create teamstats documents for existing registered teams.
This ensures all teams have proper teamstats documents before fixture results are saved.
"""

import os
import json
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv('.env.local')

# Initialize Firebase Admin using individual env vars
project_id = os.getenv('FIREBASE_ADMIN_PROJECT_ID')
client_email = os.getenv('FIREBASE_ADMIN_CLIENT_EMAIL')
private_key = os.getenv('FIREBASE_ADMIN_PRIVATE_KEY')

if not all([project_id, client_email, private_key]):
    print("❌ Firebase Admin credentials not found in .env.local")
    print("   Required: FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY")
    exit(1)

# Parse the private key (handle escaped newlines)
private_key = private_key.replace('\\n', '\n')

cred_dict = {
    'type': 'service_account',
    'project_id': project_id,
    'client_email': client_email,
    'private_key': private_key,
    'token_uri': 'https://oauth2.googleapis.com/token',
    'auth_uri': 'https://accounts.google.com/o/oauth2/auth',
    'auth_provider_x509_cert_url': 'https://www.googleapis.com/oauth2/v1/certs',
}

cred = credentials.Certificate(cred_dict)
firebase_admin.initialize_app(cred)

db = firestore.client()

def migrate_teamstats():
    """
    Create teamstats documents for all registered teams that don't have one yet.
    """
    print("🚀 Starting teamstats migration...")
    
    # Get all registered team_seasons
    team_seasons_ref = db.collection('team_seasons')
    team_seasons = team_seasons_ref.where('status', '==', 'registered').stream()
    
    created_count = 0
    skipped_count = 0
    error_count = 0
    
    for team_season_doc in team_seasons:
        team_season_data = team_season_doc.to_dict()
        team_id = team_season_data.get('team_id')
        season_id = team_season_data.get('season_id')
        team_name = team_season_data.get('team_name', 'Unknown Team')
        owner_name = team_season_data.get('owner_name') or team_season_data.get('username', '')
        
        if not team_id or not season_id:
            print(f"⚠️  Skipping {team_season_doc.id} - missing team_id or season_id")
            skipped_count += 1
            continue
        
        # Check if teamstats document already exists
        stats_id = f"{team_id}_{season_id}"
        stats_ref = db.collection('teamstats').document(stats_id)
        stats_doc = stats_ref.get()
        
        if stats_doc.exists:
            print(f"✓ Teamstats already exists: {stats_id}")
            skipped_count += 1
            continue
        
        try:
            # Create new teamstats document
            stats_data = {
                'team_id': team_id,
                'team_name': team_name,
                'season_id': season_id,
                'owner_name': owner_name,
                'rank': 0,  # Will be set at season end
                'points': 0,  # Will be calculated from wins/draws
                'matches_played': 0,
                'wins': 0,
                'draws': 0,
                'losses': 0,
                'goals_for': 0,
                'goals_against': 0,
                'goal_difference': 0,
                'win_percentage': 0,
                'cup_achievement': '',  # Will be set if team wins cup
                'cups': [],  # Array of cup achievements
                'players_count': team_season_data.get('players_count', 0),
                'processed_fixtures': [],  # Track processed fixtures to prevent duplicates
                'created_at': firestore.SERVER_TIMESTAMP,
                'updated_at': firestore.SERVER_TIMESTAMP
            }
            
            stats_ref.set(stats_data)
            print(f"✅ Created teamstats: {stats_id} ({team_name})")
            created_count += 1
            
        except Exception as e:
            print(f"❌ Error creating teamstats for {stats_id}: {str(e)}")
            error_count += 1
    
    print("\n" + "="*60)
    print("📊 Migration Summary:")
    print(f"   ✅ Created: {created_count}")
    print(f"   ⏭️  Skipped: {skipped_count}")
    print(f"   ❌ Errors: {error_count}")
    print("="*60)
    
    if error_count == 0:
        print("✅ Migration completed successfully!")
    else:
        print(f"⚠️  Migration completed with {error_count} error(s)")

if __name__ == "__main__":
    migrate_teamstats()
