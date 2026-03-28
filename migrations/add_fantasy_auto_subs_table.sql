-- Fantasy League - Auto-Substitutions Table
-- Tracks automatic substitutions when starters don't play

CREATE TABLE IF NOT EXISTS fantasy_auto_subs (
  id SERIAL PRIMARY KEY,
  lineup_id VARCHAR(100) NOT NULL,
  starter_out VARCHAR(100) NOT NULL,
  bench_in VARCHAR(100) NOT NULL,
  reason VARCHAR(200) NOT NULL,
  points_earned DECIMAL(10,2) DEFAULT 0,
  substituted_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT fk_lineup FOREIGN KEY (lineup_id) REFERENCES fantasy_lineups(lineup_id)
);

CREATE INDEX IF NOT EXISTS idx_auto_subs_lineup ON fantasy_auto_subs(lineup_id);
CREATE INDEX IF NOT EXISTS idx_auto_subs_substituted ON fantasy_auto_subs(substituted_at DESC);

COMMENT ON TABLE fantasy_auto_subs IS 'Records automatic substitutions when starters do not play';
COMMENT ON COLUMN fantasy_auto_subs.reason IS 'Reason for substitution (e.g., "Did not play")';

-- Add did_not_play column to fantasy_player_points if it doesn't exist
ALTER TABLE fantasy_player_points
ADD COLUMN IF NOT EXISTS did_not_play BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN fantasy_player_points.did_not_play IS 'Whether player did not play in this round';
