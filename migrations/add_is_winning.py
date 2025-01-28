import sqlite3

def upgrade():
    conn = sqlite3.connect('auction.db')
    cursor = conn.cursor()
    
    # Add is_winning column to bid_history table
    cursor.execute('ALTER TABLE bid_history ADD COLUMN is_winning BOOLEAN DEFAULT FALSE')
    
    conn.commit()
    conn.close()

def downgrade():
    conn = sqlite3.connect('auction.db')
    cursor = conn.cursor()
    
    # Remove is_winning column from bid_history table
    cursor.execute('ALTER TABLE bid_history DROP COLUMN is_winning')
    
    conn.commit()
    conn.close()

if __name__ == '__main__':
    upgrade()
