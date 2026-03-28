# Draft Processor

## Overview

The Draft Processor is a tier-by-tier draft processing engine for the fantasy league system. It processes all team bids sequentially through each tier, assigning players to the highest bidders while managing budgets and player availability.

## Key Features

- **Tier-by-Tier Processing**: Processes each tier sequentially (tier 1, then tier 2, etc.)
- **Highest Bidder Wins**: Sorts bids by amount (highest first) and assigns players accordingly
- **Timestamp Tiebreaker**: When bids are equal, earliest submission wins
- **Budget Management**: Automatically deducts winning bid amounts from team budgets
- **Player Availability**: Marks players as unavailable after assignment
- **Bid Status Tracking**: Updates all bid statuses (won/lost/skipped)
- **Comprehensive Reporting**: Generates detailed draft results reports

## Architecture

### Processing Flow

```
1. Load all tiers (ordered by tier_number)
2. Initialize team budgets
3. For each tier:
   a. Load all bids for this tier
   b. Separate skipped bids
   c. Filter valid bids (can afford + player available)
   d. Sort by amount (highest first), then timestamp (earliest first)
   e. Assign players to highest bidders
   f. Deduct budget from winners
   g. Mark players as unavailable
   h. Update bid statuses (won/lost/skipped)
4. Save final results to database
5. Generate statistics
```

### Data Flow

```
fantasy_draft_tiers → fantasy_tier_bids → processDraftTiers()
                                                ↓
                                    Process each tier sequentially
                                                ↓
                            fantasy_squad + fantasy_players + fantasy_teams
                                                ↓
                                        Draft Results Report
```

## API

### Main Functions

#### `processDraftTiers(leagueId: string): Promise<DraftProcessingResult>`

Processes all tier bids for a league.

**Parameters:**
- `leagueId`: The league ID to process

**Returns:**
```typescript
{
  success: boolean;
  league_id: string;
  results_by_tier: TierProcessingResult[];
  total_players_drafted: number;
  total_budget_spent: number;
  average_squad_size: number;
  processing_time_ms: number;
  errors?: string[];
}
```

**Example:**
```typescript
import { processDraftTiers } from '@/lib/fantasy/draft-processor';

const result = await processDraftTiers('league_123');

if (result.success) {
  console.log(`Drafted ${result.total_players_drafted} players`);
  console.log(`Processing time: ${result.processing_time_ms}ms`);
  
  result.results_by_tier.forEach(tier => {
    console.log(`Tier ${tier.tier_number}: ${tier.winners} winners`);
  });
}
```

#### `generateDraftReport(leagueId: string): Promise<DraftReport>`

Generates a comprehensive draft results report.

**Parameters:**
- `leagueId`: The league ID to generate report for

**Returns:**
```typescript
{
  league_id: string;
  total_teams: number;
  total_players_drafted: number;
  total_budget_spent: number;
  average_squad_size: number;
  average_budget_spent: number;
  teams: Array<{
    team_id: string;
    team_name: string;
    squad_size: number;
    budget_spent: number;
    budget_remaining: number;
    players: Array<{
      player_name: string;
      position: string;
      purchase_price: number;
      tier: number;
    }>;
  }>;
}
```

**Example:**
```typescript
import { generateDraftReport } from '@/lib/fantasy/draft-processor';

const report = await generateDraftReport('league_123');

console.log(`Total players drafted: ${report.total_players_drafted}`);
console.log(`Average squad size: ${report.average_squad_size}`);

report.teams.forEach(team => {
  console.log(`${team.team_name}: ${team.squad_size} players, €${team.budget_spent}M spent`);
});
```

## Database Schema

### Tables Used

#### fantasy_draft_tiers
Stores tier definitions with player lists.

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
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### fantasy_tier_bids
Stores team bids for each tier.

```sql
CREATE TABLE fantasy_tier_bids (
  id SERIAL PRIMARY KEY,
  bid_id VARCHAR(100) UNIQUE NOT NULL,
  tier_id VARCHAR(100) NOT NULL,
  league_id VARCHAR(100) NOT NULL,
  team_id VARCHAR(100) NOT NULL,
  player_id VARCHAR(100) NOT NULL,
  bid_amount DECIMAL(10,2) NOT NULL,
  is_skip BOOLEAN DEFAULT FALSE,
  status VARCHAR(20) DEFAULT 'pending',
  submitted_at TIMESTAMP DEFAULT NOW(),
  processed_at TIMESTAMP
);
```

#### fantasy_squad
Stores player assignments to teams.

```sql
CREATE TABLE fantasy_squad (
  squad_id VARCHAR(100) PRIMARY KEY,
  team_id VARCHAR(100) NOT NULL,
  league_id VARCHAR(100) NOT NULL,
  real_player_id VARCHAR(100) NOT NULL,
  player_name VARCHAR(200) NOT NULL,
  position VARCHAR(50),
  real_team_name VARCHAR(200),
  purchase_price DECIMAL(10,2),
  current_value DECIMAL(10,2),
  acquisition_method VARCHAR(50),
  acquisition_tier INTEGER
);
```

#### fantasy_teams
Stores team information and budgets.

```sql
CREATE TABLE fantasy_teams (
  team_id VARCHAR(100) PRIMARY KEY,
  league_id VARCHAR(100) NOT NULL,
  team_name VARCHAR(200) NOT NULL,
  initial_budget DECIMAL(10,2) DEFAULT 100,
  budget_remaining DECIMAL(10,2) DEFAULT 100,
  budget_spent DECIMAL(10,2) DEFAULT 0,
  squad_size INTEGER DEFAULT 0,
  draft_completed BOOLEAN DEFAULT FALSE
);
```

#### fantasy_players
Stores player information and availability.

```sql
CREATE TABLE fantasy_players (
  real_player_id VARCHAR(100) PRIMARY KEY,
  league_id VARCHAR(100) NOT NULL,
  player_name VARCHAR(200) NOT NULL,
  position VARCHAR(50),
  real_team_name VARCHAR(200),
  total_points INTEGER DEFAULT 0,
  games_played INTEGER DEFAULT 0,
  is_available BOOLEAN DEFAULT TRUE,
  owned_by_team_id VARCHAR(100)
);
```

## Processing Rules

### Bid Sorting

Bids are sorted using a two-level priority:

1. **Primary**: Bid amount (highest first)
2. **Secondary**: Submission timestamp (earliest first) - tiebreaker

```typescript
// Example: Three teams bid on same player
Team A: €25M at 10:00:00 → Wins (highest bid)
Team B: €20M at 09:59:00 → Loses
Team C: €20M at 10:01:00 → Loses

// Example: Two teams bid same amount
Team A: €25M at 10:00:00 → Wins (earlier timestamp)
Team B: €25M at 10:01:00 → Loses
```

### Budget Validation

- Teams must have sufficient budget to cover their bid
- Budget is checked before each player assignment
- If a team wins multiple players in one tier, budget is deducted after each win
- Teams that can't afford their bid have it marked as "lost"

### Player Availability

- Players can only be assigned once across all tiers
- Once a player is assigned in tier N, all bids for that player in tiers N+1 onwards are marked as "lost"
- Players are marked as unavailable (`is_available = FALSE`) after assignment

### Skip Handling

- Teams can skip any tier by setting `is_skip = true`
- Skipped bids are marked with status "skipped"
- Skipped bids don't affect budget or player availability

## Performance

### Benchmarks

- **20 teams, 7 tiers**: < 10 seconds
- **Database queries**: Optimized with batch operations
- **Memory usage**: Efficient with Map-based tracking

### Optimization Strategies

1. **Sequential Processing**: Tiers processed one at a time to maintain consistency
2. **In-Memory Tracking**: Team budgets and squads tracked in memory during processing
3. **Batch Updates**: Final results saved in batches
4. **Indexed Queries**: All database queries use indexed columns

## Error Handling

### Common Errors

1. **No tiers found**: Returns error if no tiers exist for league
2. **Invalid budget**: Bids exceeding budget are marked as "lost"
3. **Player not found**: Throws error if player doesn't exist
4. **Database errors**: Caught and returned in error array

### Error Response

```typescript
{
  success: false,
  league_id: 'league_123',
  results_by_tier: [], // Partial results if any
  total_players_drafted: 0,
  total_budget_spent: 0,
  average_squad_size: 0,
  processing_time_ms: 1234,
  errors: ['Error message here']
}
```

## Testing

### Test Coverage

- ✅ Process all tiers sequentially
- ✅ Assign players to highest bidders
- ✅ Handle ties using timestamp tiebreaker
- ✅ Deduct budget correctly
- ✅ Mark players as unavailable
- ✅ Handle skipped tiers
- ✅ Handle edge case: no bids
- ✅ Handle edge case: all skips
- ✅ Performance test: 20 teams, 7 tiers < 10s

### Running Tests

```bash
npm test lib/fantasy/draft-processor.test.ts
```

## Usage Example

### Complete Draft Flow

```typescript
import { processDraftTiers, generateDraftReport } from '@/lib/fantasy/draft-processor';

// 1. Process the draft
console.log('Starting draft processing...');
const result = await processDraftTiers('league_123');

if (!result.success) {
  console.error('Draft processing failed:', result.errors);
  return;
}

// 2. Log results
console.log(`✅ Draft complete!`);
console.log(`   Players drafted: ${result.total_players_drafted}`);
console.log(`   Budget spent: €${result.total_budget_spent}M`);
console.log(`   Average squad size: ${result.average_squad_size.toFixed(1)}`);
console.log(`   Processing time: ${result.processing_time_ms}ms`);

// 3. Log tier-by-tier results
result.results_by_tier.forEach(tier => {
  console.log(`\nTier ${tier.tier_number} (${tier.tier_name}):`);
  console.log(`   Total bids: ${tier.total_bids}`);
  console.log(`   Winners: ${tier.winners}`);
  console.log(`   Skipped: ${tier.skipped}`);
  
  tier.winning_bids.forEach(bid => {
    console.log(`   ✅ ${bid.player_name} → ${bid.team_name} (€${bid.bid_amount}M)`);
  });
});

// 4. Generate detailed report
const report = await generateDraftReport('league_123');

console.log(`\n📊 Draft Report:`);
report.teams.forEach(team => {
  console.log(`\n${team.team_name}:`);
  console.log(`   Squad size: ${team.squad_size}`);
  console.log(`   Budget spent: €${team.budget_spent}M`);
  console.log(`   Budget remaining: €${team.budget_remaining}M`);
  console.log(`   Players:`);
  
  team.players.forEach(player => {
    console.log(`      - ${player.player_name} (${player.position}) - €${player.purchase_price}M (Tier ${player.tier})`);
  });
});
```

## Integration

### With API Routes

```typescript
// app/api/fantasy/draft/process-tiers/route.ts
import { processDraftTiers } from '@/lib/fantasy/draft-processor';

export async function POST(request: Request) {
  const { league_id } = await request.json();
  
  // Verify committee access
  // ... authentication code ...
  
  const result = await processDraftTiers(league_id);
  
  return Response.json(result);
}
```

### With Notifications

```typescript
import { processDraftTiers } from '@/lib/fantasy/draft-processor';
import { sendNotification } from '@/lib/notifications/send-notification';

const result = await processDraftTiers('league_123');

if (result.success) {
  // Notify all teams
  for (const tierResult of result.results_by_tier) {
    for (const bid of tierResult.winning_bids) {
      await sendNotification({
        team_id: bid.team_id,
        title: 'Player Acquired!',
        message: `You won ${bid.player_name} for €${bid.bid_amount}M`
      });
    }
  }
}
```

## Troubleshooting

### Issue: Processing takes too long

**Solution**: Check database indexes on:
- `fantasy_tier_bids.tier_id`
- `fantasy_tier_bids.team_id`
- `fantasy_tier_bids.status`
- `fantasy_players.league_id`
- `fantasy_players.real_player_id`

### Issue: Budget not deducting correctly

**Solution**: Verify `initial_budget` is set correctly in `fantasy_teams` table. The processor calculates `budget_spent = initial_budget - budget_remaining`.

### Issue: Players assigned multiple times

**Solution**: This shouldn't happen due to the `awardedPlayers` Set tracking. Check for concurrent processing - only one process should run at a time.

## Future Enhancements

- [ ] Add transaction support for atomic operations
- [ ] Add rollback capability
- [ ] Add draft simulation mode (dry run)
- [ ] Add real-time progress updates via WebSocket
- [ ] Add draft history tracking
- [ ] Add undo/redo functionality for committee

## Related Files

- `lib/fantasy/tier-generator.ts` - Generates tiers before draft
- `lib/fantasy/blind-bid-processor.ts` - Alternative bid processing (priority-based)
- `app/api/fantasy/draft/process-tiers/route.ts` - API endpoint (to be created)

## License

Part of the Fantasy League Revamp project.
