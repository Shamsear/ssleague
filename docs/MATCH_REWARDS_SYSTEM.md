# Match Rewards Distribution System

## Overview
Automatic distribution of eCoin and SSCoin rewards to teams after each match based on the result (Win/Draw/Loss) and tournament configuration.

## How It Works

### 1. Tournament Configuration
When creating a tournament, the committee configures match rewards:

```json
{
  "match_results": {
    "win_ecoin": 100,
    "win_sscoin": 10,
    "draw_ecoin": 50,
    "draw_sscoin": 5,
    "loss_ecoin": 20,
    "loss_sscoin": 2
  }
}
```

### 2. Result Submission
When match results are submitted:

**Endpoint**: `PATCH /api/fixtures/[fixtureId]/matchups`

**Flow**:
1. Match results are saved to `matchups` table
2. Fixture is updated with total scores and result
3. `distributeMatchRewards()` function is called
4. Rewards are distributed based on match result

### 3. Reward Distribution Logic

#### Win Scenario
- **Winner**: Receives `win_ecoin` + `win_sscoin`
- **Loser**: Receives `loss_ecoin` + `loss_sscoin`

#### Draw Scenario
- **Both Teams**: Receive `draw_ecoin` + `draw_sscoin`

### 4. Database Updates

#### Team Budgets
```sql
UPDATE teams
SET 
  football_budget = football_budget + [ecoin_reward],
  real_budget = real_budget + [sscoin_reward],
  updated_at = NOW()
WHERE id = [team_id]
```

#### Transaction Records
```sql
INSERT INTO transactions (
  team_id,
  season_id,
  transaction_type,
  amount_football,
  amount_real,
  description,
  created_at
) VALUES (
  [team_id],
  [season_id],
  'match_reward',
  [ecoin_amount],
  [sscoin_amount],
  'Match Reward (Win/Draw/Loss) - Round X',
  NOW()
)
```

## Example Scenarios

### Scenario 1: Home Team Wins 5-3
- **Home Team**: +100 eCoin, +10 SSCoin (Win Reward)
- **Away Team**: +20 eCoin, +2 SSCoin (Loss Reward)

### Scenario 2: Match Ends 2-2 (Draw)
- **Home Team**: +50 eCoin, +5 SSCoin (Draw Reward)
- **Away Team**: +50 eCoin, +5 SSCoin (Draw Reward)

### Scenario 3: Away Team Wins 4-1
- **Home Team**: +20 eCoin, +2 SSCoin (Loss Reward)
- **Away Team**: +100 eCoin, +10 SSCoin (Win Reward)

## Transaction History
All rewards are recorded in the `transactions` table with:
- **Type**: `match_reward`
- **Description**: "Match Reward (Win) - Round 5 Leg 2"
- **Amounts**: Separate columns for eCoin and SSCoin

Teams can view their transaction history in:
- Dashboard → Transactions page
- Shows all match rewards received throughout the season

## Error Handling
- If tournament has no rewards configured, distribution is skipped (logged, not failed)
- If reward distribution fails, result submission still succeeds
- All distribution attempts are logged for debugging

## Integration Points

### Current
✅ Result submission (`PATCH /api/fixtures/[fixtureId]/matchups`)
✅ Creates transaction records
✅ Updates team budgets

### Future (To Be Implemented)
- [ ] League position rewards (end of season)
- [ ] Knockout stage rewards (tournament completion)
- [ ] Group elimination rewards
- [ ] Tournament completion bonus

## Testing
To test match rewards:
1. Create a tournament with match rewards configured
2. Create fixtures for that tournament
3. Submit match results
4. Check team budgets and transaction history
5. Verify rewards were distributed correctly

## Notes
- Rewards are only distributed once per match
- Editing results does NOT re-distribute rewards (to prevent double-counting)
- Zero rewards (0 eCoin, 0 SSCoin) are not distributed or recorded
- All monetary values use `COALESCE` to handle NULL budgets safely
