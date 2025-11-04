#!/usr/bin/env python3
"""
Check tiebreakers status in the database
"""
from dotenv import load_dotenv
import os
import psycopg2

load_dotenv()

def main():
    conn = psycopg2.connect(os.getenv('DATABASE_URL'))
    cur = conn.cursor()
    
    print("=" * 60)
    print("BULK TIEBREAKERS STATUS")
    print("=" * 60)
    cur.execute("""
        SELECT id, player_name, status, bulk_round_id, created_at 
        FROM bulk_tiebreakers 
        ORDER BY created_at DESC 
        LIMIT 10
    """)
    rows = cur.fetchall()
    for r in rows:
        print(f"  ID: {r[0]}, Player: {r[1]}, Status: {r[2]}, Round: {r[3]}, Created: {r[4]}")
    
    print("\n" + "=" * 60)
    print("ACTIVE REGULAR TIEBREAKERS")
    print("=" * 60)
    cur.execute("""
        SELECT id, player_name, status, round_id, created_at 
        FROM tiebreakers 
        WHERE status = 'active' 
        ORDER BY created_at DESC 
        LIMIT 10
    """)
    rows = cur.fetchall()
    if rows:
        for r in rows:
            print(f"  ID: {r[0]}, Player: {r[1]}, Status: {r[2]}, Round: {r[3]}, Created: {r[4]}")
    else:
        print("  No active regular tiebreakers")
    
    print("\n" + "=" * 60)
    print("ROUNDS STATUS")
    print("=" * 60)
    cur.execute("""
        SELECT id, status, round_type, created_at 
        FROM rounds 
        ORDER BY created_at DESC 
        LIMIT 10
    """)
    rows = cur.fetchall()
    for r in rows:
        print(f"  ID: {r[0]}, Status: {r[1]}, Type: {r[2]}, Created: {r[3]}")
    
    cur.close()
    conn.close()

if __name__ == '__main__':
    main()
