-- Add include_in_fantasy column to tournaments table
-- This determines whether tournament stats count towards fantasy league points

ALTER TABLE tournaments 
ADD COLUMN IF NOT EXISTS include_in_fantasy BOOLEAN DEFAULT true;

-- Update existing tournaments to include in fantasy by default
UPDATE tournaments 
SET include_in_fantasy = true 
WHERE include_in_fantasy IS NULL;

-- Show updated tournaments
SELECT 
  id,
  tournament_name,
  tournament_type,
  status,
  include_in_fantasy,
  created_at
FROM tournaments 
ORDER BY created_at DESC;
