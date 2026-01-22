-- Migration: Add Blind Lineup Matchup System
-- Date: 2026-01-21

-- 1. Add matchup_mode to fixtures table
ALTER TABLE fixtures 
ADD COLUMN IF NOT EXISTS matchup_mode VARCHAR(20) DEFAULT 'manual';

COMMENT ON COLUMN fixtures.matchup_mode IS 'Matchup creation mode: manual (current) or blind_lineup (auto-generated from order)';

-- 2. Add lineup submission status to fixtures
ALTER TABLE fixtures
ADD COLUMN IF NOT EXISTS home_lineup_submitted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS away_lineup_submitted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS lineups_locked BOOLEAN DEFAULT false;

COMMENT ON COLUMN fixtures.home_lineup_submitted IS 'Whether home team has submitted their lineup order';
COMMENT ON COLUMN fixtures.away_lineup_submitted IS 'Whether away team has submitted their lineup order';
COMMENT ON COLUMN fixtures.lineups_locked IS 'Whether lineups are locked (after home fixture phase)';

-- 3. Create lineup_submissions table
CREATE TABLE IF NOT EXISTS lineup_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id VARCHAR(255) NOT NULL,
  team_id VARCHAR(255) NOT NULL,
  season_id VARCHAR(255) NOT NULL,
  tournament_id VARCHAR(255) NOT NULL,
  
  -- Lineup data (array of players in order)
  players JSONB NOT NULL,
  -- Format: [
  --   {player_id: 'xxx', position: 1, is_substitute: false, player_name: 'Name'},
  --   {player_id: 'xxx', position: 2, is_substitute: false, player_name: 'Name'},
  --   ...
  -- ]
  
  -- Metadata
  submitted_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  is_locked BOOLEAN DEFAULT false,
  
  -- Constraints
  CONSTRAINT lineup_submissions_fixture_team_unique UNIQUE(fixture_id, team_id),
  CONSTRAINT lineup_submissions_fixture_fk FOREIGN KEY (fixture_id) 
    REFERENCES fixtures(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_lineup_submissions_fixture ON lineup_submissions(fixture_id);
CREATE INDEX IF NOT EXISTS idx_lineup_submissions_team ON lineup_submissions(team_id);
CREATE INDEX IF NOT EXISTS idx_lineup_submissions_tournament ON lineup_submissions(tournament_id);

COMMENT ON TABLE lineup_submissions IS 'Stores team lineup orders for blind lineup matchup mode';
COMMENT ON COLUMN lineup_submissions.players IS 'Array of players in order with position and substitute status';
COMMENT ON COLUMN lineup_submissions.is_locked IS 'Whether this lineup is locked (after home fixture phase ends)';

-- 4. Add index on matchup_mode for filtering
CREATE INDEX IF NOT EXISTS idx_fixtures_matchup_mode ON fixtures(matchup_mode);
