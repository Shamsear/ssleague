#!/usr/bin/env python3
"""
Script to verify current trophy state and add missing trophies from JSON arrays
Handles cases where multiple trophies were stored in one row as JSON array
"""

import os
import sys
import re
from pathlib import Path
import psycopg2
from dotenv import load_dotenv

# Load environment variables from .env.local
env_path = Path(__file__).parent.parent / '.env.local'
load_dotenv(dotenv_path=env_path)

def parse_trophy_name(trophy_str):
    """Parse trophy string into name and position"""
    normalized = trophy_str.strip()
    
    if re.search(r'\s+WINNERS?$', normalized, re.IGNORECASE):
        trophy_name = re.sub(r'\s+WINNERS?$', '', normalized, flags=re.IGNORECASE).strip()
        return (trophy_name, 'Winner')
    
    if re.search(r'\s+RUNNERS?\s+UP$', normalized, re.IGNORECASE):
        trophy_name = re.sub(r'\s+RUNNERS?\s+UP$', '', normalized, flags=re.IGNORECASE).strip()
        return (trophy_name, 'Runner Up')
    
    if re.search(r'\s+CHAMPIONS?$', normalized, re.IGNORECASE):
        trophy_name = re.sub(r'\s+CHAMPIONS?$', '', normalized, flags=re.IGNORECASE).strip()
        return (trophy_name, 'Champions')
    
    if re.search(r'\s+THIRD\s+PLACE$', normalized, re.IGNORECASE):
        trophy_name = re.sub(r'\s+THIRD\s+PLACE$', '', normalized, flags=re.IGNORECASE).strip()
        return (trophy_name, 'Third Place')
    
    return (normalized, None)

def main():
    print("🔍 Verifying trophy data and checking for missing entries...\n")
    
    db_url = os.getenv('NEON_TOURNAMENT_DB_URL')
    if not db_url:
        print("❌ ERROR: NEON_TOURNAMENT_DB_URL not found")
        sys.exit(1)
    
    try:
        conn = psycopg2.connect(db_url)
        cursor = conn.cursor()
        
        # First, check current state
        print("📊 Current trophy records:")
        cursor.execute("""
            SELECT id, team_id, team_name, season_id, trophy_name, trophy_position
            FROM team_trophies
            ORDER BY id
        """)
        
        trophies = cursor.fetchall()
        print(f"\nTotal trophies: {len(trophies)}\n")
        
        for trophy in trophies:
            tid, team_id, team_name, season_id, name, position = trophy
            print(f"ID {tid}: {team_name} - {name} {position or '(no position)'}")
        
        # Check the history/notes to find original JSON arrays
        print("\n" + "="*60)
        print("\n🔎 Checking for original JSON array data in notes...")
        
        # Look for trophy records that might have been part of arrays
        # We need to check the teamstats.trophies JSONB column for the original data
        cursor.execute("""
            SELECT DISTINCT team_id, team_name, season_id, trophies
            FROM teamstats
            WHERE trophies IS NOT NULL 
            AND trophies::text != '[]'
            ORDER BY season_id, team_name
        """)
        
        teamstats_trophies = cursor.fetchall()
        
        print(f"\nFound {len(teamstats_trophies)} team(s) with trophy data in teamstats\n")
        
        missing_trophies = []
        
        for team_id, team_name, season_id, trophies_json in teamstats_trophies:
            print(f"\n{team_name} ({season_id}):")
            print(f"  Original trophies JSON: {trophies_json}")
            
            # Parse the JSONB array
            if isinstance(trophies_json, list):
                trophy_list = trophies_json
            else:
                # Already parsed by psycopg2
                trophy_list = trophies_json if isinstance(trophies_json, list) else []
            
            # Check each trophy in the JSON
            for trophy_item in trophy_list:
                trophy_strings = []
                
                if isinstance(trophy_item, dict):
                    trophy_name_value = trophy_item.get('name', '')
                    # Handle if name is a list or string
                    if isinstance(trophy_name_value, list):
                        trophy_strings = trophy_name_value
                    else:
                        trophy_strings = [trophy_name_value]
                else:
                    trophy_strings = [str(trophy_item)]
                
                # Process each trophy string (handles multiple trophies in one entry)
                for trophy_str in trophy_strings:
                    if not trophy_str or not isinstance(trophy_str, str):
                        continue
                        
                    name, position = parse_trophy_name(trophy_str)
                    
                    # Check if this trophy exists in team_trophies
                    cursor.execute("""
                        SELECT id FROM team_trophies
                        WHERE team_id = %s 
                        AND season_id = %s 
                        AND trophy_name = %s 
                        AND trophy_position = %s
                    """, (team_id, season_id, name, position))
                    
                    exists = cursor.fetchone()
                    
                    if exists:
                        print(f"    ✅ {name} {position} - EXISTS (ID: {exists[0]})")
                    else:
                        print(f"    ❌ {name} {position} - MISSING")
                        missing_trophies.append({
                            'team_id': team_id,
                            'team_name': team_name,
                            'season_id': season_id,
                            'trophy_name': name,
                            'trophy_position': position
                        })
        
        # Add missing trophies
        if missing_trophies:
            print("\n" + "="*60)
            print(f"\n🔧 Adding {len(missing_trophies)} missing trophies...")
            
            for trophy in missing_trophies:
                try:
                    cursor.execute("""
                        INSERT INTO team_trophies (
                            team_id, team_name, season_id, 
                            trophy_type, trophy_name, trophy_position,
                            awarded_by, notes, created_at, updated_at
                        ) VALUES (
                            %s, %s, %s,
                            'cup', %s, %s,
                            'system', 'Recovered from teamstats during migration', NOW(), NOW()
                        )
                        RETURNING id
                    """, (
                        trophy['team_id'],
                        trophy['team_name'],
                        trophy['season_id'],
                        trophy['trophy_name'],
                        trophy['trophy_position']
                    ))
                    
                    new_id = cursor.fetchone()[0]
                    print(f"  ✅ Added: {trophy['team_name']} - {trophy['trophy_name']} {trophy['trophy_position']} (ID: {new_id})")
                    
                except psycopg2.Error as e:
                    print(f"  ❌ Error adding trophy: {e}")
            
            conn.commit()
            print(f"\n✅ Successfully added {len(missing_trophies)} missing trophies")
        else:
            print("\n✅ All trophies are present - nothing to add!")
        
        # Final count
        cursor.execute("SELECT COUNT(*) FROM team_trophies")
        final_count = cursor.fetchone()[0]
        print(f"\n📊 Final trophy count: {final_count}")
        
        cursor.close()
        conn.close()
        
        print("\n🎉 Verification and fix complete!")
        return 0
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    sys.exit(main())
