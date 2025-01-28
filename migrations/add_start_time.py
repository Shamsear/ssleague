from app import db
from datetime import datetime

def upgrade():
    # Add start_time column to auction_round table
    db.engine.execute('''
        ALTER TABLE auction_round 
        ADD COLUMN start_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ''')

def downgrade():
    # Remove start_time column from auction_round table
    db.engine.execute('ALTER TABLE auction_round DROP COLUMN start_time')
