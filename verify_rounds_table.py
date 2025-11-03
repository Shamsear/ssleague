import os
import psycopg2
from dotenv import load_dotenv

load_dotenv('.env.local')
DATABASE_URL = os.getenv('NEON_DATABASE_URL')

conn = psycopg2.connect(DATABASE_URL)
cursor = conn.cursor()

cursor.execute("""
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns 
    WHERE table_name = 'rounds' 
    ORDER BY ordinal_position;
""")

print("ROUNDS TABLE STRUCTURE:")
print("-" * 80)
for row in cursor.fetchall():
    nullable = "NULL" if row[2] == 'YES' else "NOT NULL"
    default = f" DEFAULT {row[3]}" if row[3] else ""
    print(f"{row[0]:<25} {row[1]:<30} {nullable}{default}")

cursor.close()
conn.close()
