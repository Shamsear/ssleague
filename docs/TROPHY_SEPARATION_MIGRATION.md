# Trophy Name and Position Separation

## Overview
Updated the trophy system to store trophy name and position as separate fields instead of concatenated strings.

## Database Changes

### New Column
- **`trophy_position`** (VARCHAR 50): Stores position/achievement text
  - Examples: "Winner", "Runner Up", "Champions", "Third Place"

### Existing Columns
- **`trophy_name`** (VARCHAR 255): Now stores only the trophy name
  - Examples: "League", "UCL", "FA Cup", "DUO Cup"
- **`position`** (INTEGER): League standing position (1, 2, 3, etc.)

### Updated Unique Constraint
```sql
UNIQUE(team_id, season_id, trophy_name, trophy_position)
```

## Migration Steps

### 1. Add trophy_position Column
```bash
npx tsx scripts/add-trophy-position-column.ts
```

This will:
- Add the `trophy_position` column
- Update comments
- Create new unique constraint
- Add index for performance

### 2. Migrate Existing Data
```bash
npx tsx scripts/migrate-existing-trophies.ts
```

This will parse existing trophies and separate them:
- "League Winner" → name: "League", position: "Winner"
- "UCL Runner Up" → name: "UCL", position: "Runner Up"
- "FA Cup Champions" → name: "FA Cup", position: "Champions"
- "DUO Cup Third Place" → name: "DUO Cup", position: "Third Place"

## Code Changes

### 1. Auto-Award System (`lib/award-season-trophies.ts`)
Now saves trophies with separate fields:
```typescript
trophy_name: 'League'
trophy_position: 'Winner'  // or 'Runner Up', 'Third Place'
position: 1  // INTEGER for league standing
```

### 2. Import System (`api/seasons/historical/import/route.ts`)
Parses trophy strings from Excel:
- "UCL CHAMPIONS" → name: "UCL", position: "Champions"
- "CUP RUNNERS UP" → name: "CUP", position: "Runner Up"
- "LEAGUE WINNER" → name: "LEAGUE", position: "Winner"

### 3. Manual Trophy Addition (`dashboard/committee/trophies/page.tsx`)
Two separate dropdowns:
1. **Trophy Name**: League, UCL, FA Cup, etc.
2. **Position**: Winner, Runner Up, Champions, Third Place

### 4. API Updates
- `POST /api/trophies/add`: Accepts `trophy_position` parameter
- `addManualTrophy()`: Updated to handle `trophy_position`

## Display Format
Trophies are displayed as: `{trophy_name} {trophy_position}`
- League Winner
- UCL Runner Up
- FA Cup Champions

## Benefits

1. **Better Querying**: Can filter by trophy name OR position separately
2. **Consistency**: All trophies follow the same structure
3. **Flexibility**: Easy to add new positions or trophy types
4. **Data Integrity**: Proper normalization of trophy data

## Examples

### Before
```
trophy_name: "League Winner"
trophy_name: "UCL Runner Up"
trophy_name: "FA Cup Champions"
```

### After
```
trophy_name: "League", trophy_position: "Winner"
trophy_name: "UCL", trophy_position: "Runner Up"
trophy_name: "FA Cup", trophy_position: "Champions"
```

## Queries

### Get all Winners (any trophy)
```sql
SELECT * FROM team_trophies WHERE trophy_position = 'Winner';
```

### Get all UCL trophies (any position)
```sql
SELECT * FROM team_trophies WHERE trophy_name = 'UCL';
```

### Get UCL Champions only
```sql
SELECT * FROM team_trophies 
WHERE trophy_name = 'UCL' AND trophy_position = 'Champions';
```

## Backwards Compatibility

- Old trophies without `trophy_position` will display just the `trophy_name`
- Migration script handles all existing formats
- New trophies must have both fields populated
