-- Add group assignment mode field to tournaments table
-- This determines whether groups are assigned automatically or manually

ALTER TABLE tournaments 
ADD COLUMN IF NOT EXISTS group_assignment_mode VARCHAR(20) DEFAULT 'auto';

-- Update existing tournaments
UPDATE tournaments 
SET group_assignment_mode = 'auto'
WHERE group_assignment_mode IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN tournaments.group_assignment_mode IS 'How teams are assigned to groups: auto (automatic distribution) or manual (admin assigns)';
