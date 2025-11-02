import os
import psycopg2
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Base points by star rating
STAR_RATING_BASE_POINTS = {
    3: 100,
    4: 120,
    5: 145,
    6: 175,
    7: 210,
    8: 250,
    9: 300,
    10: 375,
}

def fix_player_points(season_id):
    """Fix player points based on star rating + goal difference"""
    
    # Get database connection string
    db_url = os.getenv('NEON_TOURNAMENT_DB_URL') or os.getenv('DATABASE_URL') or os.getenv('NEON_DATABASE_URL')
    
    if not db_url:
        print("❌ DATABASE_URL or NEON_DATABASE_URL not found in environment")
        return
    
    print(f"Connecting to database...")
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    try:
        # Get all players for this season
        cur.execute("""
            SELECT 
                id,
                player_id,
                player_name,
                star_rating,
                matches_played,
                goals_scored,
                goals_conceded,
                points as old_points
            FROM player_seasons
            WHERE season_id = %s
            ORDER BY player_name
        """, (season_id,))
        
        players = cur.fetchall()
        print(f"\n📊 Found {len(players)} players in season {season_id}\n")
        
        updates = []
        
        for player in players:
            (id, player_id, player_name, star_rating, matches_played, 
             goals_scored, goals_conceded, old_points) = player
            
            # Get base points from star rating
            star_rating = star_rating or 3
            base_points = STAR_RATING_BASE_POINTS.get(star_rating, 100)
            
            # Calculate points from matches
            matches_played = matches_played or 0
            total_points_change = 0
            
            if matches_played > 0:
                total_gd = (goals_scored or 0) - (goals_conceded or 0)
                # Average GD per match, capped at ±5
                avg_gd_per_match = total_gd / matches_played
                points_per_match = max(-5, min(5, avg_gd_per_match))
                total_points_change = round(points_per_match * matches_played)
            
            new_points = base_points + total_points_change
            
            # Update player
            cur.execute("""
                UPDATE player_seasons
                SET points = %s,
                    updated_at = NOW()
                WHERE id = %s
            """, (new_points, id))
            
            gd = (goals_scored or 0) - (goals_conceded or 0)
            change = new_points - (old_points or 0)
            symbol = "✅" if change != 0 else "  "
            
            print(f"{symbol} {player_name[:30]:30} | {star_rating}★ | "
                  f"Base: {base_points:3} | GD: {gd:+3} | "
                  f"Old: {old_points or 0:3} → New: {new_points:3} "
                  f"({change:+3})")
            
            updates.append({
                'player_name': player_name,
                'old_points': old_points or 0,
                'new_points': new_points,
                'change': change
            })
        
        # Commit changes
        conn.commit()
        
        print(f"\n✅ Successfully updated {len(updates)} players")
        
        # Summary
        changed = [u for u in updates if u['change'] != 0]
        if changed:
            print(f"\n📝 Summary: {len(changed)} players had point changes")
            total_change = sum(u['change'] for u in changed)
            print(f"   Total point change: {total_change:+d}")
        
    except Exception as e:
        conn.rollback()
        print(f"\n❌ Error: {e}")
        raise
    finally:
        cur.close()
        conn.close()
        print("\n🔌 Database connection closed")

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python fix_player_points.py <season_id>")
        print("Example: python fix_player_points.py 16")
        sys.exit(1)
    
    season_id = sys.argv[1]
    print(f"🔧 Fixing player points for season {season_id}...\n")
    fix_player_points(season_id)
