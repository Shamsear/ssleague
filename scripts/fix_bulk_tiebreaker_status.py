#!/usr/bin/env python3
"""
Fix bulk tiebreaker status - Mark bulk tiebreakers as resolved when their rounds are completed
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv

# Load from .env.local first, then .env
load_dotenv('.env.local')
load_dotenv()

def main():
    try:
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
        print("STEP 1: Find bulk rounds with active bulk tiebreakers")
        print("=" * 70)
        
        cur.execute("""
            SELECT 
                r.id as round_id,
                r.round_number,
                r.status as round_status,
                r.season_id,
                COUNT(bt.id) as active_tiebreaker_count
            FROM rounds r
            LEFT JOIN bulk_tiebreakers bt ON r.id = bt.bulk_round_id 
                AND bt.status IN ('active', 'ongoing')
            WHERE r.round_type = 'bulk'
            AND r.status IN ('finalized', 'completed')
            GROUP BY r.id, r.round_number, r.status, r.season_id
            HAVING COUNT(bt.id) > 0
            ORDER BY r.created_at DESC
        """)
        
        stuck_rounds = cur.fetchall()
        
        if not stuck_rounds:
            print("✅ No stuck rounds found - all bulk tiebreakers are in sync")
        else:
            print(f"⚠️  Found {len(stuck_rounds)} bulk rounds with active tiebreakers despite being completed:")
            for round_data in stuck_rounds:
                print(f"   Round {round_data['round_id']} (#{round_data['round_number']}): {round_data['active_tiebreaker_count']} active tiebreaker(s)")
        
        print("\n" + "=" * 70)
        print("STEP 2: Find bulk tiebreakers in completed rounds")
        print("=" * 70)
        
        cur.execute("""
            SELECT 
                bt.id as tiebreaker_id,
                bt.player_name,
                bt.player_position,
                bt.status as tiebreaker_status,
                bt.bulk_round_id,
                bt.current_highest_team_id,
                bt.current_highest_bid,
                bt.base_price,
                r.status as round_status,
                r.round_number,
                r.season_id
            FROM bulk_tiebreakers bt
            INNER JOIN rounds r ON bt.bulk_round_id = r.id
            WHERE bt.status IN ('active', 'ongoing')
            AND r.status IN ('finalized', 'completed')
            ORDER BY bt.created_at DESC
        """)
        
        stuck_tiebreakers = cur.fetchall()
        
        if not stuck_tiebreakers:
            print("✅ No stuck bulk tiebreakers found")
        else:
            print(f"⚠️  Found {len(stuck_tiebreakers)} bulk tiebreakers that should be resolved:")
            for tb in stuck_tiebreakers:
                winner_info = f"Winner: {tb['current_highest_team_id']} @ £{tb['current_highest_bid']}" if tb['current_highest_team_id'] else "No winner"
                print(f"   TB {tb['tiebreaker_id']}: {tb['player_name']} ({tb['player_position']}) in round #{tb['round_number']} - {winner_info}")
        
        if not stuck_tiebreakers:
            print("\n✅ All bulk tiebreakers are properly synchronized")
            cur.close()
            conn.close()
            return
        
        print("\n" + "=" * 70)
        print("STEP 3: Analyze tiebreakers")
        print("=" * 70)
        
        with_winner = [tb for tb in stuck_tiebreakers if tb['current_highest_team_id']]
        without_winner = [tb for tb in stuck_tiebreakers if not tb['current_highest_team_id']]
        
        print(f"   {len(with_winner)} tiebreaker(s) have a winner (can be auto-finalized)")
        print(f"   {len(without_winner)} tiebreaker(s) have no winner (will be cancelled)")
        
        print("\n" + "=" * 70)
        print("STEP 4: Fix stuck bulk tiebreakers")
        print("=" * 70)
        
        response = input(f"\n⚠️  Fix {len(stuck_tiebreakers)} stuck bulk tiebreaker(s)? (yes/no): ")
        if response.lower() not in ['yes', 'y']:
            print("❌ Aborted by user")
            cur.close()
            conn.close()
            return
        
        fixed_count = 0
        finalized_count = 0
        cancelled_count = 0
        
        for tb in stuck_tiebreakers:
            tiebreaker_id = tb['tiebreaker_id']
            
            if tb['current_highest_team_id']:
                # Has winner - mark as resolved
                print(f"   ✅ Resolving {tiebreaker_id} - Winner: {tb['current_highest_team_id']}")
                
                # Update bulk_tiebreakers
                cur.execute("""
                    UPDATE bulk_tiebreakers
                    SET 
                        status = 'resolved',
                        resolved_at = NOW(),
                        updated_at = NOW()
                    WHERE id = %s
                """, (tiebreaker_id,))
                
                # Also update the corresponding tiebreakers table entry
                cur.execute("""
                    UPDATE tiebreakers
                    SET 
                        status = 'resolved',
                        winning_team_id = %s,
                        winning_bid = %s,
                        updated_at = NOW()
                    WHERE id = %s
                """, (tb['current_highest_team_id'], tb['current_highest_bid'], tiebreaker_id))
                
                # Update bulk_tiebreaker_teams for the winner
                cur.execute("""
                    UPDATE bulk_tiebreaker_teams
                    SET 
                        status = 'winner'
                    WHERE tiebreaker_id = %s
                    AND team_id = %s
                """, (tiebreaker_id, tb['current_highest_team_id']))
                
                # Mark other teams as withdrawn in bulk_tiebreaker_teams
                cur.execute("""
                    UPDATE bulk_tiebreaker_teams
                    SET 
                        status = 'withdrawn',
                        withdrawn_at = NOW()
                    WHERE tiebreaker_id = %s
                    AND team_id != %s
                    AND status = 'active'
                """, (tiebreaker_id, tb['current_highest_team_id']))
                
                # Also mark other teams in team_tiebreakers as submitted
                cur.execute("""
                    UPDATE team_tiebreakers
                    SET 
                        submitted = true,
                        submitted_at = NOW()
                    WHERE tiebreaker_id = %s
                    AND team_id != %s
                    AND submitted = false
                """, (tiebreaker_id, tb['current_highest_team_id']))
                
                finalized_count += 1
            else:
                # No winner - cancel it
                print(f"   ⚠️  Cancelling {tiebreaker_id} - No winner")
                
                # Update bulk_tiebreakers
                cur.execute("""
                    UPDATE bulk_tiebreakers
                    SET 
                        status = 'cancelled',
                        updated_at = NOW()
                    WHERE id = %s
                """, (tiebreaker_id,))
                
                # Also update tiebreakers table
                cur.execute("""
                    UPDATE tiebreakers
                    SET 
                        status = 'cancelled',
                        updated_at = NOW()
                    WHERE id = %s
                """, (tiebreaker_id,))
                
                # Mark all teams as withdrawn in bulk_tiebreaker_teams
                cur.execute("""
                    UPDATE bulk_tiebreaker_teams
                    SET 
                        status = 'withdrawn',
                        withdrawn_at = NOW()
                    WHERE tiebreaker_id = %s
                    AND status = 'active'
                """, (tiebreaker_id,))
                
                # Mark all teams in team_tiebreakers as submitted
                cur.execute("""
                    UPDATE team_tiebreakers
                    SET 
                        submitted = true,
                        submitted_at = NOW()
                    WHERE tiebreaker_id = %s
                    AND submitted = false
                """, (tiebreaker_id,))
                
                cancelled_count += 1
            
            fixed_count += 1
        
        conn.commit()
        print(f"\n✅ Successfully fixed {fixed_count} bulk tiebreaker(s)")
        print(f"   - Finalized: {finalized_count}")
        print(f"   - Cancelled: {cancelled_count}")
        
        print("\n" + "=" * 70)
        print("STEP 5: Verification")
        print("=" * 70)
        
        cur.execute("""
            SELECT COUNT(*) as count
            FROM bulk_tiebreakers bt
            INNER JOIN rounds r ON bt.bulk_round_id = r.id
            WHERE bt.status IN ('active', 'ongoing')
            AND r.status IN ('finalized', 'completed')
        """)
        
        remaining = cur.fetchone()['count']
        if remaining == 0:
            print("✅ All bulk tiebreakers are now properly synchronized")
        else:
            print(f"⚠️  {remaining} bulk tiebreaker(s) still need attention")
        
        cur.close()
        conn.close()
        print("\n✅ Done!")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    main()
