#!/usr/bin/env python3
"""
Cleanup Duplicate Owners Script
Identifies and removes duplicate owner entries where the same person
was created twice - once with Firebase UID and once with proper team_id
"""

import os
import sys
from urllib.parse import urlparse
import psycopg2
from dotenv import load_dotenv

# Load environment variables from .env.local
load_dotenv('.env.local')

def run_cleanup():
    """Run the cleanup to remove duplicate owners"""
    
    print("🔍 Starting duplicate owners cleanup...\n")
    print("="*80)
    
    # Get tournament database URL from environment
    db_url = os.getenv('NEON_TOURNAMENT_DB_URL')
    
    if not db_url:
        print("❌ Error: NEON_TOURNAMENT_DB_URL not found!")
        print("   Make sure NEON_TOURNAMENT_DB_URL is set in .env.local")
        sys.exit(1)
    
    print(f"✅ Found tournament database connection string")
    
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
        print(f"✅ Connecting to: {result.hostname}")
        
    except Exception as e:
        print(f"❌ Error parsing database URL: {e}")
        sys.exit(1)
    
    # Connect to database
    try:
        conn = psycopg2.connect(**conn_params)
        conn.autocommit = False
        cursor = conn.cursor()
        print("✅ Connected to tournament database\n")
        
    except Exception as e:
        print(f"❌ Error connecting to database: {e}")
        sys.exit(1)
    
    try:
        print("="*80)
        print("\n📊 STEP 1: Identifying Duplicates...\n")
        
        # Identify duplicates (case-insensitive name comparison)
        # Keep entries with proper team_id (SSPSLT%), delete Firebase UID entries
        cursor.execute("""
            SELECT 
                o1.id as keep_id,
                o1.owner_id as keep_owner_id,
                o1.team_id as keep_team_id,
                o2.id as duplicate_id,
                o2.owner_id as duplicate_owner_id,
                o2.team_id as duplicate_team_id,
                o1.name,
                o1.email,
                o1.phone
            FROM owners o1
            INNER JOIN owners o2 ON 
                o1.email = o2.email 
                AND UPPER(TRIM(o1.name)) = UPPER(TRIM(o2.name))
                AND o1.phone = o2.phone
                AND o1.id != o2.id
            WHERE 
                o1.team_id LIKE 'SSPSLT%'
                AND o2.team_id NOT LIKE 'SSPSLT%'
            ORDER BY o1.name
        """)
        
        duplicates = cursor.fetchall()
        
        if not duplicates:
            print("✨ No duplicates found! Database is clean.")
            return
        
        print(f"Found {len(duplicates)} duplicate(s):\n")
        
        for dup in duplicates:
            print(f"📌 {dup[6]} ({dup[7]})")
            print(f"   KEEP:   ID={dup[0]}, owner_id={dup[1]}, team_id={dup[2]}")
            print(f"   DELETE: ID={dup[3]}, owner_id={dup[4]}, team_id={dup[5]}")
            print()
        
        # Ask for confirmation
        print("="*80)
        response = input(f"\n⚠️  Delete {len(duplicates)} duplicate record(s)? (yes/no): ").strip().lower()
        
        if response != 'yes':
            print("❌ Cleanup cancelled by user")
            return
        
        print("\n🗑️  STEP 2: Deleting Duplicates...\n")
        
        # Delete duplicates (case-insensitive name comparison)
        # Delete entries with Firebase UID as team_id, keep proper SSPSLT entries
        cursor.execute("""
            DELETE FROM owners
            WHERE id IN (
                SELECT o2.id
                FROM owners o1
                INNER JOIN owners o2 ON 
                    o1.email = o2.email 
                    AND UPPER(TRIM(o1.name)) = UPPER(TRIM(o2.name))
                    AND o1.phone = o2.phone
                    AND o1.id != o2.id
                WHERE 
                    o1.team_id LIKE 'SSPSLT%'
                    AND o2.team_id NOT LIKE 'SSPSLT%'
            )
        """)
        
        deleted_count = cursor.rowcount
        print(f"✅ Deleted {deleted_count} duplicate record(s)")
        
        # Commit the transaction
        conn.commit()
        print("✅ Transaction committed\n")
        
        # Verify cleanup
        print("="*80)
        print("\n✅ STEP 3: Verifying Cleanup...\n")
        
        cursor.execute("""
            SELECT 
                owner_id,
                team_id,
                name,
                email,
                created_at
            FROM owners
            ORDER BY email, created_at
        """)
        
        remaining = cursor.fetchall()
        
        print(f"📊 Total owners in database: {len(remaining)}\n")
        
        # Group by email to check for any remaining duplicates
        email_counts = {}
        for row in remaining:
            email = row[3]
            email_counts[email] = email_counts.get(email, 0) + 1
        
        duplicates_remain = sum(1 for count in email_counts.values() if count > 1)
        
        if duplicates_remain > 0:
            print(f"⚠️  Warning: {duplicates_remain} email(s) still have multiple entries")
        else:
            print("✨ No duplicate emails found!")
        
        print("\n" + "="*80)
        print("\n🎉 SUCCESS! Cleanup completed!\n")
        print("Summary:")
        print(f"  • Deleted: {deleted_count} duplicate record(s)")
        print(f"  • Remaining: {len(remaining)} owner record(s)")
        print(f"  • Status: {'✅ Clean' if duplicates_remain == 0 else '⚠️  Review needed'}\n")
        
    except Exception as e:
        print(f"\n❌ Error during cleanup: {e}")
        conn.rollback()
        print("❌ Transaction rolled back")
        sys.exit(1)
        
    finally:
        cursor.close()
        conn.close()
        print("✅ Database connection closed\n")

if __name__ == "__main__":
    try:
        run_cleanup()
    except KeyboardInterrupt:
        print("\n\n⚠️  Cleanup cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        sys.exit(1)
