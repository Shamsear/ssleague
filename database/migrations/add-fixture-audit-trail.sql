-- ============================================
-- ADD AUDIT FIELDS TO FIXTURES TABLE
-- ============================================

-- Add audit tracking fields to fixtures
ALTER TABLE fixtures 
ADD COLUMN IF NOT EXISTS created_by VARCHAR(255),
ADD COLUMN IF NOT EXISTS created_by_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS updated_by VARCHAR(255),
ADD COLUMN IF NOT EXISTS updated_by_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS result_submitted_by VARCHAR(255),
ADD COLUMN IF NOT EXISTS result_submitted_by_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS result_submitted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS motm_player_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS motm_player_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS match_status_reason VARCHAR(255), -- 'normal', 'wo_home_absent', 'wo_away_absent', 'null_both_absent'
ADD COLUMN IF NOT EXISTS declared_by VARCHAR(255),
ADD COLUMN IF NOT EXISTS declared_by_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS declared_at TIMESTAMP WITH TIME ZONE;

-- Create indexes for audit fields
CREATE INDEX IF NOT EXISTS idx_fixtures_created_by ON fixtures(created_by);
CREATE INDEX IF NOT EXISTS idx_fixtures_updated_by ON fixtures(updated_by);
CREATE INDEX IF NOT EXISTS idx_fixtures_result_submitted_by ON fixtures(result_submitted_by);

-- ============================================
-- CREATE FIXTURE_AUDIT_LOG TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS fixture_audit_log (
    id SERIAL PRIMARY KEY,
    fixture_id VARCHAR(255) NOT NULL,
    action_type VARCHAR(50) NOT NULL, -- 'created', 'updated', 'result_submitted', 'result_edited', 'wo_declared', 'null_declared', 'deleted'
    action_by VARCHAR(255) NOT NULL, -- user_id
    action_by_name VARCHAR(255) NOT NULL, -- user display name
    action_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    changes JSONB, -- Store what changed (old values -> new values)
    notes TEXT, -- Additional notes/reason
    season_id VARCHAR(255) NOT NULL,
    round_number INTEGER,
    match_number INTEGER,
    CONSTRAINT fk_fixture FOREIGN KEY (fixture_id) REFERENCES fixtures(id) ON DELETE CASCADE
);

-- Create indexes for fixture_audit_log
CREATE INDEX IF NOT EXISTS idx_audit_log_fixture ON fixture_audit_log(fixture_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action_type ON fixture_audit_log(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_action_by ON fixture_audit_log(action_by);
CREATE INDEX IF NOT EXISTS idx_audit_log_season ON fixture_audit_log(season_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action_at ON fixture_audit_log(action_at DESC);

-- ============================================
-- FUNCTION TO LOG FIXTURE CHANGES
-- ============================================
CREATE OR REPLACE FUNCTION log_fixture_change()
RETURNS TRIGGER AS $$
DECLARE
    change_record JSONB;
BEGIN
    -- Build changes JSON
    change_record := jsonb_build_object(
        'old', row_to_json(OLD),
        'new', row_to_json(NEW)
    );
    
    -- Insert audit log (if updated_by is set)
    IF NEW.updated_by IS NOT NULL AND NEW.updated_by <> OLD.updated_by THEN
        INSERT INTO fixture_audit_log (
            fixture_id,
            action_type,
            action_by,
            action_by_name,
            changes,
            season_id,
            round_number,
            match_number
        ) VALUES (
            NEW.id,
            CASE 
                WHEN OLD.status <> NEW.status AND NEW.status = 'completed' THEN 'result_submitted'
                WHEN OLD.home_score <> NEW.home_score OR OLD.away_score <> NEW.away_score THEN 'result_edited'
                WHEN OLD.match_status_reason <> NEW.match_status_reason THEN 
                    CASE NEW.match_status_reason
                        WHEN 'wo_home_absent' THEN 'wo_declared'
                        WHEN 'wo_away_absent' THEN 'wo_declared'
                        WHEN 'null_both_absent' THEN 'null_declared'
                        ELSE 'updated'
                    END
                ELSE 'updated'
            END,
            NEW.updated_by,
            NEW.updated_by_name,
            change_record,
            NEW.season_id,
            NEW.round_number,
            NEW.match_number
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for fixture updates
DROP TRIGGER IF EXISTS trigger_log_fixture_change ON fixtures;
CREATE TRIGGER trigger_log_fixture_change
    AFTER UPDATE ON fixtures
    FOR EACH ROW
    EXECUTE FUNCTION log_fixture_change();

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE fixture_audit_log IS 'Audit trail for all fixture changes';
COMMENT ON COLUMN fixture_audit_log.action_type IS 'Type of action: created, updated, result_submitted, result_edited, wo_declared, null_declared, deleted';
COMMENT ON COLUMN fixture_audit_log.changes IS 'JSONB containing old and new values of changed fields';
COMMENT ON COLUMN fixtures.match_status_reason IS 'Reason for match status: normal, wo_home_absent, wo_away_absent, null_both_absent';

-- ============================================
-- VERIFICATION
-- ============================================
SELECT '✅ Fixture audit trail system created successfully!' as status;

-- Show sample structure
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'fixture_audit_log'
ORDER BY ordinal_position;
