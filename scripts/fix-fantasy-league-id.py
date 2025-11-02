#!/usr/bin/env python3
"""Fix fantasy league ID to match teams and scoring rules"""

import os
import psycopg2
from dotenv import load_dotenv

load_dotenv('.env.local')

conn = psycopg2.connect(os.getenv('FANTASY_DATABASE_URL'))
cur = conn.cursor()

print("\n" + "="*80)
print("FIXING FANTASY LEAGUE ID MISMATCH")
print("="*80)

# Check current state
cur.execute("SELECT id, season_id, is_active FROM fantasy_leagues")
leagues = cur.fetchall()
print(f"\nCurrent fantasy_leagues:")
for l in leagues:
    print(f"  ID: {l[0]}, Season: {l[1]}, Active: {l[2]}")

# The fantasy_leagues.id is integer (1), but teams/rules use 'SSPSLFLS16'
# We need to update teams/rules to use league_id '1' instead
correct_league_id = '1'
wrong_league_id = 'SSPSLFLS16'

print(f"\n→ Updating teams, rules, and squads from '{wrong_league_id}' to '{correct_league_id}'")

# Update fantasy_teams
cur.execute("""
    UPDATE fantasy_teams
    SET league_id = %s
    WHERE league_id = %s
""", (correct_league_id, wrong_league_id))
print(f"✓ Updated {cur.rowcount} teams")

# Update fantasy_scoring_rules
cur.execute("""
    UPDATE fantasy_scoring_rules
    SET league_id = %s
    WHERE league_id = %s
""", (correct_league_id, wrong_league_id))
print(f"✓ Updated {cur.rowcount} scoring rules")

# Update fantasy_squad
cur.execute("""
    UPDATE fantasy_squad
    SET league_id = %s
    WHERE league_id = %s
""", (correct_league_id, wrong_league_id))
print(f"✓ Updated {cur.rowcount} squad entries")

conn.commit()

# Verify
print("\n" + "="*80)
print("VERIFICATION")
print("="*80)

cur.execute("SELECT id, season_id, is_active FROM fantasy_leagues")
leagues = cur.fetchall()
print(f"\nUpdated fantasy_leagues:")
for l in leagues:
    print(f"  ID: {l[0]}, Season: {l[1]}, Active: {l[2]}")

cur.execute(f"SELECT COUNT(*) FROM fantasy_teams WHERE league_id = '{correct_league_id}'")
teams_count = cur.fetchone()[0]
print(f"\nTeams in league {correct_league_id}: {teams_count}")

cur.execute(f"SELECT COUNT(*) FROM fantasy_scoring_rules WHERE league_id = '{correct_league_id}'")
rules_count = cur.fetchone()[0]
print(f"Scoring rules in league {correct_league_id}: {rules_count}")

cur.execute(f"SELECT COUNT(*) FROM fantasy_squad WHERE league_id = '{correct_league_id}'")
squad_count = cur.fetchone()[0]
print(f"Drafted players in league {correct_league_id}: {squad_count}")

cur.close()
conn.close()

print("\n✅ Fix complete - league ID now matches!")
