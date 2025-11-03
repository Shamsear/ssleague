"""
Fix missing team_name in team_tiebreakers table
Populates team_name by looking up from bids table
"""

import psycopg2
import os
import sys

# Add parent directory to path for Firebase imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from firebase_admin import credentials, initialize_app, firestore
import firebase_admin

def main():
    # Connect to PostgreSQL
    conn = psycopg2.connect(
        os.environ.get('DATABASE_URL') or os.environ.get('NEON_DATABASE_URL')
    )
    cur = conn.cursor()
    
    # Initialize Firebase Admin
    try:
        firebase_admin.get_app()
    except ValueError:
        # Initialize if not already done
        cred = credentials.Certificate('serviceAccountKey.json')
        initialize_app(cred)
    
    db = firestore.client()
    
    print("=== Fixing team_name in team_tiebreakers ===\n")
    
    # Get all team_tiebreakers with missing or null team_name
    cur.execute("""
        SELECT 
            tt.id,
            tt.team_id,
            tt.original_bid_id,
            b.team_id as bid_team_id
        FROM team_tiebreakers tt
        LEFT JOIN bids b ON tt.original_bid_id::uuid = b.id
        WHERE tt.team_name IS NULL OR tt.team_name = ''
    """)
    
    rows = cur.fetchall()
    print(f"Found {len(rows)} team_tiebreakers with missing team_name\n")
    
    if len(rows) == 0:
        print("✅ All team_tiebreakers already have team_name")
        cur.close()
        conn.close()
        return
    
    updated = 0
    errors = 0
    
    for row in rows:
        tt_id, team_id, original_bid_id, bid_team_id = row
        
        # Use team_id from team_tiebreakers or fall back to bid team_id
        actual_team_id = team_id if team_id else bid_team_id
        
        if not actual_team_id:
            print(f"❌ Team tiebreaker {tt_id}: No team_id found")
            errors += 1
            continue
        
        # Fetch team name from Firebase
        try:
            user_doc = db.collection('users').document(actual_team_id).get()
            
            if user_doc.exists:
                team_name = user_doc.to_dict().get('teamName') or user_doc.to_dict().get('email') or actual_team_id
            else:
                print(f"⚠️  Team {actual_team_id} not found in Firebase, using ID as name")
                team_name = actual_team_id
            
            # Update team_tiebreakers
            cur.execute("""
                UPDATE team_tiebreakers
                SET team_name = %s
                WHERE id = %s
            """, (team_name, tt_id))
            
            print(f"✅ Updated team_tiebreaker {tt_id}: team_id={actual_team_id}, team_name={team_name}")
            updated += 1
            
        except Exception as e:
            print(f"❌ Error updating team_tiebreaker {tt_id}: {e}")
            errors += 1
    
    # Commit changes
    conn.commit()
    
    print(f"\n=== Summary ===")
    print(f"Total found: {len(rows)}")
    print(f"Updated: {updated}")
    print(f"Errors: {errors}")
    
    cur.close()
    conn.close()
    
    print("\n✅ Migration completed!")

if __name__ == '__main__':
    main()
