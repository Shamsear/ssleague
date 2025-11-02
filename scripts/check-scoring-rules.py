#!/usr/bin/env python3
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv('.env.local')

conn = psycopg2.connect(os.getenv('FANTASY_DATABASE_URL'))
cur = conn.cursor()

cur.execute("""
    SELECT rule_type, rule_name, points_value, applies_to, is_active
    FROM fantasy_scoring_rules 
    WHERE league_id = 'SSPSLFLS16' 
    ORDER BY applies_to, rule_type
""")

rules = cur.fetchall()
print("\nScoring Rules in league SSPSLFLS16:")
print(f"{'Rule Type':<25} {'Points':<8} {'Applies To':<15} {'Active'}")
print("-" * 70)
for r in rules:
    applies_to = r[3] or 'player'
    print(f"{r[0]:<25} {r[2]:<8} {applies_to:<15} {r[4]}")

cur.close()
conn.close()
