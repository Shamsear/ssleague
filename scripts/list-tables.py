#!/usr/bin/env python3
import os
import sys
from urllib.parse import urlparse
import psycopg2
from dotenv import load_dotenv

load_dotenv('.env.local')

db_url = os.getenv('NEON_DATABASE_URL')
result = urlparse(db_url)
conn = psycopg2.connect(
    host=result.hostname,
    port=result.port or 5432,
    database=result.path[1:],
    user=result.username,
    password=result.password,
    sslmode='require'
)
cursor = conn.cursor()
cursor.execute("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename")
tables = cursor.fetchall()
print("Tables in database:")
for table in tables:
    print(f"  - {table[0]}")
conn.close()
