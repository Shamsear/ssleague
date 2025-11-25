#!/usr/bin/env python3
"""
Migration script to add manual finalization support for auction rounds.

This script:
1. Adds finalization_mode column to rounds table
2. Creates pending_allocations table with proper indexes
3. Verifies all changes were applied successfully
4. Provides rollback instructions if needed

Usage:
    python migrations/run_manual_finalization_migration.py

Requirements:
    - psycopg2 or psycopg2-binary
    - DATABASE_URL or NEON_DATABASE_URL environment variable set
"""

import os
import sys
from datetime import datetime

try:
    import psycopg2
    from psycopg2 import sql
except ImportError:
    print("❌ Error: psycopg2 is not installed")
    print("Install it with: pip install psycopg2-binary")
    sys.exit(1)


def get_database_url():
    """Get database URL from environment variables."""
    db_url = os.getenv('DATABASE_URL') or os.getenv('NEON_DATABASE_URL')
    if not db_url:
        print("❌ Error: DATABASE_URL or NEON_DATABASE_URL environment variable not set")
        sys.exit(1)
    return db_url


def run_migration():
    """Run the manual finalization migration."""
    print("=" * 60)
    print("Manual Finalization Migration")
    print("=" * 60)
    print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()

    db_url = get_database_url()
    
    try:
        # Connect to database
        print("📡 Connecting to database...")
        conn = psycopg2.connect(db_url)
        conn.autocommit = False  # Use transactions
        cursor = conn.cursor()
        print("✓ Connected successfully")
        print()

        # Step 1: Check if migration already applied
        print("🔍 Checking if migration already applied...")
        cursor.execute("""
            SELECT EXISTS (
                SELECT 1 
                FROM information_schema.columns 
                WHERE table_name = 'rounds' 
                AND column_name = 'finalization_mode'
            )
        """)
        column_exists = cursor.fetchone()[0]
        
        cursor.execute("""
            SELECT EXISTS (
                SELECT 1 
                FROM information_schema.tables 
                WHERE table_name = 'pending_allocations'
            )
        """)
        table_exists = cursor.fetchone()[0]
        
        if column_exists and table_exists:
            print("⚠️  Migration already applied - skipping")
            print("   - rounds.finalization_mode column exists")
            print("   - pending_allocations table exists")
            conn.close()
            return True
        print("✓ Migration not yet applied - proceeding")
        print()

        # Step 2: Add finalization_mode column
        print("📝 Step 1: Adding finalization_mode column to rounds table...")
        cursor.execute("""
            ALTER TABLE rounds 
            ADD COLUMN IF NOT EXISTS finalization_mode VARCHAR(20) DEFAULT 'auto'
        """)
        print("✓ Column added successfully")
        print()

        # Step 3: Create pending_allocations table
        print("📝 Step 2: Creating pending_allocations table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS pending_allocations (
                id SERIAL PRIMARY KEY,
                round_id INTEGER NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
                team_id VARCHAR(255) NOT NULL,
                team_name VARCHAR(255) NOT NULL,
                player_id VARCHAR(255) NOT NULL,
                player_name VARCHAR(255) NOT NULL,
                amount INTEGER NOT NULL,
                bid_id VARCHAR(255),
                phase VARCHAR(20) NOT NULL,
                created_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(round_id, team_id)
            )
        """)
        print("✓ Table created successfully")
        print()

        # Step 4: Create indexes
        print("📝 Step 3: Creating indexes...")
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_pending_allocations_round 
            ON pending_allocations(round_id)
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_pending_allocations_team 
            ON pending_allocations(team_id)
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_pending_allocations_player 
            ON pending_allocations(player_id)
        """)
        print("✓ Indexes created successfully")
        print()

        # Step 5: Add comments
        print("📝 Step 4: Adding table and column comments...")
        cursor.execute("""
            COMMENT ON COLUMN rounds.finalization_mode IS 
            'Controls finalization behavior: "auto" (auto-finalize on expiry) or "manual" (requires preview and manual approval)'
        """)
        cursor.execute("""
            COMMENT ON TABLE pending_allocations IS 
            'Stores preview finalization results before they are applied. Allows committee admins to review allocations before making them official.'
        """)
        print("✓ Comments added successfully")
        print()

        # Step 6: Verify changes
        print("🔍 Step 5: Verifying migration...")
        
        # Verify column
        cursor.execute("""
            SELECT column_name, data_type, column_default
            FROM information_schema.columns
            WHERE table_name = 'rounds' AND column_name = 'finalization_mode'
        """)
        column_info = cursor.fetchone()
        if column_info:
            print(f"✓ rounds.finalization_mode: {column_info[1]} (default: {column_info[2]})")
        else:
            raise Exception("Failed to verify finalization_mode column")
        
        # Verify table
        cursor.execute("""
            SELECT COUNT(*) 
            FROM information_schema.columns 
            WHERE table_name = 'pending_allocations'
        """)
        column_count = cursor.fetchone()[0]
        print(f"✓ pending_allocations table: {column_count} columns")
        
        # Verify indexes
        cursor.execute("""
            SELECT indexname 
            FROM pg_indexes 
            WHERE tablename = 'pending_allocations'
            ORDER BY indexname
        """)
        indexes = cursor.fetchall()
        print(f"✓ Indexes created: {len(indexes)}")
        for idx in indexes:
            print(f"  - {idx[0]}")
        print()

        # Step 7: Check existing rounds
        print("📊 Checking existing rounds...")
        cursor.execute("""
            SELECT COUNT(*) FROM rounds
        """)
        round_count = cursor.fetchone()[0]
        print(f"✓ Found {round_count} existing rounds")
        print(f"  All existing rounds will default to 'auto' finalization mode")
        print()

        # Commit transaction
        print("💾 Committing changes...")
        conn.commit()
        print("✓ Migration committed successfully")
        print()

        # Close connection
        cursor.close()
        conn.close()

        print("=" * 60)
        print("✅ Migration completed successfully!")
        print("=" * 60)
        print()
        print("Summary:")
        print("  - Added finalization_mode column to rounds table")
        print("  - Created pending_allocations table")
        print("  - Created 3 indexes for performance")
        print(f"  - {round_count} existing rounds set to 'auto' mode")
        print()
        print("Next steps:")
        print("  1. Deploy backend API changes")
        print("  2. Deploy frontend changes")
        print("  3. Test with a manual finalization round")
        print()
        
        return True

    except psycopg2.Error as e:
        print(f"❌ Database error: {e}")
        print()
        if conn:
            print("🔄 Rolling back changes...")
            conn.rollback()
            print("✓ Rollback completed")
        return False
    
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        print()
        if conn:
            print("🔄 Rolling back changes...")
            conn.rollback()
            print("✓ Rollback completed")
        return False
    
    finally:
        if conn:
            conn.close()


def print_rollback_instructions():
    """Print instructions for rolling back the migration."""
    print()
    print("=" * 60)
    print("Rollback Instructions")
    print("=" * 60)
    print()
    print("If you need to rollback this migration, run these SQL commands:")
    print()
    print("-- Drop pending_allocations table")
    print("DROP TABLE IF EXISTS pending_allocations CASCADE;")
    print()
    print("-- Remove finalization_mode column")
    print("ALTER TABLE rounds DROP COLUMN IF EXISTS finalization_mode;")
    print()
    print("=" * 60)


if __name__ == "__main__":
    print()
    success = run_migration()
    
    if success:
        print_rollback_instructions()
        sys.exit(0)
    else:
        print()
        print("❌ Migration failed - no changes were applied")
        print()
        sys.exit(1)
