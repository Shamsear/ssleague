#!/usr/bin/env python3
"""
Fix tiebreaker status - Mark tiebreakers as resolved when their rounds are finalized
"""
import os
import sys
from datetime import datetime

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv

load_dotenv()

def main():
    try:
        # Use neon database URL
        import psycopg2
        from psycopg2.extras import RealDictCursor
        
        db_url = os.getenv('NEON_DATABASE_URL') or os.getenv('DATABASE_URL')
        if not db_url:
            print("❌ No database URL found in environment")
            return
        
        print("🔗 Connecting to database...")
        conn = psycopg2.connect(db_url)
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        print("\n" + "=" * 70)
        print("STEP 1: Find rounds with resolved status but active tiebreakers")
        print("=" * 70)
        
        cur.execute("""
            SELECT 
                r.id as round_id,
                r.status as round_status,
                r.season_id,
                COUNT(t.id) as active_tiebreaker_count
            FROM rounds r
            LEFT JOIN tiebreakers t ON r.id = t.round_id AND t.status = 'active'
            WHERE r.status IN ('finalized', 'completed')
            GROUP BY r.id, r.status, r.season_id
            HAVING COUNT(t.id) > 0
            ORDER BY r.created_at DESC
        """)
        
        stuck_rounds = cur.fetchall()
        
        if not stuck_rounds:
            print("✅ No stuck rounds found - all tiebreakers are in sync")
        else:
            print(f"⚠️  Found {len(stuck_rounds)} rounds with active tiebreakers despite being finalized:")
            for round_data in stuck_rounds:
                print(f"   Round {round_data['round_id']}: {round_data['active_tiebreaker_count']} active tiebreaker(s)")
        
        print("\n" + "=" * 70)
        print("STEP 2: Find tiebreakers in finalized/completed rounds")
        print("=" * 70)
        
        cur.execute("""
            SELECT 
                t.id as tiebreaker_id,
                t.player_name,
                t.status as tiebreaker_status,
                t.round_id,
                r.status as round_status,
                r.season_id
            FROM tiebreakers t
            INNER JOIN rounds r ON t.round_id = r.id
            WHERE t.status = 'active'
            AND r.status IN ('finalized', 'completed')
            ORDER BY t.created_at DESC
        """)
        
        stuck_tiebreakers = cur.fetchall()
        
        if not stuck_tiebreakers:
            print("✅ No stuck tiebreakers found")
        else:
            print(f"⚠️  Found {len(stuck_tiebreakers)} tiebreakers that should be resolved:")
            for tb in stuck_tiebreakers:
                print(f"   TB {tb['tiebreaker_id']}: {tb['player_name']} in round {tb['round_id']} ({tb['round_status']})")
        
        if not stuck_tiebreakers:
            print("\n✅ All tiebreakers are properly synchronized")
            cur.close()
            conn.close()
            return
        
        print("\n" + "=" * 70)
        print("STEP 3: Fix stuck tiebreakers")
        print("=" * 70)
        
        response = input(f"\n⚠️  Fix {len(stuck_tiebreakers)} stuck tiebreaker(s)? (yes/no): ")
        if response.lower() not in ['yes', 'y']:
            print("❌ Aborted by user")
            cur.close()
            conn.close()
            return
        
        fixed_count = 0
        for tb in stuck_tiebreakers:
            tiebreaker_id = tb['tiebreaker_id']
            
            # Mark as cancelled since round is already finalized
            cur.execute("""
                UPDATE tiebreakers
                SET 
                    status = 'cancelled',
                    updated_at = NOW()
                WHERE id = %s
            """, (tiebreaker_id,))
            
            # Also update team_tiebreakers
            cur.execute("""
                UPDATE team_tiebreakers
                SET 
                    submitted = true,
                    submitted_at = NOW()
                WHERE tiebreaker_id = %s
                AND submitted = false
            """, (tiebreaker_id,))
            
            print(f"   ✅ Fixed tiebreaker {tiebreaker_id} ({tb['player_name']})")
            fixed_count += 1
        
        conn.commit()
        print(f"\n✅ Successfully fixed {fixed_count} tiebreaker(s)")
        
        print("\n" + "=" * 70)
        print("STEP 4: Verification")
        print("=" * 70)
        
        cur.execute("""
            SELECT COUNT(*) as count
            FROM tiebreakers t
            INNER JOIN rounds r ON t.round_id = r.id
            WHERE t.status = 'active'
            AND r.status IN ('finalized', 'completed')
        """)
        
        remaining = cur.fetchone()['count']
        if remaining == 0:
            print("✅ All tiebreakers are now properly synchronized")
        else:
            print(f"⚠️  {remaining} tiebreaker(s) still need attention")
        
        cur.close()
        conn.close()
        print("\n✅ Done!")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    main()
