#!/usr/bin/env python3
"""
Migration Script: Migrate Existing Trophies to Separate Name and Position
Parses combined names like "League Winner", "UCL Runner Up", etc.
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

def parse_trophy_name(full_name):
    """
    Parse trophy string into name and position components
    
    Examples:
        "League Winner" -> ("League", "Winner")
        "UCL Runner Up" -> ("UCL", "Runner Up")
        "FA Cup Champions" -> ("FA Cup", "Champions")
        "UCL CHAMPIONS" -> ("UCL", "Champions")
        "{\"CUP CHAMPIONS\"}" -> ("CUP", "Champions")
    """
    normalized = full_name.strip()
    
    # Handle PostgreSQL array format: {"CUP CHAMPIONS","UCL RUNNERS UP"}
    # Extract first element if it's an array
    if normalized.startswith('{') and normalized.endswith('}'):
        # Remove outer braces and quotes
        inner = normalized[1:-1]
        # Split by comma and take first element
        if ',' in inner:
            first_element = inner.split(',')[0].strip()
        else:
            first_element = inner
        # Remove quotes
        normalized = first_element.strip('"').strip()
    
    # Check for position indicators at the end (case insensitive)
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
    
    # Check for ordinal positions (4th Place, 5th Place, etc.)
    ordinal_match = re.match(r'^(.*?)\s+(\d+(?:st|nd|rd|th)\s+Place)$', normalized, re.IGNORECASE)
    if ordinal_match:
        return (ordinal_match.group(1).strip(), ordinal_match.group(2))
    
    # Special case: just "Runner Up" -> ("League", "Runner Up")
    if normalized.lower() == 'runner up':
        return ('League', 'Runner Up')
    
    # If no position indicator found, return full name with None position
    return (normalized, None)

def migrate_trophies():
    """Migrate existing trophies to separate name and position format"""
    
    print("🚀 Starting migration of existing trophies...\n")
    
    # Get database URL from environment
    db_url = os.getenv('NEON_TOURNAMENT_DB_URL')
    
    if not db_url:
        print("❌ ERROR: NEON_TOURNAMENT_DB_URL not found in environment variables")
        print("   Please ensure .env.local exists and contains NEON_TOURNAMENT_DB_URL")
        sys.exit(1)
    
    try:
        # Connect to database
        print("📡 Connecting to database...")
        conn = psycopg2.connect(db_url)
        cursor = conn.cursor()
        
        # 1. Fetch all existing trophies without trophy_position
        print("📊 Fetching existing trophies...\n")
        cursor.execute("""
            SELECT id, trophy_name, trophy_position
            FROM team_trophies
            WHERE trophy_position IS NULL
            ORDER BY id
        """)
        
        existing_trophies = cursor.fetchall()
        total = len(existing_trophies)
        
        print(f"Found {total} trophies to migrate\n")
        
        if total == 0:
            print("✅ No trophies need migration!")
            cursor.close()
            conn.close()
            return 0
        
        # 2. Migrate each trophy
        migrated = 0
        skipped = 0
        errors = 0
        
        print("=" * 60)
        
        for trophy_id, trophy_name, trophy_position in existing_trophies:
            name, position = parse_trophy_name(trophy_name)
            
            print(f"\nProcessing ID {trophy_id}: \"{trophy_name}\"")
            print(f"  → Name: \"{name}\"")
            print(f"  → Position: \"{position or 'NULL'}\"")
            
            if position:
                try:
                    # Update the trophy with separated name and position
                    cursor.execute("""
                        UPDATE team_trophies
                        SET 
                            trophy_name = %s,
                            trophy_position = %s,
                            updated_at = NOW()
                        WHERE id = %s
                    """, (name, position, trophy_id))
                    
                    print(f"  ✅ Migrated")
                    migrated += 1
                except psycopg2.Error as e:
                    print(f"  ❌ Error: {e}")
                    errors += 1
            else:
                print(f"  ⚠️  No position detected - keeping as-is")
                skipped += 1
        
        # Commit all changes
        conn.commit()
        
        print("\n" + "=" * 60)
        print(f"\n🏆 Migration complete!")
        print(f"  ✅ Migrated: {migrated}")
        print(f"  ⚠️  Skipped: {skipped}")
        print(f"  ❌ Errors: {errors}")
        print(f"  📊 Total: {total}\n")
        
        # 3. Show sample of migrated data
        if migrated > 0:
            print("📋 Sample of migrated trophies:")
            cursor.execute("""
                SELECT trophy_name, trophy_position
                FROM team_trophies
                WHERE trophy_position IS NOT NULL
                LIMIT 10
            """)
            
            samples = cursor.fetchall()
            for name, position in samples:
                print(f"  - {name} {position}")
            
            print(f"\n💾 Total trophies with position: {len(samples)}")
        
        cursor.close()
        conn.close()
        
        print("\n🎉 Migration process complete!")
        return 0 if errors == 0 else 1
        
    except psycopg2.Error as e:
        print(f"\n❌ Database error: {e}")
        return 1
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    sys.exit(migrate_trophies())
