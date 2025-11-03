import psycopg2
import os

conn = psycopg2.connect(os.environ.get('DATABASE_URL') or os.environ.get('NEON_DATABASE_URL'))
cur = conn.cursor()

print("Running migration: Add team_name to bids table\n")

# Add team_name column
cur.execute("""
    ALTER TABLE bids 
    ADD COLUMN IF NOT EXISTS team_name VARCHAR(255)
""")
print("✅ Added team_name column")

# Add index
cur.execute("""
    CREATE INDEX IF NOT EXISTS idx_bids_team_name ON bids(team_name)
""")
print("✅ Created index on team_name")

# Add comment
cur.execute("""
    COMMENT ON COLUMN bids.team_name IS 'Team name at the time of bid (denormalized for performance)'
""")
print("✅ Added comment")

conn.commit()
print("\n✅ Migration completed successfully!")

cur.close()
conn.close()
