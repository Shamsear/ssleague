# Instagram Integration for Awards Page

## Overview
The awards page now fetches and displays Instagram posts automatically using Instagram's oEmbed API.

## How It Works

### 1. Database Setup
Three tables have the `instagram_link` column:
- `awards` - For POTD, POTW, POTS, TOTS awards
- `player_awards` - For Golden Boot, Best Player awards
- `team_trophies` - For league trophies and cups

### 2. Component: InstagramEmbed
Location: `components/InstagramEmbed.tsx`

**Features:**
- Fetches Instagram post data using oEmbed API
- No authentication required (works with public posts)
- Automatic loading states and error handling
- Falls back to clickable button if post can't be loaded

**Usage:**
```tsx
<InstagramEmbed 
  postUrl="https://www.instagram.com/p/DPT5g8SAfKO/" 
  className="rounded-xl overflow-hidden" 
/>
```

### 3. Awards Page Integration
Location: `app/awards/page.tsx`

The page automatically:
1. Fetches awards data from API (includes `instagram_link`)
2. Displays Instagram embeds for awards that have links
3. Shows all three types: Awards, Player Awards, and Trophies

## Adding Instagram Links

### Via Database
Insert or update the `instagram_link` column with the Instagram post URL:

```sql
-- For regular awards
UPDATE awards 
SET instagram_link = 'https://www.instagram.com/p/POST_ID/' 
WHERE id = 'award_id';

-- For player awards
UPDATE player_awards 
SET instagram_link = 'https://www.instagram.com/p/POST_ID/' 
WHERE id = 'award_id';

-- For trophies
UPDATE team_trophies 
SET instagram_link = 'https://www.instagram.com/p/POST_ID/' 
WHERE id = 'trophy_id';
```

### Instagram Post URL Format
The component accepts these formats:
- `https://www.instagram.com/p/DPT5g8SAfKO/`
- `https://www.instagram.com/p/DPT5g8SAfKO/?utm_source=ig_web_copy_link`

## Technical Details

### API Used
**Instagram oEmbed API**
- Endpoint: `https://api.instagram.com/oembed/?url={POST_URL}`
- No authentication needed
- Works with public posts only
- Returns HTML embed code

### What Gets Displayed
The Instagram embed shows:
- Post image/video
- Caption
- Like/comment counts
- "View on Instagram" link
- Author information

### Error Handling
If the post can't be loaded (private, deleted, or blocked):
- Shows a fallback button linking to Instagram
- User can click to open the post directly on Instagram

## Browser Compatibility
Works on all modern browsers. Instagram's embed script is loaded automatically.

## Performance
- Posts are fetched client-side (after page load)
- Loading states prevent layout shift
- Each post is independently fetched
