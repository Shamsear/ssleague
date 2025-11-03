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
    
    # Tables we want to check for auction system
    auction_tables = ['rounds', 'bids', 'tiebreakers', 'team_tiebreakers', 'teams', 'bulk_rounds', 'bulk_tiebreakers']
    
    print("=" * 80)
    print("AUCTION SYSTEM TABLES CHECK")
    print("=" * 80 + "\n")
    
    for table_name in auction_tables:
        # Check if table exists
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = %s
            );
        """, (table_name,))
        
        table_exists = cursor.fetchone()[0]
        
        if not table_exists:
            print(f"❌ Table '{table_name}' does NOT exist\n")
            continue
            
        print(f"✅ Table: {table_name}")
        print("-" * 80)
        
        # Get column information
        cursor.execute("""
            SELECT 
                column_name, 
                data_type, 
                character_maximum_length,
                is_nullable,
                column_default
            FROM information_schema.columns
            WHERE table_name = %s
            ORDER BY ordinal_position;
        """, (table_name,))
        
        columns = cursor.fetchall()
        print(f"\n📋 Columns ({len(columns)}):")
        for col in columns:
            col_name, data_type, max_length, nullable, default = col
            length_info = f"({max_length})" if max_length else ""
            null_info = "NULL" if nullable == 'YES' else "NOT NULL"
            default_info = f" DEFAULT {default}" if default else ""
            print(f"   • {col_name:<30} {data_type}{length_info:<20} {null_info}{default_info}")
        
        # Get primary key
        cursor.execute("""
            SELECT a.attname
            FROM pg_index i
            JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
            WHERE i.indrelid = %s::regclass AND i.indisprimary;
        """, (table_name,))
        
        pk_columns = cursor.fetchall()
        if pk_columns:
            pk_names = ", ".join([col[0] for col in pk_columns])
            print(f"\n🔑 Primary Key: {pk_names}")
        
        # Get foreign keys
        cursor.execute("""
            SELECT
                kcu.column_name,
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
                ON ccu.constraint_name = tc.constraint_name
                AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY'
                AND tc.table_name = %s;
        """, (table_name,))
        
        fk_columns = cursor.fetchall()
        if fk_columns:
            print(f"\n🔗 Foreign Keys:")
            for fk in fk_columns:
                print(f"   • {fk[0]} → {fk[1]}.{fk[2]}")
        
        # Get row count
        cursor.execute(f"SELECT COUNT(*) FROM {table_name};")
        count = cursor.fetchone()[0]
        print(f"\n📊 Row Count: {count}")
        
        # If there are rows, show sample data
        if count > 0:
            cursor.execute(f"SELECT * FROM {table_name} LIMIT 3;")
            sample_rows = cursor.fetchall()
            col_names = [desc[0] for desc in cursor.description]
            
            print(f"\n📄 Sample Data (first 3 rows):")
            for i, row in enumerate(sample_rows, 1):
                print(f"\n   Row {i}:")
                for col_name, value in zip(col_names, row):
                    # Truncate long values
                    str_value = str(value)
                    if len(str_value) > 50:
                        str_value = str_value[:47] + "..."
                    print(f"      {col_name}: {str_value}")
        
        print("\n" + "=" * 80 + "\n")
    
    cursor.close()
    conn.close()
    
    print("✅ Auction tables check completed!")
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
