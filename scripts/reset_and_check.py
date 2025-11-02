import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

# Base points by star rating
STAR_RATING_BASE_POINTS = {
    3: 100,
    4: 120,
    5: 145,
    6: 175,
    7: 210,
    8: 250,
    9: 300,
    10: 375,
}

def reset_player_seasons():
    """Reset player seasons to 0 stats and base points"""
    
    db_url = os.getenv('NEON_TOURNAMENT_DB_URL')
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    season_id = 'SSPSLS16'
    
    print(f"\n🔄 Resetting player_seasons for season {season_id}...\n")
    
    # Get all players
    cur.execute("""
        SELECT id, player_id, player_name, star_rating
        FROM player_seasons
        WHERE season_id = %s
    """, (season_id,))
    
    players = cur.fetchall()
    print(f"Found {len(players)} players to reset\n")
    
    for player_id, player_name, full_name, star_rating in players:
        star_rating = star_rating or 3
        base_points = STAR_RATING_BASE_POINTS.get(star_rating, 100)
        
        # Reset stats to 0 and points to base
        cur.execute("""
            UPDATE player_seasons
            SET 
                points = %s,
                matches_played = 0,
                goals_scored = 0,
                goals_conceded = 0,
                assists = 0,
                wins = 0,
                draws = 0,
                losses = 0,
                clean_sheets = 0,
                motm_awards = 0,
                processed_fixtures = '[]'::jsonb,
                updated_at = NOW()
            WHERE id = %s
        """, (base_points, player_id))
        
        print(f"  ✓ {full_name}: {star_rating}★ → {base_points} points")
    
    conn.commit()
    print(f"\n✅ Reset {len(players)} players to base points with 0 stats\n")
    
    cur.close()
    conn.close()

def check_salary_deductions():
    """Check if salaries were deducted from Firebase"""
    
    try:
        import firebase_admin
        from firebase_admin import credentials, firestore
        
        # Initialize Firebase Admin (if not already)
        try:
            cred = credentials.Certificate('serviceAccountKey.json')
            firebase_admin.initialize_app(cred)
        except ValueError:
            pass  # Already initialized
        
        db = firestore.client()
        
        season_id = 'SSPSLS16'
        
        print("\n💰 Checking Salary Deductions\n")
        
        # Get salary transactions
        transactions = db.collection('transactions') \
            .where('season_id', '==', season_id) \
            .where('transaction_type', '==', 'salary_payment') \
            .where('currency_type', '==', 'real_player') \
            .stream()
        
        tx_list = []
        for doc in transactions:
            data = doc.to_dict()
            tx_list.append({
                'team_id': data.get('team_id'),
                'amount': abs(data.get('amount', 0)),
                'balance_before': data.get('balance_before', 0),
                'balance_after': data.get('balance_after', 0),
                'fixture_id': data.get('metadata', {}).get('fixture_id'),
                'player_count': data.get('metadata', {}).get('player_count')
            })
        
        if len(tx_list) > 0:
            print(f"✅ Found {len(tx_list)} salary payment transactions:\n")
            
            # Group by team
            by_team = {}
            for tx in tx_list:
                team = tx['team_id']
                if team not in by_team:
                    by_team[team] = {'total': 0, 'count': 0}
                by_team[team]['total'] += tx['amount']
                by_team[team]['count'] += 1
            
            for team in sorted(by_team.keys()):
                print(f"  {team}: ${by_team[team]['total']:.2f} ({by_team[team]['count']} transactions)")
        else:
            print("⚠️  No salary payment transactions found")
        
        # Check team balances
        print("\n\n💵 Current Team Balances:\n")
        team_seasons = db.collection('team_seasons') \
            .where('season_id', '==', season_id) \
            .stream()
        
        balances = []
        for doc in team_seasons:
            data = doc.to_dict()
            team_id = data.get('team_id') or doc.id.split('_')[0]
            balances.append({
                'team_id': team_id,
                'balance': data.get('real_player_budget', 0),
                'starting': data.get('real_player_starting_balance', 5000)
            })
        
        balances.sort(key=lambda x: x['team_id'])
        
        for b in balances:
            spent = b['starting'] - b['balance']
            print(f"  {b['team_id']}: ${b['balance']:.2f} (spent: ${spent:.2f})")
        
        print()
        
    except Exception as e:
        print(f"Error checking Firebase: {e}")
        print("Note: Make sure serviceAccountKey.json exists in the project root")

if __name__ == "__main__":
    reset_player_seasons()
    check_salary_deductions()
