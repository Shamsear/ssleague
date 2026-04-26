# Bulk Swap Feature Documentation

## Overview
The Bulk Swap feature allows committee admins to swap multiple football players across multiple teams in a single operation. Each swap pair is independent with its own fee calculation.

## Features

### 1. Multiple Swap Pairs
- Add unlimited swap pairs in a single operation
- Each pair swaps two players between different teams
- Remove individual swap pairs as needed

### 2. Smart Validation
- Prevents swapping players from the same team
- Ensures each player is only in one swap
- Validates all players are assigned to teams (not free agents)
- Checks team budgets before executing

### 3. Fee Calculation
- Each team's fees are calculated based on their cumulative swap count
- Fee structure:
  - Swaps 1-3: FREE
  - Swap 4: 100
  - Swap 5: 125
  - Swap 6+: 150
- Fees accumulate across multiple swaps in the same operation

### 4. Acquisition Value Swapping
- Player A gets Player B's acquisition value
- Player B gets Player A's acquisition value
- Maintains roster value balance for both teams

### 5. Real-Time Preview
- See total fees before confirming
- View fees per team
- Preview all swap pairs

## API Endpoint

### POST `/api/players/bulk-swap`

**Request Body:**
```json
{
  "swaps": [
    {
      "player_a_id": "38439",
      "player_b_id": "129369"
    },
    {
      "player_a_id": "45678",
      "player_b_id": "98765"
    }
  ],
  "season_id": "SSPSLS17",
  "swapped_by": "user_uid",
  "swapped_by_name": "Admin Name"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully swapped 2 player pair(s)",
  "data": {
    "swaps_completed": 2,
    "teams_affected": 4,
    "total_fees": 200,
    "details": [
      {
        "player_a": "Player Name A",
        "player_b": "Player Name B",
        "team_a_fee": 100,
        "team_b_fee": 100
      }
    ]
  }
}
```

## UI Component

### Location
`app/dashboard/committee/players/transfers/BulkSwapForm.tsx`

### Features
- Dynamic swap pair management (add/remove)
- Player selection with team filtering
- Duplicate player prevention
- Real-time fee calculation
- Team budget validation
- Confirmation dialog with summary

### Usage
1. Navigate to Committee → Players → Transfers
2. Select "Football Players"
3. Click "Bulk Swap" tab
4. Add swap pairs using the "Add Another Swap" button
5. Select players for each swap pair
6. Review fees preview
7. Click "Swap X Player Pair(s)" to execute

## Database Operations

### Transaction Flow
1. **BEGIN** transaction
2. Update all players in `footballplayers` table:
   - Swap `team_id`
   - Swap `acquisition_value`
3. Update all players in `team_players` table:
   - Update `team_id`
4. **COMMIT** transaction
5. Update Firestore `team_seasons`:
   - Deduct fees from `football_budget`
   - Increment `football_swap_count`
   - Update `position_counts`
6. Log transactions in `transactions` collection

### Rollback
If any step fails, the entire transaction is rolled back to maintain data consistency.

## Example Scenarios

### Scenario 1: Simple 2-Player Swap
- Team A's Player 1 (value 500) ↔ Team B's Player 2 (value 1000)
- Result:
  - Player 1 → Team B with value 1000
  - Player 2 → Team A with value 500
  - Fees: Based on each team's swap count

### Scenario 2: Multi-Team Bulk Swap
- Team A's Player 1 ↔ Team B's Player 2
- Team C's Player 3 ↔ Team D's Player 4
- Team A's Player 5 ↔ Team E's Player 6
- Result:
  - All 6 players swapped
  - Team A: 2 swaps counted
  - Teams B, C, D, E: 1 swap each
  - Fees calculated per team's cumulative count

### Scenario 3: Same Team Multiple Swaps
- Team A's Player 1 ↔ Team B's Player 2 (Team A's 1st swap = FREE)
- Team A's Player 3 ↔ Team C's Player 4 (Team A's 2nd swap = FREE)
- Team A's Player 5 ↔ Team D's Player 6 (Team A's 3rd swap = FREE)
- Team A's Player 7 ↔ Team E's Player 8 (Team A's 4th swap = 100)
- Result:
  - Team A pays 100 total
  - Other teams pay based on their counts

## Error Handling

### Validation Errors
- Missing required fields
- Invalid swap pairs
- Duplicate players
- Same team swaps
- Players not found
- Players not assigned to teams
- Insufficient team budget

### System Errors
- Database connection issues
- Transaction failures (auto-rollback)
- Firestore update failures

## Testing

### Test Cases
1. ✅ Single swap pair
2. ✅ Multiple swap pairs (2-5)
3. ✅ Same team multiple swaps
4. ✅ Cross-team swaps
5. ✅ Fee calculation accuracy
6. ✅ Budget validation
7. ✅ Duplicate player prevention
8. ✅ Free agent validation
9. ✅ Transaction rollback on error
10. ✅ Position count updates

## Performance

### Optimizations
- Single database query for all players
- Batch Firestore updates
- Transaction-based consistency
- Efficient player lookup with Map

### Scalability
- Handles up to 50 swap pairs efficiently
- O(n) complexity for n swap pairs
- Minimal database round trips

## Future Enhancements

### Potential Features
1. CSV import for bulk swaps
2. Swap templates/presets
3. Undo last bulk swap
4. Swap history per team
5. Email notifications to team owners
6. Swap approval workflow
7. Scheduled swaps

## Related Files

### API
- `app/api/players/bulk-swap/route.ts` - Bulk swap endpoint
- `app/api/players/simple-swap/route.ts` - Single swap endpoint

### UI
- `app/dashboard/committee/players/transfers/BulkSwapForm.tsx` - Bulk swap form
- `app/dashboard/committee/players/transfers/FootballPlayerForm.tsx` - Single swap form
- `app/dashboard/committee/players/transfers/page.tsx` - Main transfers page

### Database
- `lib/neon/auction-config.ts` - Neon database config
- `lib/firebase/admin.ts` - Firebase admin config

## Support

For issues or questions:
1. Check error messages in browser console
2. Review server logs for API errors
3. Verify player data in database
4. Check team budget availability
5. Ensure season_id is correct
