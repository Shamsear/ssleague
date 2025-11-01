# Lineup Category Requirements Feature

## Overview
Added the ability for admins to configure minimum category requirements for lineups in tournament settings. This feature allows tournaments to enforce how many players from each category (e.g., Classic, Legend, etc.) must be included in a team's starting 11.

## Changes Made

### 1. Database Schema
**SQL Migration** (Already executed by user):
```sql
ALTER TABLE tournament_settings 
ADD COLUMN lineup_category_requirements JSONB DEFAULT '{}'::jsonb;
```

This stores category requirements as a JSON object where:
- Keys are category IDs (e.g., `cat_classic`, `cat_legend`)
- Values are the minimum count required in starting XI

### 2. Backend Updates

#### `lib/lineup-validation.ts`
- **Updated `validateLineup()` function** (lines 103-128)
  - Added step 6 to check tournament settings for category requirements
  - Fetches `lineup_category_requirements` from tournament_settings table
  - Validates that each category has the minimum required players in starting XI
  - Generates specific error messages for each category violation

#### `app/api/tournament-settings/route.ts`
- **Already supported** `lineup_category_requirements` parameter (line 74, 102, 121, 140)
- No changes needed - the API already handles this field in POST requests

#### `app/api/categories/route.ts`
- **Already exists** - GET endpoint fetches all categories ordered by priority
- Used by frontend to display category options in tournament settings

### 3. Frontend Updates

#### `app/dashboard/committee/team-management/tournament/page.tsx`

##### State Management
- **Added categories state** (line 102):
  ```typescript
  const [categories, setCategories] = useState<any[]>([]);
  ```

- **Updated `newTournament` initial state** (line 78):
  ```typescript
  lineup_category_requirements: {}
  ```

##### Data Fetching
- **Added `fetchCategories()` function** (lines 198-208):
  - Fetches all categories from `/api/categories`
  - Called on component mount
  
- **Updated form reset** (line 298):
  - Includes `lineup_category_requirements: {}` when resetting form

##### Create Tournament Form
- **Added "Lineup Category Requirements" section** (lines 1685-1726):
  - Displays all categories in a grid layout
  - Shows category name with icon
  - Number input (0-5) for each category
  - Updates `newTournament.lineup_category_requirements` state
  - Responsive grid: 1 column on mobile, 2 on tablet, 3 on desktop

##### Edit Tournament Form
- **Added "Lineup Category Requirements" section** (lines 1907-1948):
  - Same UI as create form
  - Updates `editingTournament.lineup_category_requirements` state

- **Updated settings submission** (line 1816):
  - Includes `lineup_category_requirements` in POST to `/api/tournament-settings`

- **Updated edit button handler** (lines 2113-2130):
  - Fetches tournament settings when clicking edit
  - Loads existing `lineup_category_requirements` into edit form
  - Falls back to empty object if settings don't exist

## How It Works

### Admin Workflow
1. Admin goes to Tournament Management page
2. Creates or edits a tournament
3. Scrolls to "Lineup Category Requirements" section
4. Sets minimum number of players required from each category (0-5)
5. Saves tournament settings

### Validation Workflow
1. Team submits a lineup for a match
2. Backend calls `validateLineup()` function
3. If tournament has category requirements:
   - Counts players by category in starting XI
   - Compares actual count vs. required minimum
   - Returns validation errors if requirements not met
4. Team sees specific error messages like:
   - "Starting XI must have at least 2 player(s) from cat_classic category (currently has 1)"

## Example Use Case

**Tournament Rule**: "Each team must field at least 2 Classic players and 1 Legend player in their starting XI"

**Settings**:
```json
{
  "cat_classic": 2,
  "cat_legend": 1
}
```

**Validation**:
- Team submits lineup with 1 Classic, 2 Legend, 2 other players → ❌ Rejected (needs 2 Classic)
- Team submits lineup with 2 Classic, 1 Legend, 2 other players → ✅ Accepted

## Testing Recommendations

1. **Create Tournament**: Verify category requirements can be set and saved
2. **Edit Tournament**: Verify existing requirements load correctly
3. **Lineup Submission**: Test validation with various category combinations
4. **Multiple Categories**: Test with different category configurations
5. **Edge Cases**: 
   - No requirements set (should allow any lineup)
   - All players from one category
   - Exactly meeting requirements

## Notes

- Category requirements are **per tournament**, allowing different rules for different competitions
- Setting a requirement to 0 means no minimum for that category
- The starting XI must have exactly 5 players (existing validation)
- Substitutes are not validated against category requirements
- If no requirements are set, validation passes (backward compatible)
