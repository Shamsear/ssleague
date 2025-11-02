import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

db_url = os.getenv('NEON_TOURNAMENT_DB_URL')
conn = psycopg2.connect(db_url)
cur = conn.cursor()

# Get team balances
cur.execute("""
    SELECT team_id, real_player_budget, real_player_starting_balance
    FROM team_seasons 
    WHERE season_id = 'SSPSLS16' 
    ORDER BY team_id
""")

print("\n📊 Team Balances (Season SSPSLS16):\n")
print(f"{'Team ID':<15} {'Current Balance':<20} {'Starting Balance':<20} {'Spent':<15}")
print("-" * 70)

for row in cur.fetchall():
    team_id, current, starting = row
    starting = starting or 5000  # default if null
    spent = starting - (current or 0)
    print(f"{team_id:<15} ${current or 0:<19.2f} ${starting:<19.2f} ${spent:<14.2f}")

print()

# Check if there are any salary payment transactions
cur.execute("""
    SELECT COUNT(*) FROM transactions 
    WHERE season_id = 'SSPSLS16' 
    AND transaction_type = 'salary_payment'
    AND currency_type = 'real_player'
""")

salary_count = cur.fetchone()[0]
print(f"💰 Salary payment transactions found: {salary_count}")

if salary_count > 0:
    cur.execute("""
        SELECT team_id, SUM(ABS(amount)) as total_salaries
        FROM transactions 
        WHERE season_id = 'SSPSLS16' 
        AND transaction_type = 'salary_payment'
        AND currency_type = 'real_player'
        GROUP BY team_id
        ORDER BY team_id
    """)
    
    print("\n💵 Total Salaries Deducted:\n")
    for row in cur.fetchall():
        print(f"  {row[0]}: ${row[1]:.2f}")

cur.close()
conn.close()
