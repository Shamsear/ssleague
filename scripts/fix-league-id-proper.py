#!/usr/bin/env python3
"""Fix fantasy league_id to match teams and scoring rules"""

import os
import psycopg2
from dotenv import load_dotenv

load_dotenv('.env.local')

conn = psycopg2.connect(os.getenv('FANTASY_DATABASE_URL'))
cur = conn.cursor()

print("\n" + "="*80)
print("FIXING FANTASY LEAGUE_ID")
print("="*80)

# Check current state
cur.execute("SELECT id, league_id, season_id, is_active FROM fantasy_leagues")
leagues = cur.fetchall()
print(f"\nCurrent fantasy_leagues:")
for l in leagues:
    print(f"  PK: {l[0]}, League_ID: {l[1]}, Season: {l[2]}, Active: {l[3]}")

# The teams/rules use 'SSPSLFLS16' as league_id
# The fantasy_leagues table has league_id that should match
correct_league_id = 'SSPSLFLS16'

# Check what league_id is currently set
cur.execute("SELECT league_id FROM fantasy_leagues WHERE id = 1")
current_league_id = cur.fetchone()[0]
print(f"\nCurrent league_id in fantasy_leagues: {current_league_id}")
print(f"League_id used by teams/rules: {correct_league_id}")

if current_league_id != correct_league_id:
    print(f"\n→ Updating fantasy_leagues.league_id to: {correct_league_id}")
    cur.execute("""
        UPDATE fantasy_leagues
        SET league_id = %s
        WHERE id = 1
    """, (correct_league_id,))
    print(f"✓ Updated")
    conn.commit()
else:
    print(f"\n✓ League_id already matches!")

# Verify
print("\n" + "="*80)
print("VERIFICATION")
print("="*80)

cur.execute("SELECT id, league_id, season_id FROM fantasy_leagues WHERE id = 1")
league = cur.fetchone()
print(f"\nFantasy League:")
print(f"  PK: {league[0]}, League_ID: {league[1]}, Season: {league[2]}")

cur.execute(f"SELECT COUNT(*) FROM fantasy_teams WHERE league_id = '{league[1]}'")
teams_count = cur.fetchone()[0]
print(f"\nTeams in league {league[1]}: {teams_count}")

cur.execute(f"SELECT COUNT(*) FROM fantasy_scoring_rules WHERE league_id = '{league[1]}'")
rules_count = cur.fetchone()[0]
print(f"Scoring rules in league {league[1]}: {rules_count}")

cur.execute(f"SELECT COUNT(*) FROM fantasy_squad WHERE league_id = '{league[1]}'")
squad_count = cur.fetchone()[0]
print(f"Drafted players in league {league[1]}: {squad_count}")

cur.close()
conn.close()

print("\n✅ Fix complete - league_id now matches across all tables!")
