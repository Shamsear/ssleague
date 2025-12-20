# Salary Calculation Formula Report

## 📊 Current Salary Formula

### For Real Players (SS Members)

```
Salary Per Match = (Auction Value ÷ 100) × Star Rating ÷ 10
```

**Example:**
- Auction Value: 300 SSCoin
- Star Rating: 10⭐
- Calculation: (300 ÷ 100) × 10 ÷ 10 = 3.00 SSCoin per match

### Formula Breakdown

```javascript
const calculateSalary = (auctionValue: number, starRating: number): number => {
  return (auctionValue / 100) * starRating / 10;
};
```

**Simplified:**
```
Salary = (Value × Stars) / 1000
```

## 🔄 Impact of Star Rating Changes

### Star Rating Upgrade/Downgrade Effect

When a player's star rating changes, their salary changes proportionally:

| Star Rating | Multiplier | Example (300 SSCoin Value) |
|-------------|------------|----------------------------|
| 3⭐         | 0.03       | 0.90 SSCoin/match         |
| 4⭐         | 0.04       | 1.20 SSCoin/match         |
| 5⭐         | 0.05       | 1.50 SSCoin/match         |
| 6⭐         | 0.06       | 1.80 SSCoin/match         |
| 7⭐         | 0.07       | 2.10 SSCoin/match         |
| 8⭐         | 0.08       | 2.40 SSCoin/match         |
| 9⭐         | 0.09       | 2.70 SSCoin/match         |
| 10⭐        | 0.10       | 3.00 SSCoin/match         |

### Salary Change Per Star Upgrade

For a player with auction value V:
- **Per Star Increase:** Salary increases by `V / 1000`
- **Per Star Decrease:** Salary decreases by `V / 1000`

**Example with 200 SSCoin value:**
- 5⭐ → 6⭐: Salary increases from 1.00 to 1.20 (+0.20 per match)
- 6⭐ → 5⭐: Salary decreases from 1.20 to 1.00 (-0.20 per match)

## 📈 Season 16 (SSPSLS16) Salary Impact Analysis

### Players Requiring Star Rating Updates

Based on current points, 9 players need star rating adjustments:

#### 1. **RAHUL KL** (Psychoz)
- Current: 3⭐ → Should be: 4⭐
- Points: 120
- Auction Value: (needs to be checked)
- **Salary Impact:** +0.001 × Auction Value per match

#### 2. **Safar** (Skill 555)
- Current: 4⭐ → Should be: 5⭐
- Points: 145
- Auction Value: (needs to be checked)
- **Salary Impact:** +0.001 × Auction Value per match

#### 3. **Anu Anshin** (Skill 555) ⚠️ OVER-RATED
- Current: 7⭐ → Should be: 6⭐
- Points: 202
- Auction Value: (needs to be checked)
- **Salary Impact:** -0.001 × Auction Value per match

#### 4. **Hyder** (Manchester United)
- Current: 5⭐ → Should be: 6⭐
- Points: 174
- Auction Value: (needs to be checked)
- **Salary Impact:** +0.001 × Auction Value per match

#### 5. **Shamsear** (Los Galacticos)
- Current: 5⭐ → Should be: 6⭐
- Points: 170
- Auction Value: (needs to be checked)
- **Salary Impact:** +0.001 × Auction Value per match

#### 6. **Umar** (Qatar Gladiators)
- Current: 6⭐ → Should be: 7⭐
- Points: 215
- Auction Value: (needs to be checked)
- **Salary Impact:** +0.001 × Auction Value per match

#### 7. **Abid Rizwan** (Los Galacticos)
- Current: 6⭐ → Should be: 7⭐
- Points: 206
- Auction Value: (needs to be checked)
- **Salary Impact:** +0.001 × Auction Value per match

#### 8. **SIRAJ** (Manchester United)
- Current: 6⭐ → Should be: 7⭐
- Points: 205
- Auction Value: (needs to be checked)
- **Salary Impact:** +0.001 × Auction Value per match

#### 9. **Amjad** (FC Barcelona)
- Current: 6⭐ → Should be: 7⭐
- Points: 205
- Auction Value: (needs to be checked)
- **Salary Impact:** +0.001 × Auction Value per match

## 🔧 Implementation Locations

### Where Salary is Calculated

1. **Budget Planner:** `app/dashboard/team/budget-planner/page.tsx`
   ```typescript
   const calculateRealPlayerSalary = (value: number, stars: number): number => {
     return ((value / 100) * stars) / 10;
   };
   ```

2. **Real Players Planner:** `app/dashboard/team/real-players-planner/page.tsx`
   ```typescript
   const calculateSalary = (bidAmount: number, finalStars: number): number => {
     return (bidAmount / 100) * finalStars / 10;
   };
   ```

3. **API Routes:**
   - `app/api/realplayers/update-points/route.ts` - Updates salary when points change
   - `app/api/committee/update-player-stars-points/route.ts` - Updates salary with star changes
   - `app/api/player-ratings/assign/route.ts` - Sets initial salary on assignment

### Where Salary is Stored

- **Database Table:** `player_seasons`
- **Column:** `salary_per_match` (DECIMAL type)
- **Also in:** `footballplayers` table (for legacy support)

## 📝 Recommendations

### 1. Automatic Salary Recalculation

When updating star ratings, the system should automatically:
```sql
UPDATE player_seasons 
SET 
  star_rating = [new_star_rating],
  salary_per_match = (auction_value / 100) * [new_star_rating] / 10,
  updated_at = NOW()
WHERE player_id = [player_id] AND season_id = 'SSPSLS16';
```

### 2. Team Budget Impact

Before applying star rating changes, calculate total budget impact:
```javascript
const calculateBudgetImpact = (players, matches_remaining) => {
  let totalImpact = 0;
  players.forEach(player => {
    const oldSalary = (player.auction_value / 100) * player.old_star / 10;
    const newSalary = (player.auction_value / 100) * player.new_star / 10;
    const salaryDiff = newSalary - oldSalary;
    totalImpact += salaryDiff * matches_remaining;
  });
  return totalImpact;
};
```

### 3. SQL Script to Fix All Star Ratings AND Salaries

```sql
-- Update RAHUL KL
UPDATE player_seasons 
SET star_rating = 4, 
    salary_per_match = (auction_value / 100) * 4 / 10 
WHERE player_id = 'sspsplpsl0021' AND season_id = 'SSPSLS16';

-- Update Safar
UPDATE player_seasons 
SET star_rating = 5, 
    salary_per_match = (auction_value / 100) * 5 / 10 
WHERE player_id = 'sspsplpsl0039' AND season_id = 'SSPSLS16';

-- Update Anu Anshin (downgrade)
UPDATE player_seasons 
SET star_rating = 6, 
    salary_per_match = (auction_value / 100) * 6 / 10 
WHERE player_id = 'sspsplpsl0042' AND season_id = 'SSPSLS16';

-- Update Hyder
UPDATE player_seasons 
SET star_rating = 6, 
    salary_per_match = (auction_value / 100) * 6 / 10 
WHERE player_id = 'sspsplpsl0032' AND season_id = 'SSPSLS16';

-- Update Shamsear
UPDATE player_seasons 
SET star_rating = 6, 
    salary_per_match = (auction_value / 100) * 6 / 10 
WHERE player_id = 'sspsplpsl0024' AND season_id = 'SSPSLS16';

-- Update Umar
UPDATE player_seasons 
SET star_rating = 7, 
    salary_per_match = (auction_value / 100) * 7 / 10 
WHERE player_id = 'sspsplpsl0078' AND season_id = 'SSPSLS16';

-- Update Abid Rizwan
UPDATE player_seasons 
SET star_rating = 7, 
    salary_per_match = (auction_value / 100) * 7 / 10 
WHERE player_id = 'sspsplpsl0050' AND season_id = 'SSPSLS16';

-- Update SIRAJ
UPDATE player_seasons 
SET star_rating = 7, 
    salary_per_match = (auction_value / 100) * 7 / 10 
WHERE player_id = 'sspsplpsl0018' AND season_id = 'SSPSLS16';

-- Update Amjad
UPDATE player_seasons 
SET star_rating = 7, 
    salary_per_match = (auction_value / 100) * 7 / 10 
WHERE player_id = 'sspsplpsl0081' AND season_id = 'SSPSLS16';
```

## 🎯 Summary

- **Formula:** `Salary = (Value × Stars) / 1000`
- **Per Star Change:** Salary changes by `Value / 1000` per match
- **9 Players** in SSPSLS16 need star rating updates
- **8 Upgrades** (salary increase) and **1 Downgrade** (salary decrease)
- **Automatic recalculation** should be implemented when star ratings change
- **Team budgets** will be affected by these salary changes

## ⚠️ Important Notes

1. Salary changes affect team budgets for remaining matches
2. Historical salary payments should NOT be adjusted
3. Only future match salaries should use the new rates
4. Teams should be notified of salary changes
5. Transaction logs should record the salary adjustment reason
