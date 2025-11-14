# Tournament Rewards Distribution System

## Overview
Committee admins can distribute end-of-tournament rewards to teams based on their final standings, knockout results, and participation in the tournament.

## Access
**Path**: `/dashboard/committee/tournament-rewards`  
**Role**: Committee Admin only

## Features

### 1. Tournament Selection
- Lists all tournaments with rewards configured
- Shows tournament status (active/completed/upcoming)
- Displays reward summary (match rewards, position rewards, knockout rewards, completion bonus)
- Filter: Only shows tournaments that have rewards configured

### 2. Rewards Configuration Display
Shows a summary of configured rewards:
- **League Positions**: Number of position rewards configured
- **Knockout Stages**: Number of knockout stage rewards
- **Completion Bonus**: eCoin/SSCoin amounts for all teams
- **Match Rewards**: Indicator that these are auto-distributed

### 3. Team Standings View
Displays current standings with:
- Position (Pos)
- Team Name
- Matches Played (P)
- Wins (W), Draws (D), Losses (L)
- Goal Difference (GD)
- Points (Pts)

### 4. Distribute Rewards Button
One-click distribution of all configured rewards:
- League position rewards
- Tournament completion bonus
- Knockout rewards (requires manual mapping)

### 5. Distribution Log
Real-time log showing:
- Each reward distributed
- Team name and amounts
- Success/error messages
- Summary of total rewards distributed

## Reward Types Distributed

### ✅ Automatically Distributed

#### 1. Match Rewards (Already Done)
- Distributed automatically after each match
- Based on Win/Draw/Loss result
- Transaction type: `match_reward`
- Icon: 🏆

#### 2. League Position Rewards
- Based on final standings position
- Each position has configured eCoin & SSCoin amounts
- Example: 1st place gets 5000 eCoin, 500 SSCoin
- Transaction type: `position_reward`
- Icon: 🥇
- Description: "Position X Reward - [Tournament Name]"

#### 3. Tournament Completion Bonus
- Given to ALL teams that completed the tournament
- Same amount for everyone
- Transaction type: `completion_bonus`
- Icon: 🎉
- Description: "Tournament Completion Bonus - [Tournament Name]"

### ⚠️ Manual Distribution Required

#### 4. Knockout Stage Rewards
- Requires mapping teams to knockout positions (Winner, Runner-up, Semi-final Loser, etc.)
- Committee must manually record which teams finished in which knockout positions
- Then can distribute these rewards

#### 5. Group Elimination Rewards
- For Group+Knockout format only
- Teams eliminated in group stage
- Based on overall group performance rankings

## How to Use

### Step 1: Complete Tournament
Ensure the tournament is completed and all match results are entered.

### Step 2: Select Tournament
1. Navigate to `/dashboard/committee/tournament-rewards`
2. Click on a tournament from the list
3. View the standings and rewards configuration

### Step 3: Verify Standings
Check that the standings are correct before distributing rewards.

### Step 4: Distribute Rewards
1. Click "Distribute All Rewards" button
2. Wait for distribution to complete
3. Review the distribution log

### Step 5: Verify Transactions
Teams can check their transaction history to see:
- 🥇 Position Reward - Position X Reward - [Tournament Name]
- 🎉 Completion Bonus - Tournament Completion Bonus - [Tournament Name]

## Transaction Records

All rewards create transaction records with:

| Type | Icon | Description Format | Type Code |
|------|------|-------------------|-----------|
| Match Reward | 🏆 | Match Reward (Win) - Round X | `match_reward` |
| Position Reward | 🥇 | Position X Reward - [Tournament] | `position_reward` |
| Completion Bonus | 🎉 | Tournament Completion Bonus - [Tournament] | `completion_bonus` |

## Example Scenario

**Tournament**: SS Super League S16 League  
**Teams**: 16 teams  
**Format**: Pure League (no knockout)

**Rewards Configuration**:
- Position 1: 5000 eCoin, 500 SSCoin
- Position 2: 3000 eCoin, 300 SSCoin
- Position 3: 2000 eCoin, 200 SSCoin
- Positions 4-16: Decreasing amounts
- Completion Bonus: 500 eCoin, 50 SSCoin (all teams)

**Distribution Result**:
1. Team A (1st): +5000 eCoin, +500 SSCoin (position) + 500 eCoin, 50 SSCoin (bonus)
2. Team B (2nd): +3000 eCoin, +300 SSCoin (position) + 500 eCoin, 50 SSCoin (bonus)
3. All 16 teams: +500 eCoin, +50 SSCoin (completion bonus)

## API Endpoint

**Endpoint**: `POST /api/tournaments/distribute-rewards`

**Request Body**:
```json
{
  "tournament_id": "SSPSLS16L",
  "season_id": "SSPSLS16"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Rewards distributed successfully",
  "log": [
    "Starting rewards distribution for tournament SSPSLS16L",
    "Loaded tournament: SS Super League S16 League",
    "Found 16 teams in standings",
    "",
    "--- League Position Rewards ---",
    "✓ Position 1 (Team A): +5000 eCoin, +500 SSCoin",
    "✓ Position 2 (Team B): +3000 eCoin, +300 SSCoin",
    "...",
    "",
    "--- Tournament Completion Bonus ---",
    "✓ Team A: +500 eCoin, +50 SSCoin",
    "✓ Team B: +500 eCoin, +50 SSCoin",
    "...",
    "",
    "🎉 Rewards distribution completed successfully!"
  ]
}
```

## Error Handling

- **No rewards configured**: Cannot distribute for tournament
- **No standings**: Tournament must have team statistics
- **Already distributed**: Check transaction history to avoid double distribution
- **Database errors**: Logged and returned in error response

## Future Enhancements

- [ ] Track distribution history (prevent double distribution)
- [ ] Knockout results mapping UI
- [ ] Group elimination automatic detection
- [ ] Bulk rewards preview before distribution
- [ ] Undo/rollback functionality
- [ ] Export rewards report (CSV/PDF)

## Notes

- Rewards can only be distributed once standings are final
- Match rewards are already distributed automatically during the season
- Position rewards use the final standings table
- Completion bonus goes to ALL teams in the tournament
- Transaction records are permanent and visible to teams
