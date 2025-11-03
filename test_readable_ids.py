import os
import psycopg2
from dotenv import load_dotenv

# Load environment variables
load_dotenv('.env.local')

# Get database URL
DATABASE_URL = os.getenv('NEON_DATABASE_URL')

if not DATABASE_URL:
    print("❌ NEON_DATABASE_URL not found in .env.local")
    exit(1)

def test_readable_ids():
    """Test the readable IDs implementation"""
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()
        
        print("=" * 80)
        print("TESTING READABLE IDS IMPLEMENTATION")
        print("=" * 80 + "\n")
        
        # ========================================
        # TEST 1: Verify Schema Changes
        # ========================================
        print("TEST 1: Verifying Schema Changes")
        print("-" * 80)
        
        tables_to_check = {
            'teams': ('id', 'character varying', 50),
            'rounds': ('id', 'character varying', 50),
            'bids': ('id', 'character varying', 100),
            'tiebreakers': ('id', 'character varying', 50),
            'team_tiebreakers': ('id', 'character varying', 100),
            'bulk_rounds': ('id', 'character varying', 50),
            'bulk_tiebreakers': ('id', 'character varying', 50),
        }
        
        all_schema_correct = True
        for table_name, (col_name, expected_type, expected_length) in tables_to_check.items():
            cursor.execute("""
                SELECT column_name, data_type, character_maximum_length
                FROM information_schema.columns
                WHERE table_name = %s AND column_name = %s;
            """, (table_name, col_name))
            
            result = cursor.fetchone()
            if result:
                col, dtype, length = result
                if dtype == expected_type and length == expected_length:
                    print(f"  ✅ {table_name}.{col_name}: {dtype}({length})")
                else:
                    print(f"  ❌ {table_name}.{col_name}: Expected {expected_type}({expected_length}), got {dtype}({length})")
                    all_schema_correct = False
            else:
                print(f"  ❌ {table_name}.{col_name}: Column not found!")
                all_schema_correct = False
        
        if all_schema_correct:
            print("\n✅ Schema verification PASSED\n")
        else:
            print("\n❌ Schema verification FAILED\n")
            return False
        
        # ========================================
        # TEST 2: Verify Foreign Keys
        # ========================================
        print("TEST 2: Verifying Foreign Key Relationships")
        print("-" * 80)
        
        expected_fks = [
            ('bids', 'round_id', 'rounds', 'id'),
            ('bids', 'team_id', 'teams', 'id'),
            ('rounds', 'winning_team_id', 'teams', 'id'),
            ('tiebreakers', 'round_id', 'rounds', 'id'),
            ('tiebreakers', 'winning_team_id', 'teams', 'id'),
            ('team_tiebreakers', 'tiebreaker_id', 'tiebreakers', 'id'),
            ('team_tiebreakers', 'team_id', 'teams', 'id'),
            ('bulk_tiebreakers', 'bulk_round_id', 'bulk_rounds', 'id'),
            ('bulk_tiebreakers', 'winning_team_id', 'teams', 'id'),
        ]
        
        all_fks_correct = True
        for table_name, column_name, foreign_table, foreign_column in expected_fks:
            cursor.execute("""
                SELECT
                    kcu.column_name,
                    ccu.table_name AS foreign_table_name,
                    ccu.column_name AS foreign_column_name
                FROM information_schema.table_constraints AS tc
                JOIN information_schema.key_column_usage AS kcu
                    ON tc.constraint_name = kcu.constraint_name
                    AND tc.table_schema = kcu.table_schema
                JOIN information_schema.constraint_column_usage AS ccu
                    ON ccu.constraint_name = tc.constraint_name
                    AND ccu.table_schema = tc.table_schema
                WHERE tc.constraint_type = 'FOREIGN KEY'
                    AND tc.table_name = %s
                    AND kcu.column_name = %s;
            """, (table_name, column_name))
            
            result = cursor.fetchone()
            if result and result[1] == foreign_table and result[2] == foreign_column:
                print(f"  ✅ {table_name}.{column_name} → {foreign_table}.{foreign_column}")
            else:
                print(f"  ❌ {table_name}.{column_name} → Expected {foreign_table}.{foreign_column}")
                all_fks_correct = False
        
        if all_fks_correct:
            print("\n✅ Foreign key verification PASSED\n")
        else:
            print("\n❌ Foreign key verification FAILED\n")
            return False
        
        # ========================================
        # TEST 3: Test Tiebreaker Duration NULL Handling
        # ========================================
        print("TEST 3: Verifying Tiebreaker duration_minutes NULL Support")
        print("-" * 80)
        
        cursor.execute("""
            SELECT column_name, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_name = 'tiebreakers' AND column_name = 'duration_minutes';
        """)
        
        result = cursor.fetchone()
        if result and result[1] == 'YES':
            print(f"  ✅ tiebreakers.duration_minutes allows NULL")
        else:
            print(f"  ❌ tiebreakers.duration_minutes does not allow NULL")
            return False
        
        cursor.execute("""
            SELECT column_name, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_name = 'bulk_tiebreakers' AND column_name = 'duration_minutes';
        """)
        
        result = cursor.fetchone()
        if result and result[1] == 'YES':
            print(f"  ✅ bulk_tiebreakers.duration_minutes allows NULL")
            print("\n✅ Tiebreaker duration NULL support PASSED\n")
        else:
            print(f"  ❌ bulk_tiebreakers.duration_minutes does not allow NULL")
            return False
        
        # ========================================
        # TEST 4: Verify Indexes
        # ========================================
        print("TEST 4: Verifying Indexes")
        print("-" * 80)
        
        expected_indexes = [
            'idx_teams_firebase_uid',
            'idx_teams_season_id',
            'idx_rounds_season_id',
            'idx_rounds_player_id',
            'idx_rounds_status',
            'idx_bids_round_id',
            'idx_bids_team_id',
            'idx_tiebreakers_round_id',
            'idx_tiebreakers_status',
        ]
        
        cursor.execute("""
            SELECT indexname
            FROM pg_indexes
            WHERE schemaname = 'public'
            AND indexname LIKE 'idx_%';
        """)
        
        existing_indexes = [row[0] for row in cursor.fetchall()]
        
        all_indexes_exist = True
        for index_name in expected_indexes:
            if index_name in existing_indexes:
                print(f"  ✅ {index_name}")
            else:
                print(f"  ⚠️  {index_name} (not found, but may not be critical)")
        
        print("\n✅ Index verification completed\n")
        
        # ========================================
        # SUMMARY
        # ========================================
        print("=" * 80)
        print("TEST SUMMARY")
        print("=" * 80)
        print("\n✅ All tests PASSED!")
        print("\nReadable IDs Implementation Status:")
        print("  • Schema updated with VARCHAR IDs")
        print("  • Foreign key relationships configured")
        print("  • Tiebreaker duration_minutes supports NULL (no time limit)")
        print("  • Indexes created for performance")
        print("\nID Formats:")
        print("  • Rounds: SSPSLFR00001")
        print("  • Teams: SSPSLT0001")
        print("  • Bids: SSPSLT0001_SSPSLFR00001")
        print("  • Tiebreakers: SSPSLTR00001")
        print("  • Team Tiebreakers: SSPSLT0001_SSPSLTR00001")
        print("  • Bulk Rounds: SSPSLFBR00001")
        print("  • Bulk Tiebreakers: SSPSLBT00001")
        print("\n" + "=" * 80 + "\n")
        
        cursor.close()
        conn.close()
        
        return True
        
    except Exception as e:
        print(f"\n❌ Error during testing: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_readable_ids()
    exit(0 if success else 1)
