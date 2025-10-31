import os
import psycopg2
from dotenv import load_dotenv

# Load environment variables
load_dotenv('.env.local')

DATABASE_URL = os.getenv('NEON_DATABASE_URL')

def run_migration():
    """Run the player_awards table migration"""
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    print("\n" + "="*80)
    print("CREATING PLAYER_AWARDS TABLE")
    print("="*80 + "\n")
    
    # Read the SQL file
    with open('scripts/create_player_awards_table.sql', 'r') as f:
        sql = f.read()
    
    try:
        # Execute the migration
        cur.execute(sql)
        conn.commit()
        
        print("✅ Migration completed successfully!")
        print("\nCreated:")
        print("  - player_awards table")
        print("  - Indexes on player_id, season_id")
        print("  - Updated_at trigger")
        print("  - awards_count column in player_season (if not exists)")
        print("  - player_awards_summary view")
        
        # Verify table exists
        cur.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_name = 'player_awards'
        """)
        result = cur.fetchone()
        
        if result:
            print("\n✅ Verification: player_awards table exists")
            
            # Show table structure
            cur.execute("""
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns
                WHERE table_name = 'player_awards'
                ORDER BY ordinal_position
            """)
            columns = cur.fetchall()
            print("\nTable structure:")
            for col in columns:
                nullable = "NULL" if col[2] == 'YES' else "NOT NULL"
                print(f"  - {col[0]}: {col[1]} ({nullable})")
        else:
            print("\n❌ Verification failed: table not found")
            
    except Exception as e:
        conn.rollback()
        print(f"\n❌ Migration failed: {e}")
        raise
    finally:
        cur.close()
        conn.close()
    
    print("\n" + "="*80 + "\n")

if __name__ == '__main__':
    run_migration()
