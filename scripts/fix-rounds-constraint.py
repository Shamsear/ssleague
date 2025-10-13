#!/usr/bin/env python3
"""
Fix rounds table status constraint
"""

import os
import sys
from urllib.parse import urlparse
import psycopg2
from dotenv import load_dotenv

load_dotenv('.env.local')

def fix_constraint():
    """Fix the rounds table status constraint"""
    
    print("🔍 Checking rounds table constraints...\n")
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
        
        # Check current constraint
        cursor.execute("""
            SELECT conname, pg_get_constraintdef(oid) as constraint_def
            FROM pg_constraint
            WHERE conrelid = 'rounds'::regclass
              AND contype = 'c'
              AND conname LIKE '%status%';
        """)
        
        constraints = cursor.fetchall()
        
        print("📋 Current status constraints:\n")
        for con in constraints:
            print(f"   {con[0]}: {con[1]}")
        
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
        print("✅ Added new constraint with values: draft, scheduled, active, completed, tiebreaker, cancelled")
        
        # Commit
        conn.commit()
        print("\n✅ Transaction committed\n")
        
        # Verify
        cursor.execute("""
            SELECT conname, pg_get_constraintdef(oid) as constraint_def
            FROM pg_constraint
            WHERE conrelid = 'rounds'::regclass
              AND contype = 'c'
              AND conname = 'rounds_status_check';
        """)
        
        result = cursor.fetchone()
        
        print("="*80)
        print("\n✅ Verification:\n")
        if result:
            print(f"   Constraint: {result[0]}")
            print(f"   Definition: {result[1]}\n")
        
        print("="*80)
        print("\n🎉 SUCCESS! Constraint fixed!\n")
        print("You can now create rounds with status='draft'\n")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        conn.rollback()
        sys.exit(1)
        
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    try:
        fix_constraint()
    except KeyboardInterrupt:
        print("\n\n⚠️  Cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        sys.exit(1)
