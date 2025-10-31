# Player Transfer System - Complete Implementation

## Overview
The player transfer system supports both **Real Players** (Tournament DB) and **Football Players** (Auction DB) with three core operations:
1. **Release** - Player to free agent with 70% refund
2. **Transfer** - Player from Team A to Team B with compensation
3. **Swap** - Exchange players between teams with optional fee

---

## Architecture

### Database Structure

#### Tournament Database (`player_seasons` table)
```sql
-- Real player contract fields
contract_id VARCHAR(255)
contract_start_season VARCHAR(50)
contract_end_season VARCHAR(50)
contract_length INTEGER
status VARCHAR(50)  -- 'active', 'free_agent', etc.
auction_value INTEGER
```

#### Auction Database (`footballplayers` table)
```sql
-- Football player contract fields
contract_id VARCHAR(255)
contract_start_season VARCHAR(50)
contract_end_season VARCHAR(50)
contract_length INTEGER
status VARCHAR(50)  -- 'active', 'free_agent', etc.
acquisition_value INTEGER  -- Note: Different field name!
```

### Field Mapping
The system handles the field name discrepancy between databases:
- `player_seasons` uses `auction_value`
- `footballplayers` uses `acquisition_value`

APIs automatically map between these fields.

---

## Backend Implementation

### API Endpoints

#### 1. Release Player
**Endpoint:** `POST /api/players/release`

**Request Body:**
```json
{
  "player_id": "string",
  "season_id": "string",
  "player_type": "real" | "football",
  "released_by": "string",
  "released_by_name": "string"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Player released successfully. Team refunded $280",
  "refund_amount": 280,
  "player_name": "John Doe",
  "previous_team_id": "team_123",
  "player_type": "real"
}
```

#### 2. Transfer Player
**Endpoint:** `POST /api/players/transfer`

**Request Body:**
```json
{
  "player_id": "string",
  "new_team_id": "string",
  "new_team_name": "string",
  "new_contract_value": 400,
  "new_contract_duration": 1.5,  // 0.5, 1, 1.5, or 2 seasons
  "season_id": "string",
  "player_type": "real" | "football",
  "transferred_by": "string",
  "transferred_by_name": "string"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Transfer complete...",
  "old_team_id": "team_123",
  "new_team_id": "team_456",
  "old_team_refund": 280,
  "new_team_cost": 400,
  "new_contract_duration": 1.5
}
```

#### 3. Swap Players
**Endpoint:** `POST /api/players/swap`

**Request Body:**
```json
{
  "player_a_id": "string",
  "player_b_id": "string",
  "fee_amount": 50,  // Positive = A pays B, Negative = B pays A, 0 = no fee
  "season_id": "string",
  "player_type": "real" | "football",
  "swapped_by": "string",
  "swapped_by_name": "string"
}
```

#### 4. Fetch Players
- **Real Players:** `GET /api/stats/players?seasonId={id}&limit=1000`
- **Football Players:** `GET /api/football-players?seasonId={id}&limit=1000`

---

## Frontend Implementation

### Location
`/app/dashboard/committee/players/transfers/page.tsx`

### Features
1. **Player Type Toggle** - Switch between Real and Football players
2. **Three Operation Tabs:**
   - Release (Red theme)
   - Transfer (Blue theme)  
   - Swap (Purple theme)
3. **Live Financial Preview** - Shows refunds, costs before execution
4. **Contract Duration Selector** - 0.5, 1, 1.5, 2 seasons

### Access Control
- Committee Admin only (`isCommitteeAdmin` permission)
- Validates team balances before operations
- Prevents invalid swaps (same team, free agents, etc.)

---

## Transfer Logic

### Refund Calculation (70% Rule)
```typescript
function calculateReleaseRefund(
  auctionValue: number,
  contractStartSeason: string,
  contractEndSeason: string,
  currentSeasonId: string
): number {
  const totalSeasons = endNum - startNum + 1;
  const remainingSeasons = Math.max(0, endNum - currentNum + 1);
  const remainingPercentage = remainingSeasons / totalSeasons;
  
  // 70% refund of remaining contract value
  return Math.floor(auctionValue * remainingPercentage * 0.7);
}
```

**Example:**
- Original contract: $400 for 2 seasons
- 1 season remaining
- Refund: $400 × (1/2) × 0.7 = **$140**

### Contract Duration
Supports fractional seasons:
- **0.5 seasons** - Half season
- **1.0 season** - Full season  
- **1.5 seasons** - Season and a half
- **2.0 seasons** - Two full seasons

### Status Management
- **Before Release:** `status = 'active'`, `team_id = 'team_123'`
- **After Release:** `status = 'free_agent'`, `team_id = NULL`
- **After Transfer:** `status = 'active'`, `team_id = 'new_team'`

---

## Transaction Records

All operations create transaction records in Firebase:
```typescript
{
  transaction_type: 'release' | 'transfer' | 'swap',
  player_id: string,
  player_name: string,
  player_type: 'real' | 'football',
  team_id: string,
  season_id: string,
  // Operation-specific fields...
  processed_by: string,
  processed_by_name: string,
  created_at: Date
}
```

---

## News Generation

Operations automatically generate league news:
```typescript
// Release
"Team X has released Player Y to free agency. 
Team received a refund of $280."

// Transfer  
"Player Y has been transferred from Team X to Team Z 
for $400. Team X received $280 in compensation."

// Swap
"Team X and Team Y have completed a player swap. 
Player A moves to Team Y, while Player B joins Team X. 
Team X paid $50 to Team Y as part of the deal."
```

---

## Testing

### Run System Test
```bash
node scripts/test-transfer-system.js
```

### Manual Testing Steps

1. **Navigate to Transfers Page**
   ```
   /dashboard/committee/players/transfers
   ```

2. **Test Release:**
   - Select player type (Real/Football)
   - Choose player with active contract
   - Review financial preview
   - Execute release
   - Verify team balance increased
   - Check player status changed to `free_agent`

3. **Test Transfer:**
   - Select player and target team
   - Set contract value and duration
   - Review old team refund and new team cost
   - Execute transfer
   - Verify both team balances updated
   - Check player moved to new team

4. **Test Swap:**
   - Select two players from different teams
   - Optional: Set adjustment fee
   - Review swap preview
   - Execute swap
   - Verify players swapped teams
   - Check fee transaction completed

---

## Error Handling

### Validation Checks
- ✅ Player exists
- ✅ Player not already free agent (for release/transfer)
- ✅ Teams have sufficient balance
- ✅ Players on different teams (for swap)
- ✅ Contract duration is valid (0.5, 1, 1.5, 2)
- ✅ Player type matches (for swap)

### Error Messages
```typescript
// Common errors
"Player not found"
"Player is already a free agent"
"Team has insufficient funds"
"Cannot swap players of different types"
"Both players are on the same team"
```

---

## Code Organization

```
lib/
├── player-transfers.ts              # Firebase-only version (legacy)
└── player-transfers-neon.ts         # Neon DB version (active)

app/api/players/
├── release/route.ts                 # Release API
├── transfer/route.ts                # Transfer API
└── swap/route.ts                    # Swap API

app/api/
├── stats/players/route.ts           # Real players endpoint
└── football-players/route.ts        # Football players endpoint

app/dashboard/committee/players/
└── transfers/page.tsx               # Frontend UI

scripts/
├── test-transfer-system.js          # System test
└── check-footballplayers-schema.js  # Schema check
```

---

## Key Features

✅ **Dual Database Support** - Works with both Tournament and Auction DBs
✅ **Field Mapping** - Handles `auction_value` ↔ `acquisition_value`  
✅ **Fractional Seasons** - Supports 0.5, 1, 1.5, 2 season contracts
✅ **Financial Preview** - Shows costs/refunds before execution
✅ **Auto News Generation** - Creates league news for all operations
✅ **Transaction Logging** - Records all operations in Firebase
✅ **Budget Validation** - Prevents overspending
✅ **Status Management** - Tracks player availability
✅ **Team Balance Updates** - Automatic balance adjustments

---

## Future Enhancements

### Potential Features
- [ ] Transfer windows (time-based restrictions)
- [ ] Transfer history page (view past transactions)
- [ ] Bulk operations (release multiple players)
- [ ] Trade deadline enforcement
- [ ] Player consent system (opt-in transfers)
- [ ] Compensation rules customization
- [ ] Multi-season contract automation
- [ ] Transfer market statistics

---

## Migration Notes

### From Firebase to Neon
The system has been migrated from Firebase-only to Neon databases:
- Old: `realplayer` collection → New: `player_seasons` table
- New: `footballplayers` table (Auction DB)
- Old transfer lib still exists for backward compatibility
- All new operations use Neon-based APIs

### Breaking Changes
None - The frontend API contracts remain unchanged.

---

## Support

### Common Issues

**Q: "Failed to fetch players"**  
A: Check if the season has registered players with teams.

**Q: "Player not found"**  
A: Ensure player_id and season_id are correct.

**Q: "Insufficient funds"**  
A: Check team dollar_balance in team_seasons table.

**Q: "Cannot release free agent"**  
A: Player is already released. Check status field.

### Debug Mode
Enable logging in API routes:
```typescript
console.log('Player data:', playerData);
console.log('Refund amount:', refundAmount);
```

---

## Conclusion

The player transfer system is fully operational with comprehensive support for both Real and Football players. The system handles contract management, financial transactions, status updates, and news generation automatically while maintaining data consistency across databases.
