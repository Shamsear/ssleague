#!/usr/bin/env python3
"""
Fix player_seasons stats that were added 3 times
Divides matches_played, goals, wins, draws, losses by 3
"""

import os
import psycopg2
from dotenv import load_dotenv

# Load environment variables
load_dotenv('.env.local')

def fix_tripled_stats():
    """Fix stats that were added 3 times"""
    
    db_url = os.getenv('NEON_TOURNAMENT_DB_URL')
    
    if not db_url:
        print("❌ Error: NEON_TOURNAMENT_DB_URL not found in .env.local")
        return False
    
    print("🔧 Fixing tripled player stats...\n")
    
    try:
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        
        # Step 1: Find players with stats (matches_played > 0)
        print("1️⃣ Finding players with stats...")
        cur.execute("""
            SELECT 
                id,
                player_name,
                season_id,
                matches_played,
                goals_scored,
                goals_conceded,
                wins,
                draws,
                losses,
                clean_sheets,
                motm_awards
            FROM player_seasons
            WHERE matches_played > 0
            ORDER BY matches_played DESC;
        """)
        
        players = cur.fetchall()
        print(f"   Found {len(players)} players with stats\n")
        
        if len(players) == 0:
            print("   No players to fix!")
            return True
        
        # Step 2: Show current stats
        print("2️⃣ Current stats (BEFORE fix):")
        print("   " + "-" * 100)
        print(f"   {'Player':<20} {'Season':<12} {'MP':<4} {'G':<4} {'GC':<4} {'W':<3} {'D':<3} {'L':<3} {'CS':<3} {'MOTM':<4}")
        print("   " + "-" * 100)
        for p in players[:15]:  # Show first 15
            print(f"   {p[1]:<20} {p[2]:<12} {p[3]:<4} {p[4]:<4} {p[5]:<4} {p[6]:<3} {p[7]:<3} {p[8]:<3} {p[9]:<3} {p[10]:<4}")
        if len(players) > 15:
            print(f"   ... and {len(players) - 15} more players")
        print()
        
        # Step 3: Ask for confirmation
        print("3️⃣ Fix method: Divide all stats by 3")
        response = input("\n   Do you want to proceed? (yes/no): ").strip().lower()
        
        if response != 'yes':
            print("   ❌ Operation cancelled")
            return False
        
        print("\n4️⃣ Fixing stats...")
        fixed_count = 0
        
        for player in players:
            player_id = player[0]
            
            # Divide by 3 (use integer division)
            new_matches = player[3] // 3
            new_goals_scored = player[4] // 3
            new_goals_conceded = player[5] // 3
            new_wins = player[6] // 3
            new_draws = player[7] // 3
            new_losses = player[8] // 3
            new_clean_sheets = player[9] // 3
            new_motm = player[10] // 3
            
            # Recalculate points: (Wins × 3) + (Draws × 1) + (MOTM × 3) + (Goals × 1)
            new_points = (new_wins * 3) + (new_draws * 1) + (new_motm * 3) + (new_goals_scored * 1)
            
            # Update the player
            cur.execute("""
                UPDATE player_seasons
                SET
                    matches_played = %s,
                    goals_scored = %s,
                    goals_conceded = %s,
                    wins = %s,
                    draws = %s,
                    losses = %s,
                    clean_sheets = %s,
                    motm_awards = %s,
                    points = %s,
                    updated_at = NOW()
                WHERE id = %s;
            """, (
                new_matches,
                new_goals_scored,
                new_goals_conceded,
                new_wins,
                new_draws,
                new_losses,
                new_clean_sheets,
                new_motm,
                new_points,
                player_id
            ))
            
            fixed_count += 1
            if fixed_count % 10 == 0:
                print(f"   Fixed {fixed_count}/{len(players)} players...")
        
        conn.commit()
        print(f"   ✅ Fixed {fixed_count} players\n")
        
        # Step 4: Show fixed stats
        print("5️⃣ Fixed stats (AFTER fix):")
        print("   " + "-" * 100)
        print(f"   {'Player':<20} {'Season':<12} {'MP':<4} {'G':<4} {'GC':<4} {'W':<3} {'D':<3} {'L':<3} {'CS':<3} {'MOTM':<4}")
        print("   " + "-" * 100)
        
        cur.execute("""
            SELECT 
                player_name,
                season_id,
                matches_played,
                goals_scored,
                goals_conceded,
                wins,
                draws,
                losses,
                clean_sheets,
                motm_awards
            FROM player_seasons
            WHERE matches_played > 0
            ORDER BY matches_played DESC
            LIMIT 15;
        """)
        
        fixed_players = cur.fetchall()
        for p in fixed_players:
            print(f"   {p[0]:<20} {p[1]:<12} {p[2]:<4} {p[3]:<4} {p[4]:<4} {p[5]:<3} {p[6]:<3} {p[7]:<3} {p[8]:<3} {p[9]:<4}")
        
        cur.close()
        conn.close()
        
        print("\n" + "="*60)
        print("✅ Stats fixed successfully!")
        print("="*60)
        print("\n📝 What was done:")
        print("   - All stats divided by 3 (matches, goals, wins, etc.)")
        print("   - Points recalculated based on new values")
        print("   - Now each match counts only once!")
        
        return True
        
    except psycopg2.Error as e:
        print(f"\n❌ Database error: {e}")
        if conn:
            conn.rollback()
        return False
    except Exception as e:
        print(f"\n❌ Error: {e}")
        if conn:
            conn.rollback()
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("Fix Tripled Player Stats")
    print("=" * 60)
    print()
    
    success = fix_tripled_stats()
    
    if success:
        exit(0)
    else:
        exit(1)
