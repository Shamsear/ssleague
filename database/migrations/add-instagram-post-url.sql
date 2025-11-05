-- Add instagram_post_url column to store the actual Instagram post link
-- instagram_link = image URL (local or CDN)
-- instagram_post_url = clickable Instagram post link

ALTER TABLE awards 
ADD COLUMN IF NOT EXISTS instagram_post_url TEXT;

ALTER TABLE player_awards 
ADD COLUMN IF NOT EXISTS instagram_post_url TEXT;

ALTER TABLE team_trophies 
ADD COLUMN IF NOT EXISTS instagram_post_url TEXT;

COMMENT ON COLUMN awards.instagram_post_url IS 'Instagram post URL to open when image is clicked';
COMMENT ON COLUMN player_awards.instagram_post_url IS 'Instagram post URL to open when image is clicked';
COMMENT ON COLUMN team_trophies.instagram_post_url IS 'Instagram post URL to open when image is clicked';

SELECT '✅ instagram_post_url column added to all award tables successfully!' as status;
