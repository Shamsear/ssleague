from app import  db, User, Player, AuctionRound, BidHistory, app  # Import the `db` object and `app` instance from your app module
import random
def init_db():
    """Initialize the database with admin user, teams, and sample data."""
    # Use the application context
    with app.app_context():
        # Drop all tables and recreate them
        db.drop_all()
        db.create_all()

        # Create an admin user
        admin = User.query.filter_by(username='admin').first()
        if not admin:
            admin = User(
                username='admin',
                is_admin=True,
                team_name='Admin'
            )
            admin.set_password('admin123')
            db.session.add(admin)

        # Create teams
        teams = [
            {
                'username': 'manutd',
                'password': 'manutd123',
                'team_name': 'Manchester United',
                'budget': 15000
            },
            {
                'username': 'madrid',
                'password': 'madrid123',
                'team_name': 'Real Madrid',
                'budget': 15000
            }
        ]

        for team_data in teams:
            team = User.query.filter_by(username=team_data['username']).first()
            if not team:
                team = User(
                    username=team_data['username'],
                    is_admin=False,
                    team_name=team_data['team_name'],
                    budget=team_data['budget']
                )
                team.set_password(team_data['password'])
                db.session.add(team)

        # Add players (specific data)
        if Player.query.count() == 0:
            players = [
                {'name': 'Alisson Becker', 'position': 'GK', 'nationality': 'Brazil', 'base_price': 10},
                {'name': 'Virgil van Dijk', 'position': 'DEF', 'nationality': 'Netherlands', 'base_price': 10},
                {'name': 'Kevin De Bruyne', 'position': 'MID', 'nationality': 'Belgium', 'base_price': 10},
                {'name': 'Lionel Messi', 'position': 'FWD', 'nationality': 'Argentina', 'base_price': 10},
                {'name': 'Cristiano Ronaldo', 'position': 'FWD', 'nationality': 'Portugal', 'base_price': 10},
                {'name': 'Thibaut Courtois', 'position': 'GK', 'nationality': 'Belgium', 'base_price': 10},
                {'name': 'Sergio Ramos', 'position': 'DEF', 'nationality': 'Spain', 'base_price': 10},
                {'name': 'Luka Modric', 'position': 'MID', 'nationality': 'Croatia', 'base_price': 10},
                {'name': 'Karim Benzema', 'position': 'FWD', 'nationality': 'France', 'base_price': 10},
                {'name': 'Manuel Neuer', 'position': 'GK', 'nationality': 'Germany', 'base_price': 10}
            ]

            for player_data in players:
                player = Player(
                    name=player_data['name'],
                    position=player_data['position'],
                    nationality=player_data['nationality'],
                    base_price=player_data['base_price'],
                    status='available'
                )
                db.session.add(player)

        db.session.commit()
        print("Database initialized successfully.")

with app.app_context():
    db.create_all()  # This creates all tables based on your models

if __name__ == '__main__':
    init_db()
