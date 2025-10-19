import os
import psycopg2
from dotenv import load_dotenv
import firebase_admin
from firebase_admin import credentials, firestore

# Load environment variables
load_dotenv()

# Initialize Firebase Admin
import json

firebase_creds_json = os.getenv('FIREBASE_SERVICE_ACCOUNT_KEY')
if firebase_creds_json:
    cred = credentials.Certificate(json.loads(firebase_creds_json))
    firebase_admin.initialize_app(cred)
else:
    # Try to use service account key file if exists
    try:
        cred = credentials.Certificate('serviceAccountKey.json')
        firebase_admin.initialize_app(cred)
    except FileNotFoundError:
        print("❌ Firebase credentials not found. Set FIREBASE_SERVICE_ACCOUNT_KEY env var or place serviceAccountKey.json in root")
        exit(1)

db = firestore.client()

# Connect to Neon (PostgreSQL)
DATABASE_URL = os.getenv('NEON_DATABASE_URL')
if not DATABASE_URL:
    print("❌ NEON_DATABASE_URL not found in environment variables")
    exit(1)

conn = psycopg2.connect(DATABASE_URL)
cursor = conn.cursor()

print('🔄 Starting fixture ID migration...')

# Step 1: Get all team_seasons from Firebase to build a mapping
print('📊 Fetching team-season mappings from Firebase...')
team_seasons = db.collection('team_seasons').get()
team_mapping = {}

for doc in team_seasons:
    data = doc.to_dict()
    # Create a key from team name and season
    key = f"{data['team_name']}_{data['season_id']}"
    team_mapping[key] = {
        'team_id': data['team_id'],
        'team_name': data['team_name'],
        'season_id': data['season_id']
    }

print(f'📊 Found {len(team_mapping)} team-season mappings')

# Step 2: Get all fixtures from Neon
cursor.execute('SELECT id, home_team_name, away_team_name, season_id FROM fixtures')
fixtures = cursor.fetchall()
print(f'📊 Found {len(fixtures)} fixtures in Neon')

updated = 0
failed = 0

# Step 3: Update each fixture
for fixture in fixtures:
    fixture_id, home_team_name, away_team_name, season_id = fixture
    
    try:
        # Try to find correct IDs based on team names
        home_key = f"{home_team_name}_{season_id}"
        away_key = f"{away_team_name}_{season_id}"
        
        home_mapping = team_mapping.get(home_key)
        away_mapping = team_mapping.get(away_key)
        
        if not home_mapping or not away_mapping:
            print(f"⚠️  Could not find mapping for fixture {fixture_id}:")
            print(f"   Home: {home_team_name}, Away: {away_team_name}, Season: {season_id}")
            failed += 1
            continue
        
        # Update the fixture with correct team IDs from Firebase
        cursor.execute('''
            UPDATE fixtures
            SET 
                home_team_id = %s,
                away_team_id = %s,
                season_id = %s,
                updated_at = NOW()
            WHERE id = %s
        ''', (home_mapping['team_id'], away_mapping['team_id'], home_mapping['season_id'], fixture_id))
        
        updated += 1
        
        if updated % 10 == 0:
            print(f'✅ Updated {updated} fixtures...')
            conn.commit()  # Commit every 10 updates
            
    except Exception as e:
        print(f'❌ Error updating fixture {fixture_id}: {e}')
        failed += 1

# Final commit
conn.commit()

print('\n✅ Migration complete!')
print(f'   Total fixtures: {len(fixtures)}')
print(f'   Updated: {updated}')
print(f'   Failed: {failed}')

# Close connections
cursor.close()
conn.close()
