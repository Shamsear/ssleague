# Multi-Season Contract System (Season 16+)

## Overview
Starting from Season 16, the system transitions from single-season to multi-season with player contracts, dual currency, and salary management.

## Key Differences: Single vs Multi Season

| Feature | Single Season (1-15) | Multi Season (16+) |
|---------|---------------------|-------------------|
| **Contract Duration** | 1 season | 2 seasons (fixed) |
| **Currency** | Single (purseAmount) | Dual ($ for real players, € for football players) |
| **Player Assignment** | Per season | Spans multiple seasons |
| **Salary System** | None | Per match (real) / Per half-season (football) |
| **Contract Expiry** | N/A | Auto-removes players after 2 seasons |
| **Player Categories** | None | Legend/Classic (auto-calculated) |

---

## Season Structure

### Season Types
```typescript
type SeasonType = 'single' | 'multi';
```

### Multi-Season Fields
```typescript
{
  type: 'multi',
  dollar_budget: 1000,        // Initial $ for real players
  euro_budget: 10000,         // Initial € for football players
  min_real_players: 5,
  max_real_players: 7,
  max_football_players: 25,
  category_fine_amount: 20    // Fine for not meeting match requirements
}
```

---

## Dual Currency System

### Real Players (SS Members) - Dollar ($)
- **Initial Balance:** $1,000 per team
- **Player Slots:** 5-7 players (enforced)
- **Auction:** Manual via WhatsApp (admin assigns in system)
- **Contract:** 2 seasons
- **Star Rating:** 3★ to 10★ (initially assigned, auto-updates)

#### Salary Calculation
```
Salary per match = (auction_value ÷ 100) × star_rating ÷ 10

Example: 10★ player bought for $300
→ ($300 ÷ 100) × 10 ÷ 10 = $3 per match
```

#### Salary Deduction
- **Timing:** After each match result is updated
- **Deducted from:** Team's `dollar_balance`

### Football Players - Euro (€)
- **Initial Balance:** €10,000 per team
- **Player Slots:** 25 max
- **Auction:** In-app (existing auction system)
- **Contract:** 2 seasons

#### Salary Calculation
```
Salary per half-season = auction_value × 10%

Example: Messi bought for €1,000
→ Salary = €100 per half-season
```

#### Salary Deduction
- **Timing:** At mid-season (e.g., after round 19 of 38)
- **Deducted from:** Team's `euro_balance`

---

## Contract System

### Contract Duration
- **All contracts:** Exactly 2 seasons
- **Start:** Season player is assigned
- **End:** Start season + 1

Example:
```
Player signed in Season 16
→ contract_start_season: "16"
→ contract_end_season: "17"
```

### Contract Expiry
- **Automatic:** Player removed from team when contract expires
- **Status:** `contract_status` changes from `'active'` to `'expired'`
- **Re-auction:** Expired players become free agents for new auction

---

## Real Player System

### Star Rating & Points

#### Initial Points by Star Rating
| Star Rating | Initial Points |
|-------------|---------------|
| 3★ | 100p |
| 4★ | 120p |
| 5★ | 145p |
| 6★ | 175p |
| 7★ | 210p |
| 8★ | 250p |
| 9★ | 300p |
| 10★ | 350-400p |

#### Points Updates
- **After each match:** Auto-calculated based on Goal Difference (GD)
- **Formula:** 1 GD = 1 point
- **Max change per match:** ±5 points

#### Star Rating Updates
- **Automatic:** Star rating recalculated based on current points
- **Timing:** After points change from match results

---

## Category System

### Categories
- **Legend:** Top 50% of players (by points, league-wide)
- **Classic:** Bottom 50% of players

### Category Assignment
- **Initial:** Based on star rating / initial points
- **Dynamic:** Auto-updates as points change
- **Scope:** League-wide ranking (not per-team)

### Match Requirements
Each match lineup MUST have:
- **Minimum 2 Legend players**
- **Minimum 3 Classic players**

### Category Violation Fine
- **Amount:** $20 (configurable)
- **Deducted from:** Team's `dollar_balance`
- **Applied:** When match lineup doesn't meet requirements

---

## Team Balance Management

### Team Data Structure (Multi-Season)
```typescript
{
  // Legacy (single-season)
  balance: number,
  
  // Multi-season dual currency
  dollar_balance: 1000,          // $ for real players
  euro_balance: 10000,           // € for football players
  dollar_spent: 0,               // Total $ spent
  euro_spent: 0,                 // Total € spent
  dollar_salaries_committed: 0,  // Total salary/match
  euro_salaries_committed: 0     // Total salary/half-season
}
```

### Payment Flow

#### Real Player Assignment
1. Committee admin conducts WhatsApp auction
2. Admin assigns player in system with auction value
3. System:
   - Deducts `auction_value` from `dollar_balance`
   - Calculates and stores `salary_per_match`
   - Creates 2-season contract
   - Assigns initial points based on star rating

#### Football Player Auction
1. In-app auction (existing system)
2. When player sold:
   - Deducts `auction_value` from `euro_balance`
   - Calculates `salary_per_half_season` (10% of value)
   - Creates 2-season contract

#### Salary Deductions
- **Real Players:** After each match finalization
- **Football Players:** At mid-season trigger

---

## Database Schema Changes

### `seasons` Collection
```typescript
{
  type: 'single' | 'multi',
  dollar_budget?: 1000,
  euro_budget?: 10000,
  min_real_players?: 5,
  max_real_players?: 7,
  max_football_players?: 25,
  category_fine_amount?: 20
}
```

### `realplayers` Collection
```typescript
{
  // Multi-season fields
  star_rating?: number,
  points?: number,
  category?: 'legend' | 'classic',
  auction_value?: number,
  salary_per_match?: number,
  contract_start_season?: string,
  contract_end_season?: string,
  contract_status?: 'active' | 'expired'
}
```

### `footballplayers` Collection
```typescript
{
  // Multi-season fields
  auction_value?: number,
  salary_per_half_season?: number,
  contract_start_season?: string,
  contract_end_season?: string,
  contract_status?: 'active' | 'expired'
}
```

### `teams` Collection
```typescript
{
  // Legacy
  balance: number,
  
  // Multi-season
  dollar_balance?: number,
  euro_balance?: number,
  dollar_spent?: number,
  euro_spent?: number,
  dollar_salaries_committed?: number,
  euro_salaries_committed?: number
}
```

---

## Utility Functions (lib/contracts.ts)

### Salary Calculations
```typescript
// Real players
calculateRealPlayerSalary(auctionValue, starRating)
→ (auctionValue ÷ 100) × starRating ÷ 10

// Football players
calculateFootballPlayerSalary(auctionValue)
→ auctionValue × 0.1
```

### Contract Management
```typescript
// Calculate end season (2 seasons from start)
calculateContractEndSeason(startSeasonId)

// Check if contract is active
isContractActive(startSeason, endSeason, currentSeason)

// Check if contract expired
isContractExpired(endSeason, currentSeason)
```

### Points & Star Ratings
```typescript
// Calculate star rating from points
calculateStarRating(points)

// Get initial points for star rating
getInitialPoints(starRating)

// Update points after match
updatePlayerPoints(currentPoints, goalDifference)
```

### Category Management
```typescript
// Calculate player category (league-wide)
calculatePlayerCategory(playerPoints, allPlayerPoints)

// Update all players' categories
updateAllPlayerCategories(players)

// Validate match lineup
validateMatchLineup(playerIds, playerCategories)
→ { valid, legendCount, classicCount }
```

### Contract Creation
```typescript
// Create real player contract
createRealPlayerContract({
  playerId, teamId, starRating, 
  auctionValue, startSeasonId
})

// Create football player contract
createFootballPlayerContract({
  playerId, teamId, auctionValue, startSeasonId
})
```

---

## Implementation Workflow

### 1. Creating Season 16
```typescript
const seasonData = {
  name: "Season 16",
  year: "2025",
  type: 'multi',
  dollar_budget: 1000,
  euro_budget: 10000,
  min_real_players: 5,
  max_real_players: 7,
  max_football_players: 25,
  category_fine_amount: 20
};
```

### 2. Creating Teams for Season 16
```typescript
const teamData = {
  team_name: "Team A",
  season_id: "season16",
  dollar_balance: 1000,
  euro_balance: 10000,
  dollar_spent: 0,
  euro_spent: 0,
  dollar_salaries_committed: 0,
  euro_salaries_committed: 0
};
```

### 3. Assigning Real Player (Manual from WhatsApp)
```typescript
import { createRealPlayerContract } from '@/lib/contracts';

const contractData = createRealPlayerContract({
  playerId: "sspslpsl0001",
  teamId: "team0001",
  starRating: 8,
  auctionValue: 250,
  startSeasonId: "16"
});

// Update player with contract data
// Deduct $250 from team's dollar_balance
// Add salary_per_match to team's dollar_salaries_committed
```

### 4. Football Player Auction (In-App)
```typescript
import { createFootballPlayerContract } from '@/lib/contracts';

// When player sold in auction
const contractData = createFootballPlayerContract({
  playerId: "player123",
  teamId: "team0001",
  auctionValue: 1000,
  startSeasonId: "16"
});

// Update player with contract data
// Deduct €1000 from team's euro_balance
// Add salary_per_half_season to team's euro_salaries_committed
```

### 5. Match Finalization (Real Player Salary Deduction)
```typescript
// After match result updated
const matchResult = {
  teamAScore: 3,
  teamBScore: 1,
  teamAPlayers: [...playerIds],
  teamBPlayers: [...playerIds]
};

// For each real player in match:
// 1. Calculate GD
// 2. Update player points
// 3. Recalculate star rating
// 4. Deduct salary_per_match from team's dollar_balance
// 5. Update categories league-wide
```

### 6. Mid-Season (Football Player Salary Deduction)
```typescript
// When current_round === (total_rounds / 2)
// For each team:
//   For each football player:
//     Deduct salary_per_half_season from euro_balance
```

### 7. Season End (Contract Check)
```typescript
// When Season 17 ends
// For all players with contract_end_season === "17":
//   Set contract_status = 'expired'
//   Remove from team
//   Add to free agent pool for re-auction
```

---

## Migration Notes

### Historical Seasons (1-15)
- **Add field:** `type: 'single'`
- **No contract data needed**
- **Legacy balance system remains**

### Transition to Season 16
- **Fresh start:** New auction for all players
- **Teams registered** with dual balances
- **All players get 2-season contracts**

---

## Next Steps for Full Implementation

1. **Update Season Creation UI** - Add multi-season fields
2. **Update Team Registration** - Initialize dual balances
3. **Real Player Assignment UI** - Admin form for WhatsApp auction results
4. **Update Match Finalization** - Add salary deduction & points calculation
5. **Mid-Season Trigger** - Football player salary deduction
6. **Contract Expiry Handler** - Remove expired contracts
7. **Category Display** - Show Legend/Classic badges on players
8. **Match Lineup Validation** - Check category requirements before match
9. **Budget Display** - Show both $ and € balances separately
10. **Contract Status Display** - Show contract duration on player cards

---

## Testing Checklist

- [ ] Create Season 16 with `type: 'multi'`
- [ ] Create teams with dual balances
- [ ] Assign real player via admin form
- [ ] Verify salary calculation
- [ ] Verify contract creation (2 seasons)
- [ ] Verify balance deduction
- [ ] Run match, verify points update
- [ ] Verify star rating recalculation
- [ ] Verify category assignment
- [ ] Verify match lineup validation
- [ ] Verify category fine application
- [ ] Auction football player in-app
- [ ] Verify euro balance deduction
- [ ] Trigger mid-season salary deduction
- [ ] End Season 17, verify contract expiry
- [ ] Verify player removal from team

---

## Configuration

All default values are defined in Season creation:
```typescript
DEFAULT_DOLLAR_BUDGET = 1000
DEFAULT_EURO_BUDGET = 10000
MIN_REAL_PLAYERS = 5
MAX_REAL_PLAYERS = 7
MAX_FOOTBALL_PLAYERS = 25
CATEGORY_FINE = 20
CONTRACT_DURATION = 2 seasons
```

These can be adjusted per season if needed in the future.
