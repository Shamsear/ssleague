# Award Instagram Links Feature

## Overview
Superadmins can now add Instagram embed links to all award types: Team Trophies, General Awards (POTD, POTW, etc.), and Player Awards (Golden Boot, etc.). This allows displaying trophy/award photos directly from Instagram.

## Database Changes

### Migration File
**Location:** `database/migrations/add-instagram-link-to-trophies.sql`

Adds `instagram_link` column (TEXT type) to three tables:
- `team_trophies` - For team trophies (League Winner, UCL, etc.)
- `awards` - For general awards (POTD, POTW, POTS, TOTS, etc.)
- `player_awards` - For player awards (Golden Boot, Best Attacker, etc.)

### Running the Migration
```sql
-- Connect to your database and run:
\i database/migrations/add-instagram-link-to-trophies.sql
```

Or via Neon/PostgreSQL client:
```bash
psql <your-connection-string> -f database/migrations/add-instagram-link-to-trophies.sql
```

## Superadmin Interface

### Access
Navigate to: **Dashboard → Super Admin → Award Photos**
URL: `/dashboard/superadmin/award-photos`

### Features
1. **Season Selector** - Choose which season's awards to manage
2. **Three Tabs:**
   - 🏆 Team Trophies
   - ⭐ General Awards
   - 👟 Player Awards
3. **Edit/Add Links** - Click button to add or edit Instagram link for each award
4. **Instructions** - Built-in guide on how to get Instagram embed links

### How to Add Instagram Links

1. Go to the Instagram post on web browser
2. Click three dots (•••) menu
3. Select "Embed"
4. Copy the embed URL (e.g., `https://www.instagram.com/p/ABC123/embed`)
5. Paste in the input field
6. Click "Save"

## API Endpoints

### Team Trophies
**PATCH** `/api/trophies/[id]`
```json
{
  "instagram_link": "https://www.instagram.com/p/ABC123/embed"
}
```

### General Awards
**PATCH** `/api/awards/[id]`
```json
{
  "instagram_link": "https://www.instagram.com/p/ABC123/embed"
}
```

### Player Awards
**PATCH** `/api/player-awards/[id]`
```json
{
  "instagram_link": "https://www.instagram.com/p/ABC123/embed"
}
```

## File Changes

### New Files
1. `app/dashboard/superadmin/award-photos/page.tsx` - Management interface
2. `app/api/awards/[id]/route.ts` - Awards update API
3. `database/migrations/add-instagram-link-to-trophies.sql` - Database migration

### Modified Files
1. `app/dashboard/superadmin/page.tsx` - Added link to Award Photos
2. `app/api/trophies/[id]/route.ts` - Added PATCH method
3. `app/api/player-awards/[id]/route.ts` - Added PATCH method

## Usage Example

### Before
```
Trophy: UCL Winner
Team: Manchester United
(No photo)
```

### After
```
Trophy: UCL Winner
Team: Manchester United
Instagram Link: https://www.instagram.com/p/ABC123/embed
(Photo will be embedded when displayed)
```

## Display Integration (Future)

To display Instagram embeds in award cards:
```tsx
{trophy.instagram_link && (
  <iframe
    src={trophy.instagram_link}
    width="100%"
    height="400"
    frameBorder="0"
    scrolling="no"
    allowTransparency
  />
)}
```

## Security Notes

- Only superadmins can access the Award Photos page
- Instagram links are stored as plain text URLs
- Links are optional - awards work normally without them
- Empty string or null clears the link

## Testing

1. Run the database migration
2. Login as superadmin
3. Navigate to Award Photos page
4. Select a season
5. Choose a tab (Trophies/Awards/Player Awards)
6. Click "Add Link" on any award
7. Paste an Instagram embed URL
8. Click "Save"
9. Verify the link is displayed and clickable

## Notes

- Instagram embed URLs typically follow this format: `https://www.instagram.com/p/{POST_ID}/embed`
- You can also paste the full iframe code - the URL will be extracted
- Links can be edited or removed at any time
- All three award types work independently
