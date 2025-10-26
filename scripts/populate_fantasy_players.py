#!/usr/bin/env python3
"""
Populate fantasy_players table from player_seasons
Run this script to import all players for a season into the fantasy league
"""

import requests
import json
import sys

# Configuration
API_URL = "http://localhost:3000/api/fantasy/players/populate"
LEAGUE_ID = "SSPSLFLS16"
SEASON_ID = "SSPSLS16"

def populate_fantasy_players():
    """Call the API to populate fantasy players"""
    
    print(f"🔄 Populating fantasy players...")
    print(f"   League: {LEAGUE_ID}")
    print(f"   Season: {SEASON_ID}\n")
    
    payload = {
        "league_id": LEAGUE_ID,
        "season_id": SEASON_ID
    }
    
    try:
        response = requests.post(
            API_URL,
            headers={"Content-Type": "application/json"},
            json=payload,
            timeout=60
        )
        
        # Check if request was successful
        if response.status_code == 200:
            data = response.json()
            
            if data.get("success"):
                print("✅ Success!")
                print(f"\n📊 Statistics:")
                stats = data.get("stats", {})
                print(f"   Found in player_seasons: {stats.get('found_in_player_seasons', 0)}")
                print(f"   Inserted/Updated: {stats.get('inserted_or_updated', 0)}")
                print(f"   Skipped: {stats.get('skipped', 0)}")
                print(f"   Errors: {stats.get('errors', 0)}")
                print(f"   Total in database: {stats.get('total_in_database', 0)}")
                
                # Show errors if any
                if data.get("errors"):
                    print(f"\n⚠️  Errors encountered:")
                    for error in data.get("errors", [])[:10]:  # Show first 10 errors
                        print(f"   - {error}")
                    if len(data.get("errors", [])) > 10:
                        print(f"   ... and {len(data.get('errors', [])) - 10} more")
                
                return True
            else:
                print(f"❌ API returned error: {data.get('message', 'Unknown error')}")
                return False
        else:
            print(f"❌ HTTP Error {response.status_code}")
            try:
                error_data = response.json()
                print(f"   Error: {error_data.get('error', 'Unknown error')}")
                if error_data.get('details'):
                    print(f"   Details: {error_data.get('details')}")
            except:
                print(f"   Response: {response.text}")
            return False
            
    except requests.exceptions.ConnectionError:
        print("❌ Connection Error!")
        print("   Make sure your Next.js server is running on http://localhost:3000")
        return False
    except requests.exceptions.Timeout:
        print("❌ Request timed out!")
        print("   The operation took too long. Try again.")
        return False
    except Exception as e:
        print(f"❌ Unexpected error: {str(e)}")
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("Fantasy Players Population Script")
    print("=" * 60)
    print()
    
    success = populate_fantasy_players()
    
    print()
    print("=" * 60)
    
    if success:
        print("✅ All done! Fantasy players have been populated.")
        sys.exit(0)
    else:
        print("❌ Failed to populate fantasy players. Check the errors above.")
        sys.exit(1)
