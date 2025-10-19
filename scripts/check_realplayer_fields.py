import firebase_admin
from firebase_admin import credentials, firestore
import os

# Initialize Firebase
if not firebase_admin._apps:
    cred = credentials.Certificate('serviceAccountKey.json')
    firebase_admin.initialize_app(cred)

db = firestore.client()

# Get a few real players
players = db.collection('realplayer').limit(3).stream()

print("📋 Real Player Fields:\n")
for player in players:
    data = player.to_dict()
    print(f"Player: {data.get('name', 'Unknown')}")
    print(f"  - player_id: {data.get('player_id', 'N/A')}")
    print(f"  - star_rating: {data.get('star_rating', 'N/A')}")
    print(f"  - points: {data.get('points', 'NO FIELD')}")
    print(f"  - team_id: {data.get('team_id', 'N/A')}")
    print(f"  - season_id: {data.get('season_id', 'N/A')}")
    print()
