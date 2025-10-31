# Player Awards - Category Column Update

## Overview

Added a `category` column to the `player_awards` table to properly track category-based awards vs league-wide individual awards.

## Problem Statement

Previously, when importing player awards:
- **Category Trophies** (e.g., "Best Player in White Category") had no way to filter by category
- Could not query "Show all Best Player winners in White category across seasons"
- Category information was lost or only stored in notes as free text

## Solution

Added `category` VARCHAR(50) column to `player_awards` table:
- **Category Trophies**: Store player's category (White, Red, Blue, etc.)
- **Individual Trophies**: Store NULL (league-wide, not category-specific)

## Database Changes

### Schema Update

```sql
ALTER TABLE player_awards 
ADD COLUMN category VARCHAR(50);

-- Indexes for performance
CREATE INDEX idx_player_awards_category ON player_awards(category);
CREATE INDEX idx_player_awards_category_award ON player_awards(category, award_name);
```

### Updated Table Structure

```sql
CREATE TABLE player_awards (
    id SERIAL PRIMARY KEY,
    player_id VARCHAR(255) NOT NULL,
    player_name VARCHAR(255) NOT NULL,
    season_id INTEGER NOT NULL,
    award_name VARCHAR(255) NOT NULL,
    award_position VARCHAR(100),      -- Winner, Runner-up, Third Place
    award_value NUMERIC(10, 2),       -- Goals, assists, etc.
    category VARCHAR(50),              -- NEW: White, Red, Blue, NULL for individual
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_player_season_award UNIQUE (player_id, season_id, award_name)
);
```

## Import Behavior

### Historical Season Import

When importing players with trophies:

#### Category Trophy (e.g., "category_wise_trophy_1")
```typescript
// Player data from Excel
player.category = "White"
player.category_wise_trophy_1 = "Best Player Winner"

// Saved to database
{
  award_name: "Best Player",
  award_position: "Winner",
  category: "White",                    // From player.category
  notes: "Category Trophy - White"
}
```

#### Individual Trophy (e.g., "individual_wise_trophy_1")
```typescript
// Player data from Excel
player.individual_wise_trophy_1 = "Golden Boot Winner"

// Saved to database
{
  award_name: "Golden Boot",
  award_position: "Winner",
  category: null,                       // NULL for league-wide awards
  notes: "Individual Trophy (League-wide)"
}
```

## Query Examples

### Get all Best Player winners in White category across all seasons
```sql
SELECT 
  player_name,
  season_id,
  award_position,
  award_value
FROM player_awards
WHERE award_name = 'Best Player'
  AND category = 'White'
ORDER BY season_id;
```

### Get all category-based awards for a specific season
```sql
SELECT 
  category,
  award_name,
  player_name,
  award_position
FROM player_awards
WHERE season_id = 12
  AND category IS NOT NULL
ORDER BY category, award_name;
```

### Get all individual (league-wide) awards
```sql
SELECT 
  award_name,
  player_name,
  season_id,
  award_value
FROM player_awards
WHERE category IS NULL
ORDER BY award_name, season_id;
```

### Count awards by category
```sql
SELECT 
  category,
  COUNT(*) as total_awards,
  COUNT(DISTINCT player_id) as unique_winners
FROM player_awards
WHERE category IS NOT NULL
GROUP BY category
ORDER BY category;
```

### Get top award winners in each category
```sql
SELECT 
  category,
  player_name,
  COUNT(*) as awards_won
FROM player_awards
WHERE category IS NOT NULL
GROUP BY category, player_name
ORDER BY category, awards_won DESC;
```

## API Updates

### TypeScript Interface

```typescript
interface PlayerAward {
  id?: number;
  player_id: string;
  player_name: string;
  season_id: number;
  award_name: string;
  award_position?: string | null;
  award_value?: number | null;
  category?: string | null;          // NEW
  notes?: string | null;
  created_at?: Date;
  updated_at?: Date;
}
```

### Creating Awards with Category

```typescript
// Category trophy
await createPlayerAward({
  player_id: 'PLAYER123',
  player_name: 'Rahul',
  season_id: 12,
  award_name: 'Best Player',
  award_position: 'Winner',
  category: 'White',              // Category specified
  notes: 'Category Trophy - White'
});

// Individual trophy
await createPlayerAward({
  player_id: 'PLAYER123',
  player_name: 'Rahul',
  season_id: 12,
  award_name: 'Golden Boot',
  award_position: 'Winner',
  category: null,                 // NULL for league-wide
  notes: 'Individual Trophy (League-wide)'
});
```

## Benefits

### 1. **Proper Category Filtering**
- Query "Best Player in White" across all seasons
- Compare performance across categories
- Category-specific leaderboards

### 2. **Clear Distinction**
- Category trophies have category value
- Individual trophies have NULL category
- No ambiguity in award type

### 3. **Better Analytics**
- Awards distribution by category
- Category performance over time
- Cross-category comparisons

### 4. **Flexible Querying**
- Filter by category
- Filter by award type
- Combine both filters
- NULL-safe queries

## Example Use Cases

### 1. Category Award Winners Page
Display all awards won in White category:
- Best Player (Winner, Runner-up, etc.)
- Top Scorer in Category
- Best Goalkeeper in Category

### 2. Player Profile
Show player's awards grouped by type:
- **Category Awards** (category = 'White')
- **Individual Awards** (category IS NULL)

### 3. Historical Statistics
- "Who has won Best Player in Red category the most times?"
- "Which category has produced the most Golden Boot winners?"
- "Compare top scorers across categories"

### 4. Leaderboards
- Category-specific leaderboards
- League-wide leaderboards
- Combined views

## Migration Notes

- **New Imports**: Automatically populate category field
- **Existing Data**: Category will be NULL (can be updated if needed)
- **Backward Compatible**: NULL category means league-wide/individual
- **No Breaking Changes**: All existing queries still work

## Files Updated

1. `lib/neon/playerAwards.ts` - Added category to interface and functions
2. `app/api/seasons/historical/import/route.ts` - Import logic updated
3. `scripts/create_player_awards_table.sql` - Table creation script
4. `scripts/add-category-to-player-awards.sql` - Migration script
5. `scripts/add-category-column.js` - Node migration script

## Testing

After applying this update:

1. **Import a historical season** with category trophies
2. **Verify data**:
   ```sql
   SELECT * FROM player_awards WHERE season_id = 'SSPSLS12';
   ```
3. **Check categories are populated**:
   ```sql
   SELECT DISTINCT category FROM player_awards ORDER BY category;
   ```
4. **Query by category**:
   ```sql
   SELECT * FROM player_awards WHERE category = 'White';
   ```

## Summary

✅ Added `category` VARCHAR(50) column to `player_awards` table  
✅ Category trophies save player's category (White, Red, Blue, etc.)  
✅ Individual trophies save NULL (league-wide)  
✅ Created indexes for efficient querying  
✅ Updated TypeScript interfaces  
✅ Updated historical import logic  
✅ Updated all SQL creation scripts  

Now you can easily query and display awards by category! 🏆
