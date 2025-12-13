-- Add separate lineup deadline columns for home and away teams
-- Home team: Can submit until 21:00 on the day before round starts
-- Away team: Can submit until 21:00 on the round start day

ALTER TABLE round_deadlines 
ADD COLUMN IF NOT EXISTS home_lineup_deadline_time TIME DEFAULT '21:00',
ADD COLUMN IF NOT EXISTS away_lineup_deadline_time TIME DEFAULT '21:00',
ADD COLUMN IF NOT EXISTS home_lineup_deadline_day_offset INTEGER DEFAULT -1,
ADD COLUMN IF NOT EXISTS away_lineup_deadline_day_offset INTEGER DEFAULT 0;

COMMENT ON COLUMN round_deadlines.home_lineup_deadline_time IS 'Time when home team lineup submission closes (IST)';
COMMENT ON COLUMN round_deadlines.away_lineup_deadline_time IS 'Time when away team lineup submission closes (IST)';
COMMENT ON COLUMN round_deadlines.home_lineup_deadline_day_offset IS 'Days offset from scheduled_date for home lineup deadline (-1 = day before)';
COMMENT ON COLUMN round_deadlines.away_lineup_deadline_day_offset IS 'Days offset from scheduled_date for away lineup deadline (0 = same day)';

-- Update existing rows to use the new defaults
UPDATE round_deadlines 
SET 
  home_lineup_deadline_time = '21:00',
  away_lineup_deadline_time = '21:00',
  home_lineup_deadline_day_offset = -1,
  away_lineup_deadline_day_offset = 0
WHERE home_lineup_deadline_time IS NULL 
   OR away_lineup_deadline_time IS NULL;
