#!/usr/bin/env python3
"""
Fix rounds table - update invalid status values then fix constraint
"""

import os
import sys
from urllib.parse import urlparse
import psycopg2
from dotenv import load_dotenv

load_dotenv('.env.local')

def fix_status():
    """Fix the rounds table status values and constraint"""
    
    print("🔍 Fixing rounds table status values...\n")
    print("="*80)
    
    db_url = os.getenv('NEON_DATABASE_URL') or os.getenv('DATABASE_URL')
    
    if not db_url:
        print("❌ Error: No database connection string found!")
        sys.exit(1)
    
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
        
        conn = psycopg2.connect(**conn_params)
        conn.autocommit = False
        cursor = conn.cursor()
        print("✅ Connected to database\n")
        
        # Check current status values
        cursor.execute("""
            SELECT id, status, round_type 
            FROM rounds 
            ORDER BY created_at DESC 
            LIMIT 10;
        """)
        
        rows = cursor.fetchall()
        
        print("📋 Current rounds (last 10):\n")
        if rows:
            for row in rows:
                print(f"   ID: {row[0][:8]}... | Status: {row[1]} | Type: {row[2]}")
        else:
            print("   No rounds found")
        
        # Check for invalid statuses
        cursor.execute("""
            SELECT DISTINCT status 
            FROM rounds 
            ORDER BY status;
        """)
        
        statuses = cursor.fetchall()
        
        print("\n📊 All status values in table:\n")
        for status in statuses:
            print(f"   - {status[0]}")
        
        print("\n" + "="*80)
        print("\n🔧 Updating invalid status values...\n")
        
        # Update 'finalizing' to 'completed'
        cursor.execute("""
            UPDATE rounds 
            SET status = 'completed' 
            WHERE status = 'finalizing';
        """)
        updated = cursor.rowcount
        if updated > 0:
            print(f"✅ Updated {updated} rows: 'finalizing' → 'completed'")
        
        # Update any other invalid statuses to 'active' by default
        cursor.execute("""
            UPDATE rounds 
            SET status = 'active' 
            WHERE status NOT IN ('active', 'completed', 'tiebreaker', 'cancelled', 'draft', 'scheduled');
        """)
        updated = cursor.rowcount
        if updated > 0:
            print(f"✅ Updated {updated} rows with invalid status → 'active'")
        
        print("\n" + "="*80)
        print("\n🔧 Fixing constraint...\n")
        
        # Drop old constraint
        cursor.execute("""
            ALTER TABLE rounds DROP CONSTRAINT IF EXISTS rounds_status_check;
        """)
        print("✅ Dropped old constraint")
        
        # Add new constraint with correct values
        cursor.execute("""
            ALTER TABLE rounds
            ADD CONSTRAINT rounds_status_check
            CHECK (status IN ('draft', 'scheduled', 'active', 'completed', 'tiebreaker', 'cancelled'));
        """)
        print("✅ Added new constraint")
        print("   Allowed values: draft, scheduled, active, completed, tiebreaker, cancelled")
        
        # Commit
        conn.commit()
        print("\n✅ Transaction committed\n")
        
        # Verify
        cursor.execute("""
            SELECT status, COUNT(*) 
            FROM rounds 
            GROUP BY status 
            ORDER BY status;
        """)
        
        results = cursor.fetchall()
        
        print("="*80)
        print("\n✅ Final status distribution:\n")
        for result in results:
            print(f"   {result[0]}: {result[1]} rounds")
        
        print("\n" + "="*80)
        print("\n🎉 SUCCESS! Status values and constraint fixed!\n")
        print("You can now create rounds with any allowed status value.\n")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        conn.rollback()
        sys.exit(1)
        
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    try:
        fix_status()
    except KeyboardInterrupt:
        print("\n\n⚠️  Cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        sys.exit(1)
