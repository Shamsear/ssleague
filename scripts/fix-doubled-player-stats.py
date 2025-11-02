#!/usr/bin/env python3
"""Fix doubled player stats by dividing by 2"""

import os
import psycopg2
from dotenv import load_dotenv

load_dotenv('.env.local')

conn = psycopg2.connect(os.getenv('NEON_TOURNAMENT_DB_URL'))
cur = conn.cursor()

print("\n" + "="*60)
print("FIXING DOUBLED PLAYER STATS")
print("="*60)

# Get all players with matches > 0
cur.execute("""
    SELECT id, player_name, matches_played, goals_scored, goals_conceded, 
           wins, draws, losses, clean_sheets, motm_awards, points, processed_fixtures
    FROM player_seasons
    WHERE matches_played > 0
""")

players = cur.fetchall()
print(f"\nFound {len(players)} players with match data")
print("\nDividing all stats by 2...\n")

updated_count = 0
for p in players:
    player_id, name, mp, goals, conceded, wins, draws, losses, cs, motm, points, proc_fix = p
    
    # Divide all stats by 2
    new_mp = mp // 2
    new_goals = goals // 2
    new_conceded = conceded // 2
    new_wins = wins // 2
    new_draws = draws // 2
    new_losses = losses // 2
    new_cs = cs // 2
    new_motm = motm // 2
    new_points = points // 2
    
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
        WHERE id = %s
    """, (new_mp, new_goals, new_conceded, new_wins, new_draws, new_losses, new_cs, new_motm, new_points, player_id))
    
    print(f"✓ {name:<20} MP: {mp}→{new_mp}, Goals: {goals}→{new_goals}, W/D/L: {wins}/{draws}/{losses}→{new_wins}/{new_draws}/{new_losses}")
    updated_count += 1

conn.commit()
print(f"\n✅ Updated {updated_count} players")

# Show verification
print("\n" + "="*60)
print("VERIFICATION - Sample stats after fix:")
print("="*60)

cur.execute("""
    SELECT 
        player_name,
        matches_played,
        goals_scored,
        wins,
        draws,
        losses,
        processed_fixtures
    FROM player_seasons
    WHERE matches_played > 0
    ORDER BY matches_played DESC
    LIMIT 10
""")

stats = cur.fetchall()
print(f"\n{'Player':<20} {'MP':<4} {'Goals':<6} {'W':<3} {'D':<3} {'L':<3} {'Proc Fixtures'}")
print("-" * 80)
for s in stats:
    proc_fixtures = len(s[6]) if s[6] else 0
    print(f"{s[0]:<20} {s[1]:<4} {s[2]:<6} {s[3]:<3} {s[4]:<3} {s[5]:<3} {proc_fixtures}")

cur.close()
conn.close()

print("\n✅ Fix complete - stats should now match processed fixtures count")
