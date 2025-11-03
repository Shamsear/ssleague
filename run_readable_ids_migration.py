import os
import psycopg2
from dotenv import load_dotenv

# Load environment variables
load_dotenv('.env.local')

# Get database URL
DATABASE_URL = os.getenv('NEON_DATABASE_URL')

if not DATABASE_URL:
    print("❌ NEON_DATABASE_URL not found in .env.local")
    exit(1)

try:
    # Connect to database
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()
    
    print("✅ Connected to Neon database successfully!\n")
    print("=" * 80)
    print("RUNNING READABLE IDS MIGRATION")
    print("=" * 80 + "\n")
    
    # Read migration SQL file
    migration_file = 'database/migrations/readable-ids-migration.sql'
    print(f"📄 Reading migration file: {migration_file}\n")
    
    with open(migration_file, 'r') as f:
        migration_sql = f.read()
    
    # Execute migration
    print("⚙️  Executing migration...\n")
    cursor.execute(migration_sql)
    conn.commit()
    
    print("✅ Migration executed successfully!\n")
    print("=" * 80)
    print("VERIFYING MIGRATION")
    print("=" * 80 + "\n")
    
    # Verify the new schema
    tables_to_check = ['teams', 'rounds', 'bids', 'tiebreakers', 'team_tiebreakers', 'bulk_rounds', 'bulk_tiebreakers']
    
    for table_name in tables_to_check:
        cursor.execute("""
            SELECT 
                column_name, 
                data_type, 
                character_maximum_length
            FROM information_schema.columns
            WHERE table_name = %s AND column_name = 'id';
        """, (table_name,))
        
        result = cursor.fetchone()
        if result:
            col_name, data_type, max_length = result
            print(f"✅ {table_name}.id: {data_type}({max_length})")
        else:
            print(f"❌ {table_name}: ID column not found!")
    
    print("\n" + "=" * 80)
    print("MIGRATION COMPLETE!")
    print("=" * 80)
    print("\nAll tables now use readable IDs:")
    print("  • Rounds: SSPSLFR00001")
    print("  • Teams: SSPSLT0001")
    print("  • Bids: SSPSLT0001_SSPSLFR00001")
    print("  • Tiebreakers: SSPSLTR00001")
    print("  • Team Tiebreakers: SSPSLT0001_SSPSLTR00001")
    print("  • Bulk Rounds: SSPSLFBR00001")
    print("  • Bulk Tiebreakers: SSPSLBT00001\n")
    
    cursor.close()
    conn.close()
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
    if 'conn' in locals():
        conn.rollback()
