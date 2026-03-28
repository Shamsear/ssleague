# Process Draft Tiers API

## Endpoint
`POST /api/fantasy/draft/process-tiers`

## Description
Committee-only endpoint to process all tier bids and assign players to teams. This endpoint:
1. Processes each tier sequentially (tier 1, then tier 2, etc.)
2. Sorts bids by amount (highest first) with timestamp tiebreaker
3. Assigns players to the highest bidders
4. Deducts winning bid amounts from team budgets
5. Marks players as unavailable after assignment
6. Updates all bid statuses (won/lost/skipped)
7. Sends notifications to all teams about their draft results

## Authorization
- **Required Role**: `committee_admin`
- Only committee members can trigger draft processing

## Request

### Headers
```
Content-Type: application/json
Authorization: Bearer <firebase-token>
```

### Body Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `league_id` | string | Yes | The ID of the fantasy league |
| `send_notifications` | boolean | No | Whether to send notifications to teams (default: true) |

### Example Request
```json
{
  "league_id": "league_2024_main",
  "send_notifications": true
}
```

## Response

### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Successfully processed draft for 140 players",
  "league_id": "league_2024_main",
  "results_by_tier": [
    {
      "tier_number": 1,
      "tier_name": "Elite",
      "total_bids": 20,
      "valid_bids": 20,
      "winners": 20,
      "skipped": 0,
      "failed": 0,
      "winning_bids": [
        {
          "team_id": "team_123",
          "team_name": "FC Barcelona",
          "player_id": "player_456",
          "player_name": "Lionel Messi",
          "bid_amount": 25.5
        }
      ]
    }
  ],
  "total_players_drafted": 140,
  "total_budget_spent": 1850.5,
  "average_squad_size": 7.0,
  "processing_time_ms": 450,
  "notifications_sent": 20
}
```

### Error Responses

#### 401 Unauthorized
```json
{
  "success": false,
  "error": "Unauthorized - Committee access required"
}
```

#### 400 Bad Request
```json
{
  "success": false,
  "error": "league_id is required"
}
```

#### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Draft processing failed",
  "details": "No tiers found for this league",
  "partial_results": []
}
```

## Processing Logic

### Tier-by-Tier Processing
1. **Tier 1 (Elite)**: Process all bids, assign top 20 players
2. **Tier 2 (Stars)**: Process remaining teams' bids, assign next 20 players
3. **Continue** through all tiers sequentially

### Bid Sorting
Bids are sorted by:
1. **Primary**: Bid amount (highest first)
2. **Secondary**: Submission timestamp (earliest first) - tiebreaker

### Budget Validation
- Teams must have sufficient budget remaining
- Budget is checked before each player assignment
- If a team runs out of budget mid-tier, their remaining bids are marked as "lost"

### Player Assignment
- Each player can only be assigned once
- Once assigned, the player is marked as unavailable
- Player is added to the winning team's squad
- Team's budget is deducted by the bid amount

### Bid Statuses
- **won**: Team won the player
- **lost**: Team was outbid or couldn't afford
- **skipped**: Team chose to skip this tier
- **pending**: Not yet processed (shouldn't exist after processing)

## Notifications

### Notification Types

#### No Players Won
```
Title: 🎉 Draft Complete!
Body: The draft has been processed. You didn't win any players this round. Budget remaining: €100M
```

#### One Player Won
```
Title: 🎉 Draft Complete!
Body: You won Lionel Messi for €25M! Budget remaining: €75M
```

#### Multiple Players Won
```
Title: 🎉 Draft Complete!
Body: You won 7 players for €175M! Budget remaining: €25M. Check your squad now!
```

### Notification Data
Each notification includes:
- `type`: "draft_complete"
- `league_id`: The league ID
- `team_id`: The team ID
- `players_won`: Number of players won
- `total_spent`: Total amount spent
- `url`: Link to team's squad page

## Usage Example

### Using fetch
```typescript
const response = await fetch('/api/fantasy/draft/process-tiers', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${firebaseToken}`
  },
  body: JSON.stringify({
    league_id: 'league_2024_main',
    send_notifications: true
  })
});

const result = await response.json();

if (result.success) {
  console.log(`Draft complete! ${result.total_players_drafted} players drafted`);
  console.log(`Average squad size: ${result.average_squad_size}`);
  console.log(`Notifications sent to ${result.notifications_sent} teams`);
} else {
  console.error('Draft processing failed:', result.error);
}
```

### Using axios
```typescript
import axios from 'axios';

try {
  const { data } = await axios.post('/api/fantasy/draft/process-tiers', {
    league_id: 'league_2024_main',
    send_notifications: true
  }, {
    headers: {
      'Authorization': `Bearer ${firebaseToken}`
    }
  });

  console.log('Draft results:', data);
} catch (error) {
  console.error('Error processing draft:', error.response?.data);
}
```

## Performance

### Expected Processing Times
- **Small league** (10 teams, 3 tiers): ~100-200ms
- **Medium league** (20 teams, 7 tiers): ~300-500ms
- **Large league** (30 teams, 10 tiers): ~500-800ms

### Database Operations
- Sequential tier processing (not parallelized)
- Batch updates for bid statuses
- Individual player assignments
- Team budget updates

## Error Handling

### Graceful Degradation
- If notifications fail, the draft processing still succeeds
- Partial results are returned even if processing fails mid-way
- All database operations are logged for debugging

### Common Issues
1. **No tiers found**: Ensure tiers have been generated first
2. **No bids submitted**: Teams must submit bids before processing
3. **Notification failures**: Check FCM token validity and Firebase configuration

## Related Endpoints
- `POST /api/fantasy/draft/generate-tiers` - Generate draft tiers
- `POST /api/fantasy/draft/submit-tier-bids` - Submit team bids
- `GET /api/fantasy/draft/results` - View draft results

## Testing
Comprehensive test suite available at:
`tests/api/fantasy/draft/process-tiers.test.ts`

Run tests:
```bash
npm test -- tests/api/fantasy/draft/process-tiers.test.ts
```

## Implementation Details
- **File**: `app/api/fantasy/draft/process-tiers/route.ts`
- **Processor**: `lib/fantasy/draft-processor.ts`
- **Notifications**: `lib/notifications/send-notification.ts`
- **Database**: Fantasy League Neon Database
