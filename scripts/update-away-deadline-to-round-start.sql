-- Update away_fixture_deadline_time to match round_start_time
-- This ensures lineup deadline is at round start time (08:00 AM) instead of 20:00 (8:00 PM)

UPDATE rounds
SET away_fixture_deadline_time = round_start_time
WHERE away_fixture_deadline_time != round_start_time;

-- Verify the update
SELECT 
  id,
  round_number,
  scheduled_date,
  round_start_time,
  home_fixture_deadline_time,
  away_fixture_deadline_time,
  status
FROM rounds
WHERE scheduled_date >= CURRENT_DATE
ORDER BY scheduled_date, round_number;
