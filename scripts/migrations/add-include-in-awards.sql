-- Add include_in_awards column to tournaments table
-- This determines whether tournament stats count towards player awards and statistics

ALTER TABLE tournaments 
ADD COLUMN IF NOT EXISTS include_in_awards BOOLEAN DEFAULT true;

-- Update existing tournaments to include in awards by default
UPDATE tournaments 
SET include_in_awards = true 
WHERE include_in_awards IS NULL;

-- Show updated tournaments
SELECT 
  id,
  tournament_name,
  tournament_type,
  status,
  include_in_fantasy,
  include_in_awards,
  created_at
FROM tournaments 
ORDER BY created_at DESC;
