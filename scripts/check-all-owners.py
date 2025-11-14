#!/usr/bin/env python3
"""
Check All Owners Script
Lists all owners and identifies any potential duplicates by different criteria
"""

import os
import sys
from urllib.parse import urlparse
import psycopg2
from dotenv import load_dotenv

# Load environment variables from .env.local
load_dotenv('.env.local')

def check_owners():
    """Check all owners in the database"""
    
    print("🔍 Checking all owners in database...\n")
    print("="*80)
    
    # Get tournament database URL from environment
    db_url = os.getenv('NEON_TOURNAMENT_DB_URL')
    
    if not db_url:
        print("❌ Error: NEON_TOURNAMENT_DB_URL not found!")
        sys.exit(1)
    
    # Parse the URL
    try:
        result = urlparse(db_url)
        conn_params = {
            'host': result.hostname,
            'port': result.port or 5432,
            'database': result.path[1:],
            'user': result.username,
            'password': result.password,
            'sslmode': 'require'
        }
        print(f"✅ Connected to: {result.hostname}\n")
        
    except Exception as e:
        print(f"❌ Error parsing database URL: {e}")
        sys.exit(1)
    
    # Connect to database
    try:
        conn = psycopg2.connect(**conn_params)
        cursor = conn.cursor()
        
    except Exception as e:
        print(f"❌ Error connecting to database: {e}")
        sys.exit(1)
    
    try:
        # Get all owners
        cursor.execute("""
            SELECT 
                id,
                owner_id,
                team_id,
                name,
                email,
                phone,
                created_at
            FROM owners
            ORDER BY id
        """)
        
        owners = cursor.fetchall()
        
        print(f"📊 Total owners: {len(owners)}\n")
        print("="*80)
        print("\n🗂️  ALL OWNERS:\n")
        
        for owner in owners:
            print(f"ID: {owner[0]:<3} | owner_id: {owner[1]:<45} | team_id: {owner[2]:<45}")
            print(f"       Name: {owner[3]}")
            print(f"       Email: {owner[4]} | Phone: {owner[5]}")
            print(f"       Created: {owner[6]}")
            print()
        
        # Check for duplicates by email
        print("="*80)
        print("\n🔍 Checking for duplicate emails...\n")
        
        cursor.execute("""
            SELECT 
                email,
                COUNT(*) as count,
                STRING_AGG(owner_id || ' (' || team_id || ')', ', ' ORDER BY id) as owners
            FROM owners
            GROUP BY email
            HAVING COUNT(*) > 1
        """)
        
        email_dupes = cursor.fetchall()
        
        if email_dupes:
            print(f"Found {len(email_dupes)} email(s) with duplicates:\n")
            for dupe in email_dupes:
                print(f"  📧 {dupe[0]}: {dupe[1]} entries")
                print(f"     Owners: {dupe[2]}")
                print()
        else:
            print("✅ No duplicate emails found")
        
        # Check for duplicates by name
        print("="*80)
        print("\n🔍 Checking for duplicate names...\n")
        
        cursor.execute("""
            SELECT 
                name,
                COUNT(*) as count,
                STRING_AGG(owner_id || ' (' || team_id || ')', ', ' ORDER BY id) as owners
            FROM owners
            GROUP BY name
            HAVING COUNT(*) > 1
        """)
        
        name_dupes = cursor.fetchall()
        
        if name_dupes:
            print(f"Found {len(name_dupes)} name(s) with duplicates:\n")
            for dupe in name_dupes:
                print(f"  👤 {dupe[0]}: {dupe[1]} entries")
                print(f"     Owners: {dupe[2]}")
                print()
        else:
            print("✅ No duplicate names found")
        
        # Check for owners with Firebase UID format in team_id
        print("="*80)
        print("\n🔍 Checking for Firebase UID format in team_id...\n")
        
        cursor.execute("""
            SELECT 
                id,
                owner_id,
                team_id,
                name,
                email
            FROM owners
            WHERE team_id NOT LIKE 'SSPSLT%'
            ORDER BY id
        """)
        
        uid_format = cursor.fetchall()
        
        if uid_format:
            print(f"Found {len(uid_format)} owner(s) with Firebase UID format:\n")
            for owner in uid_format:
                print(f"  ID: {owner[0]} | owner_id: {owner[1]}")
                print(f"  team_id: {owner[2]}")
                print(f"  Name: {owner[3]} ({owner[4]})")
                print()
        else:
            print("✅ All owners have proper team_id format (SSPSLT%)")
        
        print("="*80)
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        sys.exit(1)
        
    finally:
        cursor.close()
        conn.close()
        print("\n✅ Check complete\n")

if __name__ == "__main__":
    try:
        check_owners()
    except KeyboardInterrupt:
        print("\n\n⚠️  Cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        sys.exit(1)
