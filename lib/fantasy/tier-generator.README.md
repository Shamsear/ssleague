# Tier Generation Algorithm

## Overview

The tier generation algorithm divides players into N equal tiers based on their performance (total points). This is used for the tiered draft system where teams bid on players tier-by-tier.

## Features

- ✅ Sorts players by total points (descending)
- ✅ Divides players into N equal tiers
- ✅ Handles uneven distribution (distributes remainder to first tiers)
- ✅ Calculates tier statistics (min/max/avg points)
- ✅ Assigns tier names (Elite, Premium, Stars, etc.)
- ✅ Saves/retrieves tiers from database
- ✅ Handles 300+ players efficiently (<2s)

## Usage

### Generate Tiers

```typescript
import { generateDraftTiers, saveTiersToDatabase } from '@/lib/fantasy/tier-generator';

// Generate tiers
const tiers = await generateDraftTiers({
  leagueId: 'SSPSLFLS16',
  numberOfTiers: 7,
  draftType: 'initial',
  minGamesPlayed: 1 // Optional, default: 1
});

// Save to database
await saveTiersToDatabase('SSPSLFLS16', tiers);
```

### Retrieve Tiers

```typescript
import { getTiersFromDatabase } from '@/lib/fantasy/tier-generator';

const tiers = await getTiersFromDatabase('SSPSLFLS16', 'initial');
```

### Delete Tiers

```typescript
import { deleteTiersFromDatabase } from '@/lib/fantasy/tier-generator';

await deleteTiersFromDatabase('SSPSLFLS16', 'initial');
```

## Tier Structure

```typescript
interface Tier {
  tier_id: string;           // Unique identifier
  tier_number: number;        // 1-7 (1 = highest tier)
  tier_name: string;          // Elite, Premium, Stars, etc.
  players: Player[];          // Array of players in this tier
  player_count: number;       // Number of players
  min_points: number;         // Minimum points in tier
  max_points: number;         // Maximum points in tier
  avg_points: number;         // Average points in tier
}
```

## Tier Names

The algorithm supports 5-10 tiers with predefined names:

- **5 tiers**: Elite, Stars, Quality, Solid, Prospects
- **6 tiers**: Elite, Premium, Stars, Quality, Solid, Prospects
- **7 tiers**: Elite, Premium, Stars, Quality, Solid, Reliable, Prospects
- **8 tiers**: Elite, Premium, Stars, Quality, Solid, Reliable, Prospects, Emerging
- **9 tiers**: Elite, Premium, Stars, Quality, Solid, Reliable, Prospects, Emerging, Depth
- **10 tiers**: Elite, Premium, Stars, Quality, Solid, Reliable, Prospects, Emerging, Depth, Reserve

## Algorithm Details

### 1. Player Sorting

Players are sorted by:
1. **Primary**: Total points (descending)
2. **Secondary**: Average points per game (descending)
3. **Tertiary**: Player name (alphabetical)

### 2. Tier Division

Players are divided into N equal tiers:

```
totalPlayers = 300
numberOfTiers = 7
basePlayersPerTier = floor(300 / 7) = 42
remainder = 300 % 7 = 6

Tier 1: 42 + 1 = 43 players (gets remainder)
Tier 2: 42 + 1 = 43 players (gets remainder)
Tier 3: 42 + 1 = 43 players (gets remainder)
Tier 4: 42 + 1 = 43 players (gets remainder)
Tier 5: 42 + 1 = 43 players (gets remainder)
Tier 6: 42 + 1 = 43 players (gets remainder)
Tier 7: 42 + 0 = 42 players

Total: 43 * 6 + 42 = 300 ✅
```

### 3. Tier Statistics

For each tier, calculate:
- **Min Points**: Lowest points in tier
- **Max Points**: Highest points in tier
- **Avg Points**: Average points in tier (rounded to 2 decimals)

## Testing

### Unit Tests

Run unit tests with mock data:

```bash
npx tsx scripts/test-tier-generator.ts
```

Tests cover:
- ✅ 300 players into 7 tiers
- ✅ Uneven distribution (10 players into 3 tiers)
- ✅ Tier stats calculation
- ✅ Performance (350 players < 2s)
- ✅ Sorting verification

### Integration Tests

Test with real database data:

```bash
npx tsx scripts/test-tier-generator-real-data.ts
```

**Note**: Update the `testLeagueId` in the script to match your actual league ID.

## Performance

- **300 players**: ~1ms
- **350 players**: ~1ms
- **Target**: < 2000ms ✅

The algorithm is highly efficient and can handle large player pools without performance issues.

## Database Schema

Tiers are stored in the `fantasy_draft_tiers` table:

```sql
CREATE TABLE fantasy_draft_tiers (
  id SERIAL PRIMARY KEY,
  tier_id VARCHAR(100) UNIQUE NOT NULL,
  league_id VARCHAR(100) NOT NULL,
  draft_type VARCHAR(20) NOT NULL,
  tier_number INTEGER NOT NULL,
  tier_name VARCHAR(100),
  player_ids JSONB NOT NULL,
  player_count INTEGER NOT NULL,
  min_points INTEGER,
  max_points INTEGER,
  avg_points DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(league_id, draft_type, tier_number)
);
```

## Edge Cases

### 1. No Players Available

```typescript
// Throws error
await generateDraftTiers({
  leagueId: 'empty_league',
  numberOfTiers: 7,
  draftType: 'initial'
});
// Error: "No available players found for tier generation"
```

### 2. More Tiers Than Players

```typescript
// Creates tiers with 0 players
const tiers = await generateDraftTiers({
  leagueId: 'small_league',
  numberOfTiers: 10,
  draftType: 'initial'
});
// Result: First 2 tiers have 1 player each, rest have 0
```

### 3. Single Tier

```typescript
// All players in one tier
const tiers = await generateDraftTiers({
  leagueId: 'league_1',
  numberOfTiers: 1,
  draftType: 'initial'
});
// Result: 1 tier with all players
```

## Example Output

```
🎯 Generating 7 tiers for league: SSPSLFLS16
   Draft type: initial
   Min games played: 1
📊 Found 300 available players
✅ Generated 7 tiers successfully
   Tier 1 (Elite): 43 players, 258-300 pts (avg: 279)
   Tier 2 (Premium): 43 players, 215-257 pts (avg: 236)
   Tier 3 (Stars): 43 players, 172-214 pts (avg: 193)
   Tier 4 (Quality): 43 players, 129-171 pts (avg: 150)
   Tier 5 (Solid): 43 players, 86-128 pts (avg: 107)
   Tier 6 (Reliable): 43 players, 43-85 pts (avg: 64)
   Tier 7 (Prospects): 42 players, 1-42 pts (avg: 21.5)
```

## Next Steps

After generating tiers, you can:

1. **Display tiers to teams** for bidding
2. **Process tier bids** using the draft processor
3. **Assign players** to winning bidders
4. **Update team budgets** and squads

See the design document for the complete draft flow.
