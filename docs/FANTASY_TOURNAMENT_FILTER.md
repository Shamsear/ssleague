# Fantasy League Tournament Filter

## Overview
Added ability to control which tournaments contribute to fantasy league points.

## Feature: "Include in Fantasy League"

### What It Does
- Committee admins can now choose whether a tournament's stats count towards fantasy league
- When creating a tournament, there's a checkbox: **"Include in Fantasy League"**
- Default: ✅ **Checked** (true)

### Use Cases

#### ✅ **Check the box** (Include in Fantasy):
- **Main League** - Primary competition that should count for fantasy
- **Season-long tournaments** - Competitions that run throughout the season
- **Major tournaments** - Important competitions you want in fantasy scoring

#### ☐ **Uncheck the box** (Exclude from Fantasy):
- **Mid-season cups** - Separate knockout competitions added mid-season
- **Friendly tournaments** - Practice/exhibition matches
- **Side competitions** - Tournaments you want isolated from main fantasy league

## Database Changes

### SQL Migration
Run this SQL on your tournaments database:

```sql
-- Add the column
ALTER TABLE tournaments 
ADD COLUMN IF NOT EXISTS include_in_fantasy BOOLEAN DEFAULT true;

-- Update existing tournaments
UPDATE tournaments 
SET include_in_fantasy = true 
WHERE include_in_fantasy IS NULL;
```

Location: `scripts/migrations/add-include-in-fantasy.sql`

## How It Works

### 1. Tournament Creation (UI)
- Form field added: **"Include in Fantasy League"** checkbox
- Tooltip explains: "Check this to include player stats and points from this tournament in fantasy league calculations"
- Default value: `true`

### 2. Tournament API
- `POST /api/tournaments` now accepts `include_in_fantasy` field
- Field stored in database with tournament record
- Updates on tournament edit

### 3. Fantasy Points Calculation
- When fixture results are submitted, system checks `include_in_fantasy`
- If `include_in_fantasy = false` → Skip fantasy point calculation
- If `include_in_fantasy = true` → Calculate points normally
- Backward compatible: If check fails, points are calculated (safe fallback)

## Code Changes

### Files Modified:

1. **UI: Tournament Creation Form**
   - `app/dashboard/committee/team-management/tournament/page.tsx`
   - Added checkbox with tooltip

2. **API: Tournament Endpoints**
   - `app/api/tournaments/route.ts`
   - Added `include_in_fantasy` field to INSERT/UPDATE

3. **Fantasy: Points Calculation**
   - `app/api/fantasy/calculate-points/route.ts`
   - Added tournament check before calculating points

4. **Database: Migration**
   - `scripts/migrations/add-include-in-fantasy.sql`
   - SQL to add column

## Example Workflow

### Scenario: Season with League + Mid-Season Cup

```
1. Season starts:
   CREATE "Season 16 League"
   ✅ Include in Fantasy League [CHECKED]
   → Fantasy league created automatically
   → All stats count towards fantasy

2. Mid-season Cup added:
   CREATE "FA Cup" (mid-season)
   ☐ Include in Fantasy League [UNCHECKED]
   → Separate competition
   → Stats tracked but DON'T affect fantasy
   → Fantasy rankings stay focused on league

3. Result:
   - League matches → Update fantasy points ✅
   - Cup matches → Track separately ❌
   - Players have stats in both but fantasy only from league
```

## API Usage

### Creating Tournament with Fantasy Control

```bash
POST /api/tournaments
{
  "season_id": "SSPSLS16",
  "tournament_type": "cup",
  "tournament_name": "FA Cup",
  "status": "active",
  "include_in_fantasy": false  // ← Control fantasy inclusion
}
```

### Response
```json
{
  "success": true,
  "tournament": {
    "id": "SSPSLS16-CUP",
    "tournament_name": "FA Cup",
    "include_in_fantasy": false,
    ...
  }
}
```

## Testing

### Manual Test
1. Go to: `/dashboard/committee/team-management/tournament`
2. Click "Tournament Management" tab
3. Create new tournament
4. Verify "Include in Fantasy League" checkbox exists
5. Uncheck it for a test cup
6. Submit fixture result in that tournament
7. Verify no fantasy points were calculated

### Expected Logs
```
✅ Tournament included: "Fantasy points calculated for 20 players"
❌ Tournament excluded: "Tournament SSPSLS16-CUP excluded from fantasy league"
```

## Migration Steps

1. **Run SQL Migration:**
   ```bash
   # Connect to your tournament database
   # Run: scripts/migrations/add-include-in-fantasy.sql
   ```

2. **Verify Column Added:**
   ```sql
   SELECT id, tournament_name, include_in_fantasy 
   FROM tournaments;
   ```

3. **Test UI:**
   - Create new tournament
   - Verify checkbox appears
   - Submit and check database

4. **Test Fantasy:**
   - Submit fixture in excluded tournament
   - Verify no fantasy points calculated

## Backward Compatibility

- **Existing tournaments:** Default to `include_in_fantasy = true`
- **Missing column:** Fantasy calculation continues (safe fallback)
- **Old API calls:** Work without `include_in_fantasy` field (defaults to true)

## Future Enhancements

Potential additions:
- [ ] Bulk update tournaments' fantasy inclusion
- [ ] Fantasy league dashboard showing which tournaments are included
- [ ] "View excluded tournaments" filter
- [ ] Tournament exclusion history/audit log

## Status
✅ **Complete** - Ready for use

## Last Updated
October 25, 2025
