"""
Migration script to add processed_fixtures field to existing teamstats documents.
This is required for the team stats update API to prevent duplicate counting.
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

def add_processed_fixtures():
    """
    Add processed_fixtures field to all existing teamstats documents.
    """
    print("🚀 Starting teamstats update migration...")
    
    # Get all teamstats documents
    teamstats_ref = db.collection('teamstats')
    teamstats = teamstats_ref.stream()
    
    updated_count = 0
    skipped_count = 0
    error_count = 0
    
    for doc in teamstats:
        doc_data = doc.to_dict()
        stats_id = doc.id
        
        # Check if processed_fixtures already exists
        if 'processed_fixtures' in doc_data:
            print(f"✓ Already has processed_fixtures: {stats_id}")
            skipped_count += 1
            continue
        
        try:
            # Add empty processed_fixtures array
            doc.reference.update({
                'processed_fixtures': [],
                'updated_at': firestore.SERVER_TIMESTAMP
            })
            
            team_name = doc_data.get('team_name', 'Unknown')
            season_id = doc_data.get('season_id', 'Unknown')
            print(f"✅ Added processed_fixtures: {stats_id} ({team_name} - {season_id})")
            updated_count += 1
            
        except Exception as e:
            print(f"❌ Error updating {stats_id}: {str(e)}")
            error_count += 1
    
    print("\n" + "="*60)
    print("📊 Migration Summary:")
    print(f"   ✅ Updated: {updated_count}")
    print(f"   ⏭️  Skipped: {skipped_count}")
    print(f"   ❌ Errors: {error_count}")
    print("="*60)
    
    if error_count == 0:
        print("✅ Migration completed successfully!")
    else:
        print(f"⚠️  Migration completed with {error_count} error(s)")

if __name__ == "__main__":
    add_processed_fixtures()
