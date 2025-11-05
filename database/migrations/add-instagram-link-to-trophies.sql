-- ============================================
-- ADD INSTAGRAM LINK COLUMN TO ALL AWARD TABLES
-- Allows superadmin to add Instagram embed links for trophy/award photos
-- Applies to: team_trophies, awards, player_awards
-- ============================================

-- Add instagram_link column to team_trophies
ALTER TABLE team_trophies 
ADD COLUMN IF NOT EXISTS instagram_link TEXT;

-- Add instagram_link column to awards (POTD, POTW, POTS, TOTS)
ALTER TABLE awards 
ADD COLUMN IF NOT EXISTS instagram_link TEXT;

-- Add instagram_link column to player_awards (Golden Boot, Best Attacker, etc.)
ALTER TABLE player_awards 
ADD COLUMN IF NOT EXISTS instagram_link TEXT;

-- Add comments for documentation
COMMENT ON COLUMN team_trophies.instagram_link IS 'Instagram embed URL for trophy photo';
COMMENT ON COLUMN awards.instagram_link IS 'Instagram embed URL for award photo';
COMMENT ON COLUMN player_awards.instagram_link IS 'Instagram embed URL for award photo';

-- ============================================
-- VERIFICATION QUERY
-- ============================================

SELECT '✅ instagram_link column added to all award tables successfully!' as status;
