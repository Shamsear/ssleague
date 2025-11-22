# Design Document

## Overview

This design enhances the existing bulk round creation logic in the auction system to ensure robust, reliable, and transactional population of the `round_players` table. The current implementation in `app/api/rounds/route.ts` already includes logic to add players when creating bulk rounds, but this design formalizes the approach with improved error handling, transaction safety, and validation.

The solution focuses on the POST endpoint in `/app/api/rounds/route.ts` and ensures that the player population logic is idempotent, transactional, and provides clear feedback to users.

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Committee Dashboard                       │
│              /dashboard/committee/bulk-rounds                │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ POST /api/rounds
                         │ { round_type: 'bulk', ... }
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  Round Creation API                          │
│              app/api/rounds/route.ts                         │
│                                                              │
│  1. Validate request                                         │
│  2. Generate bulk round ID                                   │
│  3. Create round record (BEGIN TRANSACTION)                  │
│  4. Query eligible players                                   │
│  5. Batch insert into round_players                          │
│  6. Commit transaction                                       │
│  7. Return success with player count                         │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Neon Database                             │
│                                                              │
│  Tables:                                                     │
│  - rounds (round metadata)                                   │
│  - footballplayers (player master data)                      │
│  - round_players (players in specific rounds)                │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Enhanced Round Creation Endpoint

**Location:** `app/api/rounds/route.ts` (POST handler)

**Current State:** The endpoint already has logic to populate players for bulk rounds (lines 158-182), but lacks transaction management and comprehensive error handling.

**Enhanced Logic:**

```typescript
// Pseudo-code for enhanced implementation
async function POST(request: NextRequest) {
  // 1. Parse and validate request
  const { round_type, season_id, base_price, ... } = await request.json();
  
  // 2. Validate required fields
  if (!season_id || !round_number) {
    return error response;
  }
  
  // 3. Check for duplicate round numbers
  const existingRound = await checkDuplicateRound(season_id, round_number);
  
  // 4. Generate bulk round ID
  const roundId = await generateBulkRoundId();
  
  // 5. BEGIN TRANSACTION
  try {
    // 6. Create round record
    const newRound = await createRoundRecord({
      id: roundId,
      season_id,
      round_type: 'bulk',
      base_price,
      ...
    });
    
    // 7. If bulk round, populate players
    if (round_type === 'bulk') {
      const playerCount = await populateBulkRoundPlayers(
        newRound.id,
        season_id,
        base_price
      );
      
      // 8. Log success
      console.log(`✅ Added ${playerCount} players to bulk round`);
    }
    
    // 9. COMMIT TRANSACTION
    return success response with player count;
    
  } catch (error) {
    // 10. ROLLBACK on error
    console.error('Error creating bulk round:', error);
    return error response;
  }
}
```

### 2. Player Population Function

**New Function:** `populateBulkRoundPlayers()`

This function encapsulates the logic for querying eligible players and inserting them into `round_players`.

**Interface:**
```typescript
async function populateBulkRoundPlayers(
  roundId: string,
  seasonId: string,
  basePrice: number
): Promise<number>
```

**Logic:**
1. Query all eligible players from `footballplayers` table
2. Filter: `is_auction_eligible = true AND is_sold = false`
3. Batch insert into `round_players` with proper error handling
4. Return count of successfully inserted players

### 3. Database Queries

**Query 1: Fetch Eligible Players**
```sql
SELECT id, name, position, position_group
FROM footballplayers
WHERE is_auction_eligible = true
  AND is_sold = false
ORDER BY position, name
```

**Query 2: Batch Insert Players**
```sql
INSERT INTO round_players (
  round_id, 
  player_id, 
  player_name, 
  position, 
  position_group, 
  base_price, 
  status,
  season_id
)
VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)
```

## Data Models

### round_players Table Structure

Based on the existing schema, the `round_players` table has the following structure:

```sql
CREATE TABLE round_players (
  id SERIAL PRIMARY KEY,
  round_id VARCHAR REFERENCES rounds(id) ON DELETE CASCADE,
  player_id VARCHAR NOT NULL,
  player_name VARCHAR NOT NULL,
  position VARCHAR(50),
  position_group VARCHAR(10),
  base_price INTEGER DEFAULT 10,
  status VARCHAR(20) DEFAULT 'pending',  -- 'pending', 'sold', 'unsold'
  season_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Key Fields:**
- `round_id`: Foreign key to the rounds table
- `player_id`: Reference to footballplayers.id
- `status`: Tracks player state ('pending', 'sold', 'unsold')
- `season_id`: Ensures season isolation

## Error Handling

### Error Scenarios and Responses

1. **No Eligible Players Found**
   - Log warning: "⚠️ No eligible players found for bulk round"
   - Create round successfully with 0 players
   - Return success response with `player_count: 0`

2. **Database Connection Error**
   - Rollback transaction
   - Return 500 error with message: "Database connection failed"
   - Log full error details

3. **Player Insertion Failure**
   - Continue processing remaining players (resilient approach)
   - Log each failed insertion
   - Return success with count of successfully inserted players

4. **Transaction Rollback**
   - If round creation or player population fails critically
   - Rollback entire transaction
   - Return 500 error with descriptive message

### Logging Strategy

```typescript
// Success logging
console.log(`📝 Generated bulk round ID: ${roundId}`);
console.log(`📊 Found ${eligiblePlayers.length} auction-eligible players`);
console.log(`✅ Added ${playerCount} players to bulk round ${round_number}`);

// Warning logging
console.warn(`⚠️ No eligible players found for season ${season_id}`);

// Error logging
console.error(`❌ Failed to insert player ${player.id}:`, error);
console.error(`❌ Transaction failed, rolling back:`, error);
```

## Testing Strategy

### Unit Tests

1. **Test: Create bulk round with eligible players**
   - Setup: Mock database with 10 eligible players
   - Action: Create bulk round
   - Assert: 10 players inserted into round_players

2. **Test: Create bulk round with no eligible players**
   - Setup: Mock database with 0 eligible players
   - Action: Create bulk round
   - Assert: Round created successfully, player_count = 0

3. **Test: Handle player insertion failure gracefully**
   - Setup: Mock database to fail on 3rd player insertion
   - Action: Create bulk round with 5 players
   - Assert: 4 players inserted (skip failed one)

4. **Test: Prevent duplicate player entries**
   - Setup: Create bulk round, then attempt to add same players again
   - Action: Try to insert duplicate players
   - Assert: No duplicates created (idempotent behavior)

### Integration Tests

1. **Test: End-to-end bulk round creation**
   - Action: POST to /api/rounds with bulk round data
   - Assert: Round created, all eligible players added, correct response

2. **Test: Transaction rollback on failure**
   - Setup: Force database error during player insertion
   - Action: Create bulk round
   - Assert: Round NOT created (transaction rolled back)

3. **Test: Season isolation**
   - Setup: Create players for season A and season B
   - Action: Create bulk round for season A
   - Assert: Only season A players added

### Manual Testing Checklist

- [ ] Create bulk round via committee dashboard
- [ ] Verify player count matches eligible players in database
- [ ] Check round_players table for correct data
- [ ] Verify all players have status = 'pending'
- [ ] Test with empty footballplayers table
- [ ] Test with all players already sold
- [ ] Verify season_id is correctly set for all entries

## Implementation Notes

### Transaction Management

The Neon serverless driver doesn't support traditional BEGIN/COMMIT syntax. Instead, we'll use:
- Sequential SQL operations within a try-catch block
- Rely on database constraints (foreign keys, cascades) for data integrity
- Implement compensating transactions if needed (delete round if player insertion fails)

### Performance Considerations

- **Batch Inserts:** For large player sets (100+), consider using batch insert syntax
- **Indexing:** Ensure indexes exist on `round_players(round_id)` and `round_players(player_id)`
- **Query Optimization:** Use single query to fetch all eligible players rather than multiple queries

### Idempotency

To ensure idempotency:
- Check if `round_players` already has entries for the round before inserting
- Use `INSERT ... ON CONFLICT DO NOTHING` if supported
- Alternatively, query existing entries and skip duplicates

## Dependencies

- `@neondatabase/serverless`: Database connection
- `lib/id-generator.ts`: Generate bulk round IDs
- Existing `rounds` and `footballplayers` tables
- Existing `round_players` table structure
