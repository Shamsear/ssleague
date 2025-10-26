# Star Rating Pricing System

## Overview
The star rating pricing system allows committee admins to set standardized prices for players based on their star ratings (3-10 stars), rather than setting individual prices for each player.

## Database Schema

### Added Column
```sql
ALTER TABLE fantasy_leagues 
ADD COLUMN star_rating_prices JSONB DEFAULT '[
  {"stars": 3, "price": 5},
  {"stars": 4, "price": 7},
  {"stars": 5, "price": 10},
  {"stars": 6, "price": 13},
  {"stars": 7, "price": 16},
  {"stars": 8, "price": 20},
  {"stars": 9, "price": 25},
  {"stars": 10, "price": 30}
]'::jsonb
```

### Data Structure
```json
[
  {"stars": 3, "price": 5},
  {"stars": 4, "price": 7},
  {"stars": 5, "price": 10},
  {"stars": 6, "price": 13},
  {"stars": 7, "price": 16},
  {"stars": 8, "price": 20},
  {"stars": 9, "price": 25},
  {"stars": 10, "price": 30}
]
```

## Frontend

### Page Location
`/dashboard/committee/fantasy/pricing/[leagueId]`

### Features
- View current star rating prices
- Edit prices for each star rating (3-10 stars)
- Visual star display for each tier
- Save changes to database
- Authorization: Committee admins only

### UI Components
- Gradient background matching other committee pages
- White cards with rounded corners
- Star icons (yellow filled) for visual representation
- Number inputs for price adjustment
- Save button with loading state
- "How It Works" info card

## API Endpoints

### GET `/api/fantasy/pricing/[leagueId]`
Fetches the current star rating pricing for a league.

**Response:**
```json
{
  "pricing": [
    {"stars": 3, "price": 5},
    {"stars": 4, "price": 7},
    {"stars": 5, "price": 10},
    {"stars": 6, "price": 13},
    {"stars": 7, "price": 16},
    {"stars": 8, "price": 20},
    {"stars": 9, "price": 25},
    {"stars": 10, "price": 30}
  ]
}
```

### PUT `/api/fantasy/pricing/[leagueId]`
Updates the star rating pricing for a league.

**Request Body:**
```json
{
  "pricing": [
    {"stars": 3, "price": 5},
    {"stars": 4, "price": 7},
    {"stars": 5, "price": 10},
    {"stars": 6, "price": 13},
    {"stars": 7, "price": 16},
    {"stars": 8, "price": 20},
    {"stars": 9, "price": 25},
    {"stars": 10, "price": 30}
  ]
}
```

**Validations:**
- Must be an array of exactly 8 items
- Each item must have `stars` (3-10) and `price` (> 0)
- Both fields must be numbers

**Response:**
```json
{
  "success": true,
  "message": "Pricing updated successfully"
}
```

## Migration Script

### Location
`scripts/add-star-rating-prices-column.ts`

### Purpose
Adds the `star_rating_prices` JSONB column to the `fantasy_leagues` table and sets default values for existing leagues.

### Usage
```bash
npx tsx scripts/add-star-rating-prices-column.ts
```

### What It Does
1. Adds `star_rating_prices` column if it doesn't exist
2. Sets default pricing for all existing leagues
3. Verifies the column was created successfully

## How It Works

1. **Committee Setup**
   - Committee admins navigate to the pricing page for their league
   - They see default pricing or previously saved pricing
   - They can adjust the price for each star rating tier

2. **Player Pricing**
   - When committee admins assign star ratings to players (3-10 stars)
   - The player's draft price is automatically determined by their star rating
   - This simplifies pricing management compared to individual player pricing

3. **Draft Process**
   - Teams see players with their star-based prices
   - Players with higher star ratings cost more credits
   - Teams must stay within their budget when drafting

## Benefits

- **Simplified Management**: Only 5 prices to manage instead of hundreds of individual player prices
- **Consistency**: All players with the same star rating have the same price
- **Balance**: Easy to adjust league economy by changing star rating prices
- **Transparency**: Teams can easily understand player values

## Next.js 15 Compatibility

The API routes use async `params` as required by Next.js 15:

```typescript
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  const { leagueId } = await params;
  // ...
}
```

## Testing

1. Navigate to `/dashboard/committee/fantasy/pricing/[leagueId]`
2. Verify default pricing loads
3. Modify prices
4. Click "Save Pricing"
5. Refresh page to confirm changes persisted
6. Check that alert modals appear for success/error states
