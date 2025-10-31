import os
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv
import json
from collections import defaultdict

# Load environment variables
load_dotenv('.env.local')

DATABASE_URL = os.getenv('NEON_DATABASE_URL')

def connect_db():
    """Connect to the database"""
    return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)

def audit_player_awards():
    """Audit player awards data structure"""
    conn = connect_db()
    cur = conn.cursor()
    
    print("\n" + "="*80)
    print("PLAYER AWARDS AUDIT REPORT")
    print("="*80 + "\n")
    
    # 0. Check which tables exist
    print("0. CHECKING EXISTING TABLES")
    print("-" * 80)
    cur.execute("""
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        AND (table_name LIKE '%award%' OR table_name LIKE '%player%' OR table_name = 'realplayerstats')
        ORDER BY table_name
    """)
    tables = cur.fetchall()
    print("  Relevant tables found:")
    for tbl in tables:
        print(f"    - {tbl['table_name']}")
    
    # Check if player_awards exists
    table_names = [t['table_name'] for t in tables]
    has_player_awards = 'player_awards' in table_names
    
    if not has_player_awards:
        print("\n  ⚠️  'player_awards' table does not exist!")
        print("  Checking for alternative award storage...\n")
    
    # 1. Check player_awards table structure (if exists)
    if has_player_awards:
        print("\n1. PLAYER_AWARDS TABLE STRUCTURE")
        print("-" * 80)
        cur.execute("""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'player_awards'
            ORDER BY ordinal_position
        """)
        columns = cur.fetchall()
        for col in columns:
            print(f"  {col['column_name']}: {col['data_type']} ({'NULL' if col['is_nullable'] == 'YES' else 'NOT NULL'})")
    
    # 2. Check player_awards data - sample records
    improper = []
    if has_player_awards:
        print("\n2. SAMPLE PLAYER AWARDS RECORDS (Recent 10)")
        print("-" * 80)
        cur.execute("""
            SELECT 
                pa.id,
                pa.player_id,
                pa.player_name,
                pa.season_id,
                pa.award_name,
                pa.award_position,
                pa.created_at
            FROM player_awards pa
            ORDER BY pa.created_at DESC
            LIMIT 10
        """)
        awards = cur.fetchall()
        for award in awards:
            print(f"  ID: {award['id']}, Player: {award['player_name']}, Season: {award['season_id']}")
            print(f"    Award: {award['award_name']}, Position: {award['award_position']}, Created: {award['created_at']}")
            print()
        
        # 3. Check for awards with combined name-position format
        print("3. CHECKING FOR IMPROPERLY FORMATTED AWARDS (name+position combined)")
        print("-" * 80)
        cur.execute("""
            SELECT 
                id,
                player_name,
                award_name,
                award_position
            FROM player_awards
            WHERE award_name LIKE '%Winner%' 
               OR award_name LIKE '%Runner%'
               OR award_name LIKE '%Champion%'
               OR award_position LIKE '%Winner%'
               OR award_position LIKE '%Runner%'
            LIMIT 20
        """)
        improper = cur.fetchall()
        if improper:
            print(f"  ⚠️  Found {len(improper)} potentially improperly formatted awards:")
            for item in improper:
                print(f"    ID {item['id']}: {item['player_name']} - Name: '{item['award_name']}', Position: '{item['award_position']}'")
        else:
            print("  ✅ No improperly formatted awards found")
    
    # 4. Check realplayerstats table structure for trophies
    print("\n4. REALPLAYERSTATS TABLE - TROPHY COLUMNS")
    print("-" * 80)
    cur.execute("""
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'realplayerstats'
        AND (column_name LIKE '%trophy%' OR column_name LIKE '%award%' OR column_name = 'category')
        ORDER BY ordinal_position
    """)
    trophy_cols = cur.fetchall()
    for col in trophy_cols:
        print(f"  {col['column_name']}: {col['data_type']}")
    
    # 5. Sample trophies JSONB data from realplayerstats
    print("\n5. SAMPLE TROPHIES FROM REALPLAYERSTATS (JSONB column)")
    print("-" * 80)
    cur.execute("""
        SELECT 
            player_id,
            season_id,
            category,
            trophies,
            motm_awards
        FROM realplayerstats
        WHERE trophies IS NOT NULL
        AND trophies::text != '[]'
        AND trophies::text != '{}'
        LIMIT 10
    """)
    stats = cur.fetchall()
    if stats:
        for stat in stats:
            print(f"  Player: {stat['player_id']}, Season: {stat['season_id']}, Category: {stat['category']}")
            print(f"    Trophies JSONB: {json.dumps(stat['trophies'], indent=6)}")
            print(f"    MOTM Awards: {stat['motm_awards']}")
            print()
    else:
        print("  ℹ️  No player stats with trophies found")
    
    # 6. Check player_season table for awards_count
    print("\n6. PLAYER_SEASON TABLE - AWARDS COUNT")
    print("-" * 80)
    cur.execute("""
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'player_season'
        AND column_name LIKE '%award%'
        ORDER BY ordinal_position
    """)
    award_cols = cur.fetchall()
    if award_cols:
        for col in award_cols:
            print(f"  {col['column_name']}: {col['data_type']}")
        
        # Get sample data
        print("\n  Sample records with awards_count:")
        cur.execute("""
            SELECT 
                player_id,
                season_id,
                awards_count
            FROM player_season
            WHERE awards_count > 0
            LIMIT 10
        """)
        ps_records = cur.fetchall()
        for rec in ps_records:
            print(f"    Player: {rec['player_id']}, Season: {rec['season_id']}, Awards Count: {rec['awards_count']}")
    else:
        print("  ℹ️  No awards_count column found in player_season table")
    
    # 7. Compare awards_count with actual player_awards count
    mismatches = []
    if has_player_awards and 'player_season' in table_names:
        print("\n7. AWARDS COUNT VALIDATION")
        print("-" * 80)
        cur.execute("""
            SELECT 
                ps.player_id,
                ps.season_id,
                ps.awards_count as stored_count,
                COUNT(pa.id) as actual_count,
                CASE 
                    WHEN ps.awards_count = COUNT(pa.id) THEN '✅ Match'
                    ELSE '❌ Mismatch'
                END as status
            FROM player_season ps
            LEFT JOIN player_awards pa ON pa.player_id = ps.player_id AND pa.season_id = ps.season_id
            GROUP BY ps.player_id, ps.season_id, ps.awards_count
            HAVING ps.awards_count != COUNT(pa.id) OR ps.awards_count > 0
            ORDER BY ps.awards_count DESC, ps.season_id DESC
            LIMIT 20
        """)
        mismatches = cur.fetchall()
        if mismatches:
            print(f"  Found {len(mismatches)} records with mismatched or non-zero awards count:")
            for mm in mismatches:
                print(f"    {mm['status']} Player: {mm['player_id']}, Season: {mm['season_id']}, Stored: {mm['stored_count']}, Actual: {mm['actual_count']}")
        else:
            print("  ✅ All awards counts match the actual player_awards records")
    else:
        print("\n7. AWARDS COUNT VALIDATION")
        print("-" * 80)
        print("  ⚠️  Cannot validate - player_awards or player_season table missing")
    
    # 8. Get active seasons
    print("\n8. ACTIVE SEASONS")
    print("-" * 80)
    cur.execute("""
        SELECT id, season_name, status
        FROM seasons
        WHERE status = 'active'
        ORDER BY id DESC
    """)
    active_seasons = cur.fetchall()
    if active_seasons:
        for season in active_seasons:
            print(f"  Season ID: {season['id']}, Name: {season['season_name']}, Status: {season['status']}")
            
            # Count awards for this season
            cur.execute("""
                SELECT COUNT(*) as count
                FROM player_awards
                WHERE season_id = %s
            """, (season['id'],))
            count = cur.fetchone()['count']
            print(f"    Total player awards: {count}")
    else:
        print("  ℹ️  No active seasons found")
    
    # 9. Summary and recommendations
    print("\n" + "="*80)
    print("SUMMARY & RECOMMENDATIONS")
    print("="*80)
    
    # Get total counts
    cur.execute("SELECT COUNT(*) as count FROM player_awards")
    total_awards = cur.fetchone()['count']
    
    cur.execute("""
        SELECT COUNT(*) as count 
        FROM realplayerstats 
        WHERE trophies IS NOT NULL 
        AND trophies::text != '[]'
        AND trophies::text != '{}'
    """)
    stats_with_trophies = cur.fetchone()['count']
    
    print(f"\n📊 Statistics:")
    print(f"  - Total player awards (player_awards table): {total_awards}")
    print(f"  - Player stats with trophies JSONB: {stats_with_trophies}")
    
    print(f"\n💡 Recommendations:")
    if len(improper) > 0:
        print(f"  1. ⚠️  Fix {len(improper)} improperly formatted awards (separate name from position)")
    else:
        print(f"  1. ✅ Player awards are properly structured with separate name/position columns")
    
    if len(mismatches) > 0:
        print(f"  2. ⚠️  Sync {len(mismatches)} player_season records with actual awards count")
    else:
        print(f"  2. ✅ Awards counts are synchronized")
    
    if stats_with_trophies > 0:
        print(f"  3. ℹ️  Review trophies JSONB structure in realplayerstats for consistency")
        print(f"     Consider migrating to separate columns if format varies")
    
    print("\n")
    
    cur.close()
    conn.close()

if __name__ == '__main__':
    audit_player_awards()
