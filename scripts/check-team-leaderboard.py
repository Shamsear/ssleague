#!/usr/bin/env python3
"""
Check team leaderboard data and debug issues
"""

import os
import psycopg2
from dotenv import load_dotenv
from tabulate import tabulate

# Load environment variables
load_dotenv('.env.local')

def check_team_leaderboard():
    """Check team stats and leaderboard data"""
    
    db_url = os.getenv('NEON_TOURNAMENT_DB_URL')
    
    if not db_url:
        print("❌ Error: NEON_TOURNAMENT_DB_URL not found in .env.local")
        return False
    
    print("🔍 Checking team leaderboard data...\n")
    
    try:
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        
        # Check if teamstats table exists
        print("1️⃣ Checking if teamstats table exists...")
        cur.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'teamstats'
            );
        """)
        table_exists = cur.fetchone()[0]
        
        if not table_exists:
            print("   ❌ teamstats table does NOT exist!")
            print("   💡 You need to create the teamstats table first")
            return False
        
        print("   ✅ teamstats table exists\n")
        
        # Check teamstats columns
        print("2️⃣ Checking teamstats table structure...")
        cur.execute("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'teamstats'
            ORDER BY ordinal_position;
        """)
        columns = cur.fetchall()
        print(f"   Found {len(columns)} columns:")
        for col in columns:
            print(f"      - {col[0]}: {col[1]}")
        print()
        
        # Count total team stats records
        print("3️⃣ Counting team stats records...")
        cur.execute("SELECT COUNT(*) FROM teamstats;")
        total_count = cur.fetchone()[0]
        print(f"   Total team stats records: {total_count}\n")
        
        if total_count == 0:
            print("   ⚠️  No team stats found!")
            print("   💡 Team stats are created when match results are saved")
            print("   💡 Make sure you've saved at least one match result\n")
        
        # Get active seasons
        print("4️⃣ Checking active seasons...")
        cur.execute("""
            SELECT DISTINCT season_id 
            FROM teamstats 
            ORDER BY season_id DESC 
            LIMIT 5;
        """)
        seasons = cur.fetchall()
        
        if seasons:
            print(f"   Found team stats for {len(seasons)} season(s):")
            for season in seasons:
                print(f"      - {season[0]}")
            print()
            
            # Show team stats for the first season
            latest_season = seasons[0][0]
            print(f"5️⃣ Team stats for season: {latest_season}")
            
            cur.execute("""
                SELECT 
                    team_name,
                    matches_played,
                    wins,
                    draws,
                    losses,
                    goals_for,
                    goals_against,
                    goal_difference,
                    points
                FROM teamstats
                WHERE season_id = %s
                ORDER BY points DESC, goal_difference DESC
                LIMIT 20;
            """, (latest_season,))
            
            team_stats = cur.fetchall()
            
            if team_stats:
                headers = ['Team', 'P', 'W', 'D', 'L', 'GF', 'GA', 'GD', 'Pts']
                print(f"\n   📊 Leaderboard ({len(team_stats)} teams):")
                print(tabulate(team_stats, headers=headers, tablefmt='pretty'))
            else:
                print("   ❌ No team stats found for this season")
        else:
            print("   ⚠️  No seasons found with team stats\n")
        
        # Check tournaments
        print("\n6️⃣ Checking tournaments...")
        cur.execute("""
            SELECT DISTINCT tournament_id 
            FROM teamstats 
            ORDER BY tournament_id DESC 
            LIMIT 5;
        """)
        tournaments = cur.fetchall()
        
        if tournaments:
            print(f"   Found team stats for {len(tournaments)} tournament(s):")
            for t in tournaments:
                print(f"      - {t[0]}")
        else:
            print("   ⚠️  No tournaments found")
        
        # Check recent updates
        print("\n7️⃣ Checking recent updates...")
        cur.execute("""
            SELECT 
                team_name,
                season_id,
                updated_at
            FROM teamstats
            ORDER BY updated_at DESC
            LIMIT 5;
        """)
        recent = cur.fetchall()
        
        if recent:
            print("   Last updated teams:")
            for r in recent:
                print(f"      - {r[0]} ({r[1]}) - {r[2]}")
        
        cur.close()
        conn.close()
        
        print("\n" + "="*60)
        print("📝 Summary:")
        print("="*60)
        
        if total_count > 0:
            print("✅ Team stats exist in database")
            print("✅ Team leaderboard should be working")
            print("\n💡 If leaderboard is still not showing:")
            print("   1. Check browser console for errors")
            print("   2. Verify selectedTournamentId in TournamentContext")
            print("   3. Make sure you're viewing the correct season")
        else:
            print("⚠️  No team stats found")
            print("\n💡 To populate team stats:")
            print("   1. Go to a fixture page")
            print("   2. Enter match results")
            print("   3. Save the results")
            print("   4. Team stats will be automatically created")
        
        return True
        
    except psycopg2.Error as e:
        print(f"\n❌ Database error: {e}")
        return False
    except Exception as e:
        print(f"\n❌ Error: {e}")
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("Team Leaderboard Data Check")
    print("=" * 60)
    print()
    
    check_team_leaderboard()
