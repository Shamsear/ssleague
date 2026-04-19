# Player History Integration Guide

## Overview
The `player_history` table must be updated whenever footballplayers are modified. This ensures complete audit trail and transfer history.

## Critical Rules

### 1. When a player is acquired (auction win)
```sql
-- Close any existing active record (shouldn't exist, but safety check)
UPDATE player_history 
SET status = 'replaced', end_date = NOW()
WHERE player_id = ? AND status = 'active';

-- Create new active record
INSERT INTO player_history (
  player_id, player_name, position,
  team_id, team_name, season_id,
  acquisition_type, acquisition_value,
  contract_start_season, contract_end_season,
  round_id, status
) VALUES (...);
```

### 2. When a player is released
```sql
-- Close the active record
UPDATE player_history 
SET 
  status = 'released',
  end_date = NOW(),
  end_reason = 'release',
  contract_end_season = [current_season],  -- Contract ends at release
  transaction_id = [transaction_id]
WHERE player_id = ? 
AND team_id = ? 
AND season_id = ?
AND status = 'active';
```

### 3. When a player is transferred/sold
```sql
-- Close old team's record
UPDATE player_history 
SET 
  status = 'transferred',
  end_date = NOW(),
  end_reason = 'transfer',
  contract_end_season = [current_season],  -- Contract ends at transfer
  transaction_id = [transaction_id]
WHERE player_id = ? 
AND team_id = [old_team_id]
AND status = 'active';

-- Create new team's record
INSERT INTO player_history (
  player_id, player_name, position,
  team_id, team_name, season_id,
  acquisition_type, acquisition_value,
  contract_start_season, contract_end_season,
  transaction_id, status
) VALUES (...);
```

### 4. When players are swapped
```sql
-- Close both players' records
UPDATE player_history 
SET 
  status = 'swapped',
  end_date = NOW(),
  end_reason = 'swap',
  contract_end_season = [current_season],  -- Contract ends at swap
  transaction_id = [transaction_id],
  related_history_id = [other_player_history_id]
WHERE player_id IN (?, ?) 
AND status = 'active';

-- Create new records for both players with new teams
INSERT INTO player_history (...) VALUES (...);  -- Player A to Team B
INSERT INTO player_history (...) VALUES (...);  -- Player B to Team A
```

### 5. When a team takeover happens
```sql
-- Close old team's records
UPDATE player_history 
SET 
  status = 'takeover',
  end_date = NOW(),
  end_reason = 'takeover'
WHERE team_id = [old_team_id]
AND season_id = [takeover_season]
AND status = 'active';

-- Create new team's records
INSERT INTO player_history (
  player_id, player_name, position,
  team_id, team_name, season_id,
  acquisition_type, acquisition_value,
  contract_start_season, contract_end_season,
  status
) VALUES (...);  -- For each player
```

## Files That Need Updates

### High Priority (Player Movement APIs)

1. **Auction Finalization**
   - `app/api/rounds/[id]/route.ts` - When players are assigned to teams
   - `lib/finalize-round.ts` - Bulk round finalization
   - Action: Add player_history INSERT after footballplayers INSERT

2. **Player Release**
   - `app/api/players/release/route.ts` (if exists)
   - Action: Add player_history UPDATE to close record

3. **Player Transfer**
   - `app/api/players/transfer-v2/route.ts`
   - Action: Add player_history UPDATE (close) + INSERT (new)

4. **Player Swap**
   - `app/api/players/simple-swap/route.ts`
   - `app/api/players/swap/route.ts`
   - Action: Add player_history UPDATE (close both) + INSERT (both new)

### Medium Priority (Season Management)

5. **Season Carryover**
   - `app/dashboard/admin/season-carryover/page.tsx`
   - Action: Create new player_history records for carried over players

6. **Contract Updates**
   - Any API that modifies contract_start_season or contract_end_season
   - Action: Update corresponding player_history record

### Implementation Pattern

```typescript
// Example: In transfer API
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.NEON_DATABASE_URL);

async function transferPlayer(playerId, fromTeamId, toTeamId, seasonId, transactionId) {
  // 1. Update footballplayers
  await sql`
    UPDATE footballplayers 
    SET team_id = ${toTeamId}, team_name = ${toTeamName}
    WHERE player_id = ${playerId}
  `;

  // 2. Close old player_history record
  await sql`
    UPDATE player_history 
    SET 
      status = 'transferred',
      end_date = NOW(),
      end_reason = 'transfer',
      contract_end_season = ${seasonId},
      transaction_id = ${transactionId}
    WHERE player_id = ${playerId}
    AND team_id = ${fromTeamId}
    AND status = 'active'
  `;

  // 3. Create new player_history record
  await sql`
    INSERT INTO player_history (
      player_id, player_name, position,
      team_id, team_name, season_id,
      acquisition_type, acquisition_value,
      contract_start_season, contract_end_season,
      transaction_id, status
    ) VALUES (
      ${playerId}, ${playerName}, ${position},
      ${toTeamId}, ${toTeamName}, ${seasonId},
      'transfer', ${transferValue},
      ${seasonId}, ${contractEndSeason},
      ${transactionId}, 'active'
    )
  `;
}
```

## Helper Functions to Create

### `lib/player-history.ts`

```typescript
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.NEON_DATABASE_URL);

export async function closePlayerHistory(
  playerId: string,
  teamId: string,
  reason: 'release' | 'transfer' | 'swap' | 'takeover',
  currentSeason: string,
  transactionId?: string
) {
  await sql`
    UPDATE player_history 
    SET 
      status = ${reason === 'release' ? 'released' : reason === 'transfer' ? 'transferred' : reason === 'swap' ? 'swapped' : 'takeover'},
      end_date = NOW(),
      end_reason = ${reason},
      contract_end_season = ${currentSeason},
      transaction_id = ${transactionId || null}
    WHERE player_id = ${playerId}
    AND team_id = ${teamId}
    AND status = 'active'
  `;
}

export async function createPlayerHistory(data: {
  playerId: string;
  playerName: string;
  position: string;
  teamId: string;
  teamName: string;
  seasonId: string;
  acquisitionType: 'auction' | 'transfer' | 'swap' | 'takeover' | 'carryover';
  acquisitionValue: number;
  contractStartSeason: string;
  contractEndSeason: string;
  roundId?: string;
  transactionId?: string;
}) {
  await sql`
    INSERT INTO player_history (
      player_id, player_name, position,
      team_id, team_name, season_id,
      acquisition_type, acquisition_value,
      contract_start_season, contract_end_season,
      round_id, transaction_id, status
    ) VALUES (
      ${data.playerId}, ${data.playerName}, ${data.position},
      ${data.teamId}, ${data.teamName}, ${data.seasonId},
      ${data.acquisitionType}, ${data.acquisitionValue},
      ${data.contractStartSeason}, ${data.contractEndSeason},
      ${data.roundId || null}, ${data.transactionId || null}, 'active'
    )
  `;
}
```

## Testing Checklist

- [ ] Auction win creates player_history record
- [ ] Player release closes player_history record with correct contract_end_season
- [ ] Player transfer closes old record and creates new record
- [ ] Player swap closes both records and creates both new records
- [ ] Team takeover closes old records and creates new records
- [ ] Season carryover creates new records for carried players
- [ ] Contract updates reflect in player_history

## Migration Strategy

1. Create helper functions in `lib/player-history.ts`
2. Update auction finalization first (most critical)
3. Update release/transfer/swap APIs
4. Update season management
5. Add tests for each operation
6. Monitor for any missed updates

## Monitoring

Query to find players without history:
```sql
SELECT fp.player_id, fp.name, fp.team_id, fp.season_id
FROM footballplayers fp
LEFT JOIN player_history ph ON fp.player_id = ph.player_id 
  AND fp.team_id = ph.team_id 
  AND fp.season_id = ph.season_id
  AND ph.status = 'active'
WHERE fp.is_sold = true
AND ph.id IS NULL;
```

Query to find orphaned active history:
```sql
SELECT ph.*
FROM player_history ph
LEFT JOIN footballplayers fp ON ph.player_id = fp.player_id 
  AND ph.team_id = fp.team_id 
  AND ph.season_id = fp.season_id
WHERE ph.status = 'active'
AND fp.id IS NULL;
```
