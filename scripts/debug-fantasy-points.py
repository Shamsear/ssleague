#!/usr/bin/env python3
"""Debug fantasy points calculation"""

import os
import psycopg2
from dotenv import load_dotenv

load_dotenv('.env.local')

fantasy_url = os.getenv('FANTASY_DATABASE_URL')
if not fantasy_url:
    print("❌ FANTASY_DATABASE_URL not set in .env.local")
    exit(1)

fantasy_conn = psycopg2.connect(fantasy_url)
fantasy_cur = fantasy_conn.cursor()

tournament_conn = psycopg2.connect(os.getenv('NEON_TOURNAMENT_DB_URL'))
tournament_cur = tournament_conn.cursor()

print("\n" + "="*80)
print("FANTASY POINTS CALCULATION DEBUG")
print("="*80)

# 1. Check if fantasy league exists and is active
print("\n1. FANTASY LEAGUES:")
fantasy_cur.execute("""
    SELECT id, season_id, is_active
    FROM fantasy_leagues
    ORDER BY created_at DESC
    LIMIT 5
""")
leagues = fantasy_cur.fetchall()
for league in leagues:
    print(f"  - League: {league[0]} (Season: {league[1]}, Active: {league[2]})")

if not leagues:
    print("  ❌ No fantasy leagues found!")
else:
    active_league = next((l for l in leagues if l[2]), None)
    if not active_league:
        print("\n  ⚠️ No ACTIVE fantasy league found!")
    else:
        league_id = str(active_league[0])
        print(f"\n  ✓ Active league: {league_id}")
        
        # 2. Check scoring rules
        print("\n2. SCORING RULES:")
        fantasy_cur.execute("""
            SELECT rule_type, points_value, is_active
            FROM fantasy_scoring_rules
            WHERE league_id = %s
            ORDER BY rule_type
        """, (league_id,))
        rules = fantasy_cur.fetchall()
        if rules:
            for rule in rules:
                print(f"  - {rule[0]}: {rule[1]} pts (Active: {rule[2]})")
        else:
            print("  ⚠️ No scoring rules found (will use defaults)")
        
        # 3. Check fantasy teams
        print("\n3. FANTASY TEAMS:")
        fantasy_cur.execute("""
            SELECT id, team_name, total_points
            FROM fantasy_teams
            WHERE league_id = %s
        """, (league_id,))
        teams = fantasy_cur.fetchall()
        print(f"  Found {len(teams)} teams:")
        for team in teams[:5]:
            print(f"  - {team[1]}: {team[0]} (Total: {team[2]} pts)")
        
        # 4. Check fantasy squads (drafted players)
        print("\n4. FANTASY SQUADS (DRAFTED PLAYERS):")
        fantasy_cur.execute("""
            SELECT fs.team_id, ft.team_name, fs.real_player_id, fs.player_name, COUNT(*) as draft_count
            FROM fantasy_squad fs
            JOIN fantasy_teams ft ON fs.team_id = ft.id
            WHERE fs.league_id = %s
            GROUP BY fs.team_id, ft.team_name, fs.real_player_id, fs.player_name
            LIMIT 10
        """, (league_id,))
        squads = fantasy_cur.fetchall()
        if squads:
            print(f"  Found {len(squads)} drafted player entries:")
            for sq in squads[:10]:
                print(f"  - Team: {sq[1]}, Player: {sq[3]} ({sq[2]})")
        else:
            print("  ❌ No players drafted yet!")
        
        # 5. Check recent fixtures with matchups
        print("\n5. RECENT FIXTURES WITH MATCHUPS:")
        tournament_cur.execute("""
            SELECT f.id, f.season_id, f.round_number, f.status, 
                   COUNT(m.id) as matchup_count,
                   f.motm_player_id
            FROM fixtures f
            LEFT JOIN matchups m ON f.id = m.fixture_id
            WHERE f.season_id = %s
            GROUP BY f.id, f.season_id, f.round_number, f.status, f.motm_player_id
            ORDER BY f.created_at DESC
            LIMIT 5
        """, (active_league[1],))
        fixtures = tournament_cur.fetchall()
        if fixtures:
            for fix in fixtures:
                print(f"  - Fixture {fix[0]}: Round {fix[2]}, Status: {fix[3]}, Matchups: {fix[4]}, MOTM: {fix[5] or 'None'}")
        else:
            print("  ⚠️ No fixtures found for this season")
        
        # 6. Check fantasy player points
        print("\n6. FANTASY PLAYER POINTS CALCULATED:")
        fantasy_cur.execute("""
            SELECT fixture_id, player_name, total_points, calculated_at
            FROM fantasy_player_points
            WHERE league_id = %s
            ORDER BY calculated_at DESC
            LIMIT 10
        """, (league_id,))
        points = fantasy_cur.fetchall()
        if points:
            print(f"  Found {len(points)} point records:")
            for pt in points[:5]:
                print(f"  - Fixture {pt[0]}: {pt[1]} = {pt[2]} pts (at {pt[3]})")
        else:
            print("  ❌ No fantasy points calculated yet!")

fantasy_cur.close()
fantasy_conn.close()
tournament_cur.close()
tournament_conn.close()

print("\n" + "="*80)
print("✅ Debug complete")
print("="*80)
