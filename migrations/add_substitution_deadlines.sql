-- Add substitution deadline columns to round_deadlines table
-- Home team: Can substitute until 21:00 on day after scheduled_date
-- Away team: Can substitute until 21:00 on round start day

ALTER TABLE round_deadlines
ADD COLUMN IF NOT EXISTS home_substitution_deadline_time TIME DEFAULT '21:00',
ADD COLUMN IF NOT EXISTS away_substitution_deadline_time TIME DEFAULT '21:00',
ADD COLUMN IF NOT EXISTS home_substitution_deadline_day_offset INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS away_substitution_deadline_day_offset INTEGER DEFAULT 0;

COMMENT ON COLUMN round_deadlines.home_substitution_deadline_time IS 'Time when home team substitution window closes (default 21:00 IST)';
COMMENT ON COLUMN round_deadlines.away_substitution_deadline_time IS 'Time when away team substitution window closes (default 21:00 IST)';
COMMENT ON COLUMN round_deadlines.home_substitution_deadline_day_offset IS 'Day offset from scheduled_date for home substitution deadline (default 1 = day after)';
COMMENT ON COLUMN round_deadlines.away_substitution_deadline_day_offset IS 'Day offset from scheduled_date for away substitution deadline (default 0 = same day)';
