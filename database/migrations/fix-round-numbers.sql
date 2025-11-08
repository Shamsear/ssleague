-- Fix existing rounds with NULL round_number
-- This assigns sequential round numbers to existing rounds based on creation date

WITH numbered_rounds AS (
  SELECT 
    id,
    season_id,
    ROW_NUMBER() OVER (PARTITION BY season_id ORDER BY created_at) as new_round_number
  FROM rounds
  WHERE round_number IS NULL
)
UPDATE rounds
SET round_number = numbered_rounds.new_round_number
FROM numbered_rounds
WHERE rounds.id = numbered_rounds.id;

-- Verify the fix
SELECT 
  season_id,
  COUNT(*) as total_rounds,
  COUNT(round_number) as rounds_with_number,
  MIN(round_number) as min_number,
  MAX(round_number) as max_number
FROM rounds
GROUP BY season_id
ORDER BY season_id;

SELECT 'Round numbers fixed successfully!' as status;
