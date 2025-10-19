# Multi-Season System - Quick Reference

## What Changed (Season 16+)

### Before (Seasons 1-15)
- ✅ Single currency (purseAmount)
- ✅ 1 season contracts
- ✅ No salary system
- ✅ Simple player assignment

### After (Season 16+)
- ✅ Dual currency ($ and €)
- ✅ 2 season contracts (fixed)
- ✅ Salary deductions per match/half-season
- ✅ Star ratings & points auto-update
- ✅ Legend/Classic categories
- ✅ Match lineup validation

---

## Key Numbers

| Item | Value |
|------|-------|
| Real Player Budget | $1,000 |
| Football Player Budget | €10,000 |
| Min Real Players | 5 |
| Max Real Players | 7 |
| Max Football Players | 25 |
| Contract Duration | 2 seasons |
| Category Fine | $20 |
| Match: Min Legend | 2 |
| Match: Min Classic | 3 |

---

## Salary Formulas

### Real Players
```
Salary/Match = (Auction Value ÷ 100) × Star Rating ÷ 10

Examples:
$300 @ 10★ = ($300 ÷ 100) × 10 ÷ 10 = $3/match
$100 @ 5★  = ($100 ÷ 100) × 5 ÷ 10  = $0.5/match
```

### Football Players
```
Salary/Half-Season = Auction Value × 10%

Examples:
€1000 = €100/half-season
€1200 = €120/half-season
```

---

## Star Rating ↔ Points

| Stars | Points |
|-------|--------|
| 3★ | 100p |
| 4★ | 120p |
| 5★ | 145p |
| 6★ | 175p |
| 7★ | 210p |
| 8★ | 250p |
| 9★ | 300p |
| 10★ | 350-400p |

**After Match:** Points ± GD (max ±5)

---

## Categories

- **Legend:** Top 50% (by points, league-wide)
- **Classic:** Bottom 50%

Auto-updates after each match.

---

## Contract Lifecycle

### Assignment
```
Season 16 → Start: "16", End: "17", Status: 'active'
Season 17 → Start: "17", End: "18", Status: 'active'
```

### Expiry
```
Season 18 starts → Contract "16"-"17" expires
  → Status: 'expired'
  → Player removed from team
  → Available for re-auction
```

---

## Important Functions

```typescript
// From lib/contracts.ts

// Salary calculations
calculateRealPlayerSalary(auctionValue, starRating)
calculateFootballPlayerSalary(auctionValue)

// Contract management
calculateContractEndSeason(startSeason)
isContractActive(start, end, current)
isContractExpired(end, current)

// Points & ratings
calculateStarRating(points)
updatePlayerPoints(currentPoints, goalDifference)

// Categories
calculatePlayerCategory(playerPoints, allPoints)
updateAllPlayerCategories(players)

// Validation
validateMatchLineup(playerIds, categories)
canAffordRealPlayer(balance, value, min, max, count)
canAffordFootballPlayer(balance, value, max, count)

// Contract creation
createRealPlayerContract(data)
createFootballPlayerContract(data)
```

---

## When Things Happen

| Event | Action |
|-------|--------|
| **Season Created** | Set type: 'multi' |
| **Team Registered** | Initialize dual balances |
| **Real Player Assigned** | Deduct $, create contract, set initial points |
| **Football Player Sold** | Deduct €, create contract, calculate salary |
| **Match Finalized** | Deduct real player salaries, update points/stars |
| **Mid-Season** | Deduct football player salaries |
| **Season Ends** | Check for expired contracts |
| **New Season Starts** | Remove expired players, re-auction |

---

## Data Structure Checklist

### Season
```typescript
{
  type: 'multi',
  dollar_budget: 1000,
  euro_budget: 10000,
  min_real_players: 5,
  max_real_players: 7,
  max_football_players: 25,
  category_fine_amount: 20
}
```

### Team
```typescript
{
  dollar_balance: 1000,
  euro_balance: 10000,
  dollar_spent: 0,
  euro_spent: 0,
  dollar_salaries_committed: 0,
  euro_salaries_committed: 0
}
```

### Real Player
```typescript
{
  star_rating: 8,
  points: 250,
  category: 'legend',
  auction_value: 250,
  salary_per_match: 2,
  contract_start_season: "16",
  contract_end_season: "17",
  contract_status: 'active'
}
```

### Football Player
```typescript
{
  auction_value: 1000,
  salary_per_half_season: 100,
  contract_start_season: "16",
  contract_end_season: "17",
  contract_status: 'active'
}
```

---

## Common Workflows

### 1. Assign Real Player
```
1. Admin enters: player_id, team_id, star_rating, auction_value
2. Calculate: salary_per_match
3. Calculate: contract_end_season
4. Get: initial_points (from star_rating)
5. Update: player document
6. Deduct: auction_value from team.dollar_balance
7. Add: salary_per_match to team.dollar_salaries_committed
```

### 2. Football Player Auction
```
1. Auction happens (existing system)
2. Player sold for X euros
3. Calculate: salary_per_half_season (X × 10%)
4. Calculate: contract_end_season
5. Update: player document
6. Deduct: X from team.euro_balance
7. Add: salary_per_half_season to team.euro_salaries_committed
```

### 3. Match Finalization
```
For each real player in match:
1. Calculate: team GD
2. Update: player.points (±GD, max ±5)
3. Recalculate: star_rating from new points
4. Deduct: salary_per_match from team.dollar_balance

After all players updated:
5. Recalculate: all player categories (league-wide)
6. Update: category field for each player
```

### 4. Check Contract Expiry
```
At season end:
For each player:
  if isContractExpired(player.contract_end_season, current_season):
    - Set contract_status = 'expired'
    - Remove player from team
    - Add to free agent pool
```

---

## File Changes Summary

### New Files
- ✅ `lib/contracts.ts` - All contract utilities
- ✅ `MULTI_SEASON_CONTRACT_SYSTEM.md` - Full documentation
- ✅ `MULTI_SEASON_QUICK_REFERENCE.md` - This file

### Modified Files
- ✅ `types/season.ts` - Added type, budgets, player limits
- ✅ `types/realPlayer.ts` - Added contract, salary, points, category
- ✅ `types/footballPlayer.ts` - Added contract, salary
- ✅ `types/team.ts` - Added dual balances

### Files to Modify (Next Steps)
- ⏳ Season creation UI
- ⏳ Team registration
- ⏳ Real player assignment form
- ⏳ Match finalization logic
- ⏳ Mid-season trigger
- ⏳ Contract expiry handler

---

## Testing Commands

```typescript
// Test salary calculations
import { 
  calculateRealPlayerSalary,
  calculateFootballPlayerSalary 
} from '@/lib/contracts';

console.log(calculateRealPlayerSalary(300, 10)); // → 3
console.log(calculateFootballPlayerSalary(1000)); // → 100

// Test contract end season
import { calculateContractEndSeason } from '@/lib/contracts';
console.log(calculateContractEndSeason("16")); // → "17"

// Test points update
import { updatePlayerPoints } from '@/lib/contracts';
console.log(updatePlayerPoints(250, 3)); // → 253 (GD +3)
console.log(updatePlayerPoints(250, -2)); // → 248 (GD -2)
console.log(updatePlayerPoints(250, 7)); // → 255 (capped at +5)

// Test category calculation
import { calculatePlayerCategory } from '@/lib/contracts';
const allPoints = [300, 250, 200, 150, 100];
console.log(calculatePlayerCategory(280, allPoints)); // → 'legend' (top 50%)
console.log(calculatePlayerCategory(120, allPoints)); // → 'classic' (bottom 50%)
```

---

## Remember

- ✅ All contracts = 2 seasons (fixed)
- ✅ Real player salaries deducted PER MATCH
- ✅ Football player salaries deducted at MID-SEASON
- ✅ Categories recalculated LEAGUE-WIDE after each match
- ✅ Star ratings auto-update based on points
- ✅ Match lineup requires min 2 Legend + 3 Classic
- ✅ Historical seasons (1-15) get type: 'single'
- ✅ Season 16+ use type: 'multi'
