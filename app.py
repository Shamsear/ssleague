from flask import Flask, render_template, request, redirect, url_for, flash, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from datetime import datetime, timedelta, timezone
from werkzeug.security import generate_password_hash, check_password_hash
import json
import re
import os
import random
from sqlalchemy import func, and_

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key'
app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://postgres:123456@localhost/ssleague'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'


class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(120), nullable=False)
    is_admin = db.Column(db.Boolean, default=False)
    team_name = db.Column(db.String(80))
    budget = db.Column(db.Integer, default=15000)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)


class Player(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    position = db.Column(db.String(50), nullable=False)
    nationality = db.Column(db.String(50), nullable=False)
    base_price = db.Column(db.Integer, default=10)
    current_bid = db.Column(db.Integer)
    current_team_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    team_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    status = db.Column(db.String(20), default='available')
    final_price = db.Column(db.Integer)

    current_team = db.relationship('User', foreign_keys=[current_team_id])
    team = db.relationship('User', foreign_keys=[team_id])


class AuctionRound(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    position = db.Column(db.String(20), nullable=False)
    status = db.Column(db.String(20), default='active')
    start_time = db.Column(db.DateTime, nullable=False)
    end_time = db.Column(db.DateTime, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class BidHistory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    player_id = db.Column(db.Integer, db.ForeignKey('player.id'))
    round_id = db.Column(db.Integer, db.ForeignKey('auction_round.id'))
    team_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    bid_amount = db.Column(db.Integer)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    is_winning = db.Column(db.Boolean, default=False)

    player = db.relationship('Player', backref='bids')
    team = db.relationship('User', backref='bids')
    round = db.relationship('AuctionRound', backref='bids')


@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

def escapejs(value):
    """ Escapes string for use in JavaScript """
    if not isinstance(value, str):
        return value
        
    value = value.replace('\\', '\\\\')
    value = value.replace('"', '\\"')
    value = value.replace("'", "\\'")
    value = value.replace('\n', '\\n')
    value = value.replace('\r', '\\r')
    value = value.replace('</', '<\\/')
    return value

# Register the custom filter
app.jinja_env.filters['escapejs'] = escapejs

# Routes
@app.route('/')
def home():
    if current_user.is_authenticated:
        flash_message = request.args.get('message', None)
        if flash_message:
            flash(flash_message, 'info')
        players_bought = Player.query.filter_by(team_id=current_user.id).count()
        
        # Calculate budget spent
        budget_spent = db.session.query(db.func.sum(Player.final_price))\
            .filter(Player.team_id == current_user.id)\
            .scalar() or 0
            
        # Get all teams (non-admin users)
        teams = User.query.filter_by(is_admin=False).all()
        
        # Get completed rounds
        completed_rounds = AuctionRound.query.filter_by(status='completed').all()
        
        # Get all sold players
        sold_players = Player.query.filter(Player.team_id.isnot(None)).all()
        
        # Get highest bid
        highest_bid = db.session.query(func.max(Player.final_price)).scalar() or 0
        
        # Prepare team data with additional information
        team_data = []
        for team in teams:
            # Get team's players
            team_players = Player.query.filter_by(team_id=team.id).all()
            
            # Calculate total spent
            total_spent = sum(player.final_price or 0 for player in team_players)
            
            # Count players by position
            positions = {}
            for player in team_players:
                positions[player.position] = positions.get(player.position, 0) + 1
                
            team_data.append({
                'name': team.team_name,
                'players': team_players,
                'total_spent': total_spent,
                'remaining_budget': 15000 - total_spent,  # Calculate from initial budget
                'positions': positions
            })
        
        return render_template('home.html',
                             players_bought=players_bought,
                             budget_spent=budget_spent,
                             teams=team_data,
                             rounds=completed_rounds,
                             sold_players=sold_players,
                             highest_bid=highest_bid)
    return render_template('home.html')
@app.route('/admin')
@login_required
def admin():
    if not current_user.is_admin:
        flash('Access denied. Admin only area.', 'error')
        return redirect(url_for('home'))
    
    # Get current round status
    current_round = AuctionRound.query.filter_by(status='active').first()
    time_remaining = None
    end_time_iso = None
    
    if current_round and current_round.end_time:
        now_utc = datetime.now(timezone.utc)
        end_time = current_round.end_time
        if end_time.tzinfo is None:
            end_time = end_time.replace(tzinfo=timezone.utc)
            
        if now_utc > end_time:
            finalize_round_bids(current_round)
            flash('Round has ended. Players have been assigned to the highest bidding teams.', 'info')
            return redirect(url_for('admin'))
            
        time_delta = end_time - now_utc
        time_remaining = {
            'minutes': int(time_delta.total_seconds() // 60),
            'seconds': int(time_delta.total_seconds() % 60)
        }
        end_time_iso = end_time.isoformat()
    
    # Get all teams
    teams = User.query.filter_by(is_admin=False).all()
    
    # Get all rounds with their bids
    rounds = []
    completed_rounds = AuctionRound.query.filter_by(status='completed').order_by(AuctionRound.id).all()
    
    for round in completed_rounds:
        # Get all players and their bids for this round
        players_with_bids = db.session.query(
            Player,
            User.team_name.label('winning_team'),
            User.id.label('winning_team_id')
        ).join(
            User, Player.team_id == User.id
        ).filter(
            Player.position == round.position,
            Player.team_id.isnot(None)
        ).all()
        
        round_data = {
            'id': round.id,
            'position': round.position,
            'status': round.status,
            'players': []
        }
        
        for player, winning_team, winning_team_id in players_with_bids:
            # Get all bids for this player with team information
            bid_history = db.session.query(
                BidHistory,
                User.team_name.label('bidding_team'),
                User.id.label('bidding_team_id')
            ).join(
                User, BidHistory.team_id == User.id
            ).filter(
                BidHistory.player_id == player.id,
                BidHistory.round_id == round.id
            ).order_by(BidHistory.bid_amount.desc()).all()
            
            player_data = {
                'id': player.id,
                'name': player.name,
                'base_price': player.base_price,
                'winning_bid': player.final_price,
                'winning_team': winning_team,
                'winning_team_id': winning_team_id,
                'bid_history': [{
                    'team': bid.bidding_team,
                    'team_id': bid.bidding_team_id,
                    'amount': bid.BidHistory.bid_amount,
                    'timestamp': bid.BidHistory.timestamp,
                    'is_winning': bid.bidding_team_id == winning_team_id and 
                                bid.BidHistory.bid_amount == player.final_price
                } for bid in bid_history]
            }
            round_data['players'].append(player_data)
        
        rounds.append(round_data)
    
    return render_template('admin.html', 
                         teams=teams,
                         rounds=rounds,
                         current_round=current_round,
                         time_remaining=time_remaining,
                         end_time_iso=end_time_iso)
    """
    Admin page with current round information and completed rounds with their bids.
    """

@app.route('/admin/start_auction_round', methods=['POST'])
@login_required
def start_round():
    if not current_user.is_admin:
        flash('Only admin can start rounds', 'error')
        return redirect(url_for('home'))

    position = request.form.get('position')
    duration_minutes = int(request.form.get('duration', 5))  # Default 5 minutes if not specified

    if not position:
        flash('Position is required', 'error')
        return redirect(url_for('home'))

    # End any currently active rounds
    active_rounds = AuctionRound.query.filter_by(status='active').all()
    for round in active_rounds:
        round.status = 'completed'
        round.end_time = datetime.utcnow()

    # Create new round
    new_round = AuctionRound(
        position=position,
        status='active',
        start_time=datetime.utcnow(),
        end_time=datetime.utcnow() + timedelta(minutes=duration_minutes)
    )
    db.session.add(new_round)
    db.session.commit()

    flash(f'Round {position} started successfully', 'success')
    return redirect(url_for('home'))

@app.route('/admin/end_auction_round', methods=['POST'])
@login_required
def end_round():
    if not current_user.is_admin:
        flash('Only admin can end rounds', 'error')
        return redirect(url_for('home'))

    current_round = AuctionRound.query.filter_by(status='active').first()
    if current_round:
        # Finalize the bids for this round
        finalize_round_bids(current_round)
        flash(f'Round {current_round.position} ended successfully', 'success')
    else:
        flash('No active round found', 'error')
    
    return redirect(url_for('home'))

@app.route('/admin/extend_round_time', methods=['POST'])
@login_required
def extend_round_time():
    if not current_user.is_admin:
        flash('Access denied', 'error')
        return redirect(url_for('home'))
    
    current_round = AuctionRound.query.filter_by(status='active').first()
    if not current_round:
        flash('No active round', 'error')
        return redirect(url_for('admin'))
    
    extra_time = int(request.form.get('extra_time', 60))
    if extra_time < 60:
        flash('Extra time must be at least 60 seconds', 'error')
        return redirect(url_for('admin'))
    
    # Add extra time to current end time
    if current_round.end_time:
        current_round.end_time = current_round.end_time + timedelta(seconds=extra_time)
        db.session.commit()
        flash(f'Added {extra_time} seconds to round', 'success')
    
    return redirect(url_for('admin'))

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        user = User.query.filter_by(username=username).first()
        
        if user and user.check_password(password):
            login_user(user)
            return redirect(url_for('home'))
        else:
            flash('Invalid username or password')
    
    return render_template('login.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('login'))
@app.route('/auction')
@login_required
def auction():
    if current_user.is_admin:
        flash('Admin cannot participate in auction', 'error')
        return redirect(url_for('home'))
    
    # Fetch the currently active round
    current_round = AuctionRound.query.filter_by(status='active').first()
    last_completed_round = None

    if not current_round:
        # Get the last completed round if no active round exists
        last_completed_round = AuctionRound.query.filter_by(status='completed')\
            .order_by(AuctionRound.end_time.desc()).first()
    
    if current_round:
        # Get all sold players
        sold_players = Player.query.filter(Player.team_id.isnot(None)).all()
        
        # Filter available players by position and status
        available_players = Player.query.filter(
            Player.position == current_round.position,
            Player.team_id.is_(None),  # Ensure the player is not sold
            Player.status == 'available'  # Ensure the player is available
        ).all()
        
        # Fetch the current highest bid for each available player
        for player in available_players:
            highest_bid = BidHistory.query\
                .filter(
                    BidHistory.player_id == player.id,
                    BidHistory.round_id == current_round.id
                )\
                .order_by(BidHistory.bid_amount.desc())\
                .first()
            player.current_bid = highest_bid.bid_amount if highest_bid else None
        
        # Calculate time remaining for the current round
        time_remaining = None
        end_time_iso = None

        if current_round.end_time:
            # Convert UTC to IST
            ist = timezone(timedelta(hours=5, minutes=30))
            now = datetime.now(ist)
            end_time_ist = current_round.end_time.replace(tzinfo=timezone.utc).astimezone(ist)
            time_left = end_time_ist - now
            
            # Only show time if it is still remaining
            if time_left.total_seconds() > 0:
                time_remaining = {
                    'minutes': int(time_left.total_seconds() // 60),
                    'seconds': int(time_left.total_seconds() % 60)
                }
            
            # Provide ISO format for JavaScript timers
            end_time_iso = end_time_ist.isoformat()
        
        # Get the current user's remaining budget
        remaining_budget = current_user.budget
        
        # Fetch the user's current bids in the active round
        current_bids = BidHistory.query.filter(
            BidHistory.round_id == current_round.id,
            BidHistory.team_id == current_user.id
        ).order_by(BidHistory.bid_amount.desc()).all()
        
        return render_template(
            'auction.html',
            current_round=current_round,
            available_players=available_players,
            sold_players=sold_players,
            time_remaining=time_remaining,
            end_time_iso=end_time_iso,
            remaining_budget=remaining_budget,
            current_bids=current_bids,
            user_bid_player_ids=[bid.player_id for bid in current_bids]
        )
    
    # If there is no active round, get the results of the last completed round
    round_results = None
    if last_completed_round:
        players = db.session.query(
            Player,
            User.team_name
        ).outerjoin(
            User, Player.team_id == User.id
        ).filter(
            Player.position == last_completed_round.position
        ).all()
        
        round_results = {
            'position': last_completed_round.position,
            'results': [{
                'player_name': player.name,
                'team_name': team_name or 'Unsold',
                'price': player.final_price or 'N/A'
            } for player, team_name in players]
        }
    
    return render_template(
        'auction.html',
        current_round=None,
        last_completed_round=last_completed_round,
        round_results=round_results,
        remaining_budget=current_user.budget
    )

@app.route('/auction/submit_bid', methods=['POST'])
@login_required
def submit_bid():
    if current_user.is_admin:
        return jsonify({'error': 'Admin cannot place bids'}), 400

    data = request.get_json()
    player_id = data.get('player_id')
    bid_amount = data.get('bid_amount')
    is_update = str(data.get('is_update_bid')).lower() == 'true'

    print(f"Debug - Received bid: amount={bid_amount}, player={player_id}, is_update={is_update}")

    if not player_id or not bid_amount:
        return jsonify({'error': 'Missing required fields'}), 400

    try:
        bid_amount = int(bid_amount)
    except ValueError:
        return jsonify({'error': 'Invalid bid amount'}), 400

    if bid_amount <= 0:
        return jsonify({'error': 'Bid amount must be greater than 0'}), 400

    if bid_amount > current_user.budget:
        return jsonify({'error': 'Bid amount exceeds your budget'}), 400

    player = Player.query.get(player_id)
    if not player:
        return jsonify({'error': 'Player not found'}), 404

    current_round = AuctionRound.query.filter_by(status='active').first()
    if not current_round:
        return jsonify({'error': 'No active round'}), 400

    # Get user's current bid for this player in this round
    current_user_bid = BidHistory.query.filter(
        BidHistory.player_id == player_id,
        BidHistory.round_id == current_round.id,
        BidHistory.team_id == current_user.id
    ).order_by(BidHistory.bid_amount.desc()).first()

    print(f"Debug - Current user bid: {current_user_bid.bid_amount if current_user_bid else None}")

    # Handle new bids vs updates
    if not is_update:
        # For new bids, check minimum price
        if bid_amount < player.base_price:
            return jsonify({'error': f'New bid must be at least ₹{player.base_price}'}), 400

        # Check if this amount is used in another player's latest bid
        other_player_bid = BidHistory.query.filter(
            BidHistory.round_id == current_round.id,
            BidHistory.team_id == current_user.id,
            BidHistory.player_id != player_id,
            BidHistory.bid_amount == bid_amount
        ).first()
        
        if other_player_bid:
            return jsonify({
                'error': f'You have already bid ₹{bid_amount} on {other_player_bid.player.name}. Use a different amount.'
            }), 400

    else:
        # For updates, just verify user has a previous bid
        if not current_user_bid:
            return jsonify({'error': 'Cannot update - no previous bid found'}), 400

    # Create new bid
    new_bid = BidHistory(
        player_id=player_id,
        team_id=current_user.id,
        round_id=current_round.id,
        bid_amount=bid_amount
    )
    db.session.add(new_bid)
    
    # Update player's current bid and team if this is the highest bid
    highest_bid = BidHistory.query.filter(
        BidHistory.player_id == player_id,
        BidHistory.round_id == current_round.id
    ).order_by(BidHistory.bid_amount.desc()).first()
    
    if highest_bid is None or bid_amount >= highest_bid.bid_amount:
        player.current_bid = bid_amount
        player.current_team_id = current_user.id
    
    db.session.commit()

    return jsonify({
        'message': 'Bid placed successfully',
        'bid_amount': bid_amount
    })

@app.route('/auction/updates')
@login_required
def auction_updates():
    current_round = AuctionRound.query.filter_by(status='active').first()
    if not current_round:
        return jsonify({'error': 'No active round'}), 400

    # Get all sold players in this round
    sold_players = Player.query.filter(Player.team_id.isnot(None)).all()
    
    # Get all available players (not sold in this round)
    sold_player_ids = [p.id for p in sold_players]
    available_players = Player.query.filter(Player.id.notin_(sold_player_ids) if sold_player_ids else True).all()
    
    # Get current highest bid for each available player
    for player in available_players:
        highest_bid = BidHistory.query\
            .filter(
                BidHistory.player_id == player.id,
                BidHistory.round_id == current_round.id
            )\
            .order_by(BidHistory.bid_amount.desc())\
            .first()
        player.current_bid = highest_bid.bid_amount if highest_bid else None

    return jsonify({
        'available_players': [{
            'id': p.id,
            'name': p.name,
            'base_price': p.base_price,
            'current_bid': p.current_bid
        } for p in available_players],
        'sold_players': [{
            'id': p.id,
            'name': p.name,
            'base_price': p.base_price,
            'current_bid': p.current_bid,
            'team': {
                'team_name': p.team.team_name
            }
        } for p in sold_players],
        'remaining_budget': current_user.budget
    })

@app.route('/auction/delete_bid', methods=['POST'])
@login_required
def delete_bid():
    if current_user.is_admin:
        return jsonify({'error': 'Admin cannot manage bids'}), 400

    data = request.get_json()
    player_id = data.get('player_id')

    if not player_id:
        return jsonify({'error': 'Missing player ID'}), 400

    current_round = AuctionRound.query.filter_by(status='active').first()
    if not current_round:
        return jsonify({'error': 'No active round'}), 400

    # Delete the user's bid for this player in the current round
    BidHistory.query.filter(
        BidHistory.player_id == player_id,
        BidHistory.round_id == current_round.id,
        BidHistory.team_id == current_user.id
    ).delete()

    # Get the highest remaining bid for this player
    highest_bid = BidHistory.query.filter(
        BidHistory.player_id == player_id,
        BidHistory.round_id == current_round.id
    ).order_by(BidHistory.bid_amount.desc()).first()

    # Update player's current bid and team to the highest remaining bid
    player = Player.query.get(player_id)
    if highest_bid:
        player.current_bid = highest_bid.bid_amount
        player.current_team_id = highest_bid.team_id
    else:
        player.current_bid = None
        player.current_team_id = None

    db.session.commit()

    return jsonify({'message': 'Bid deleted successfully'})

@app.route('/admin/update_base_prices', methods=['GET'])
@login_required
def update_base_prices():
    if not current_user.is_admin:
        flash('Unauthorized access', 'error')
        return redirect(url_for('index'))
        
    try:
        # Update all players' base price to 10
        Player.query.update({Player.base_price: 10})
        db.session.commit()
        flash('All player base prices have been updated to 10', 'success')
    except Exception as e:
        db.session.rollback()
        flash('An error occurred while updating base prices', 'error')
    
    return redirect(url_for('admin'))

@app.route('/admin/add_player', methods=['POST'])
@login_required
def add_player():
    if not current_user.is_admin:
        flash('Unauthorized access', 'error')
        return redirect(url_for('index'))
    
    try:
        name = request.form.get('name')
        position = request.form.get('position')
        
        if not name or not position:
            flash('Please provide both name and position', 'error')
            return redirect(url_for('admin'))
        
        # Create new player with base price 10
        player = Player(
            name=name,
            position=position,
            base_price=10,  # Set default base price to 10
            status='available'
        )
        db.session.add(player)
        db.session.commit()
        
        flash(f'Player {name} added successfully', 'success')
    except Exception as e:
        db.session.rollback()
        flash('An error occurred while adding the player', 'error')
    
    return redirect(url_for('admin'))

@app.route('/admin/round-results/<int:round_id>')
def get_round_results(round_id):
    # Get the round
    round = AuctionRound.query.get_or_404(round_id)
    
    # Get all players sold in this round
    players = db.session.query(
        Player,
        User.team_name
    ).outerjoin(
        User, Player.team_id == User.id
    ).filter(
        Player.position == round.position
    ).all()
    
    results = []
    for player, team_name in players:
        results.append({
            'player_name': player.name,
            'team_name': team_name,
            'price': player.final_price
        })
    
    return jsonify({
        'position': round.position,
        'results': results
    })

@app.before_first_request
def initialize_app():
    db.create_all()
    # Set base price to 10 for all existing players
    try:
        Player.query.update({Player.base_price: 10})
        db.session.commit()
    except Exception as e:
        db.session.rollback()

def finalize_round_bids(round):
    if not round:
        return
        
    # Get all players in current round with bids
    players_with_bids = Player.query.filter(
        Player.position == round.position,
        Player.current_bid.isnot(None)
    ).all()
    
    # Sort players by their highest bid (regardless of team)
    players_with_bids.sort(key=lambda x: x.current_bid or 0, reverse=True)
    
    # Track teams that have been assigned a player
    assigned_teams = set()
    
    # Process each player in order of highest bid
    for player in players_with_bids:
        # Skip if no team bid on this player
        if not player.current_team_id:
            continue
            
        # If the bidding team hasn't been assigned a player yet
        if player.current_team_id not in assigned_teams:
            # Assign the player to the team
            player.team_id = player.current_team_id
            player.final_price = player.current_bid
            assigned_teams.add(player.current_team_id)
            
    # Update budgets for all teams
    teams = User.query.filter_by(is_admin=False).all()
    for team in teams:
        # Calculate total spent by the team
        total_spent = db.session.query(func.sum(Player.final_price))\
            .filter(Player.team_id == team.id)\
            .scalar() or 0
        # Update team's budget
        team.budget = 15000 - total_spent
    
    # Reset current bids for all players in the round
    for player in Player.query.filter_by(position=round.position).all():
        player.current_bid = None
        player.current_team_id = None
    
    # Mark round as completed
    round.status = 'completed'
    db.session.commit()

def get_team_players():
    players = Player.query.filter_by(current_team_id=current_user.id).all()
    return [{'name': player.name, 'position': player.position} for player in players]

if __name__ == '__main__':
    app.run(debug=True)
