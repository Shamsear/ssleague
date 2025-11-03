# Readable IDs Quick Reference

## ID Format Overview

| Entity | Format | Example | Description |
|--------|--------|---------|-------------|
| **Round** | `SSPSLFR{5-digit}` | `SSPSLFR00001` | Individual auction round |
| **Team** | `SSPSLT{4-digit}` | `SSPSLT0001` | Team participating in auction |
| **Bid** | `{teamId}_{roundId}` | `SSPSLT0001_SSPSLFR00001` | Compound: team + round |
| **Tiebreaker** | `SSPSLTR{5-digit}` | `SSPSLTR00001` | Tiebreaker for tied bids |
| **Team Tiebreaker** | `{teamId}_{tiebreakerId}` | `SSPSLT0001_SSPSLTR00001` | Compound: team + tiebreaker |
| **Bulk Round** | `SSPSLFBR{5-digit}` | `SSPSLFBR00001` | Bulk auction round |
| **Bulk Tiebreaker** | `SSPSLBT{5-digit}` | `SSPSLBT00001` | Bulk tiebreaker |

## Usage Examples

### Creating a Round
```typescript
import { generateRoundId } from '@/lib/id-generator';

const roundId = await generateRoundId();
// Returns: "SSPSLFR00001"

await sql`
  INSERT INTO rounds (id, season_id, player_id, status)
  VALUES (${roundId}, ${seasonId}, ${playerId}, 'active')
`;
```

### Creating a Team
```typescript
import { generateTeamId } from '@/lib/id-generator';

const teamId = await generateTeamId();
// Returns: "SSPSLT0001"

await sql`
  INSERT INTO teams (id, name, firebase_uid, season_id)
  VALUES (${teamId}, ${teamName}, ${firebaseUid}, ${seasonId})
`;
```

### Creating a Bid
```typescript
import { generateBidId } from '@/lib/id-generator';

const bidId = generateBidId(teamId, roundId);
// teamId = "SSPSLT0001", roundId = "SSPSLFR00001"
// Returns: "SSPSLT0001_SSPSLFR00001"

await sql`
  INSERT INTO bids (id, team_id, round_id, amount)
  VALUES (${bidId}, ${teamId}, ${roundId}, ${amount})
`;
```

### Creating a Tiebreaker
```typescript
import { generateTiebreakerId } from '@/lib/id-generator';

const tiebreakerId = await generateTiebreakerId();
// Returns: "SSPSLTR00001"

await sql`
  INSERT INTO tiebreakers (id, round_id, player_id, status)
  VALUES (${tiebreakerId}, ${roundId}, ${playerId}, 'active')
`;
```

### Creating a Team Tiebreaker
```typescript
import { generateTeamTiebreakerId } from '@/lib/id-generator';

const teamTiebreakerId = generateTeamTiebreakerId(teamId, tiebreakerId);
// teamId = "SSPSLT0001", tiebreakerId = "SSPSLTR00001"
// Returns: "SSPSLT0001_SSPSLTR00001"

await sql`
  INSERT INTO team_tiebreakers (id, tiebreaker_id, team_id)
  VALUES (${teamTiebreakerId}, ${tiebreakerId}, ${teamId})
`;
```

## Parsing Compound IDs

### Parse Bid ID
```typescript
import { parseBidId } from '@/lib/id-generator';

const bidId = "SSPSLT0001_SSPSLFR00001";
const { teamId, roundId } = parseBidId(bidId);
// teamId = "SSPSLT0001"
// roundId = "SSPSLFR00001"
```

### Parse Team Tiebreaker ID
```typescript
import { parseTeamTiebreakerId } from '@/lib/id-generator';

const teamTiebreakerId = "SSPSLT0001_SSPSLTR00001";
const { teamId, tiebreakerId } = parseTeamTiebreakerId(teamTiebreakerId);
// teamId = "SSPSLT0001"
// tiebreakerId = "SSPSLTR00001"
```

## Validation

### Validate IDs
```typescript
import { 
  isValidRoundId, 
  isValidTeamId, 
  isValidBidId,
  isValidTiebreakerId,
  isValidTeamTiebreakerId 
} from '@/lib/id-generator';

isValidRoundId("SSPSLFR00001");      // true
isValidRoundId("INVALID");           // false

isValidTeamId("SSPSLT0001");         // true
isValidTeamId("SSPSLT001");          // false (wrong padding)

isValidBidId("SSPSLT0001_SSPSLFR00001");  // true
isValidBidId("SSPSLT0001");               // false (missing round part)

isValidTiebreakerId("SSPSLTR00001");      // true
isValidTeamTiebreakerId("SSPSLT0001_SSPSLTR00001"); // true
```

## Database Queries

### Find Round by ID
```sql
SELECT * FROM rounds WHERE id = 'SSPSLFR00001';
```

### Find Bids for a Round
```sql
SELECT * FROM bids WHERE round_id = 'SSPSLFR00001';
```

### Find Bids for a Team
```sql
SELECT * FROM bids WHERE team_id = 'SSPSLT0001';
```

### Find Team Tiebreakers
```sql
SELECT * FROM team_tiebreakers 
WHERE tiebreaker_id = 'SSPSLTR00001';
```

### Join Teams with Their Bids
```sql
SELECT t.id, t.name, b.id as bid_id, b.amount
FROM teams t
LEFT JOIN bids b ON b.team_id = t.id
WHERE t.id = 'SSPSLT0001';
```

## Common Patterns

### Auto-Create Team on First Bid
```typescript
// Check if team exists
let teamIdResult = await sql`
  SELECT id FROM teams WHERE firebase_uid = ${userId} LIMIT 1
`;

let teamId: string;
if (teamIdResult.length === 0) {
  // Generate new team ID
  teamId = await generateTeamId();
  
  // Create team
  await sql`
    INSERT INTO teams (id, name, firebase_uid, season_id)
    VALUES (${teamId}, ${teamName}, ${userId}, ${seasonId})
  `;
} else {
  teamId = teamIdResult[0].id;
}

// Now use teamId for the bid
const bidId = generateBidId(teamId, roundId);
```

### Get Latest ID for Manual Inspection
```typescript
// Get the latest round
const latestRound = await sql`
  SELECT id FROM rounds ORDER BY created_at DESC LIMIT 1
`;
// Result: { id: "SSPSLFR00023" }

// Get the latest team
const latestTeam = await sql`
  SELECT id FROM teams ORDER BY created_at DESC LIMIT 1
`;
// Result: { id: "SSPSLT0015" }
```

## Tiebreaker Expiration Fix

### Frontend Check (NULL duration)
```typescript
// In your tiebreaker page component:
const getTimeRemaining = () => {
  if (!tiebreaker) return Infinity;
  
  // Check for NULL duration - means no time limit
  if (tiebreaker.duration_minutes === null || 
      tiebreaker.duration_minutes === undefined) {
    return Infinity;
  }
  
  // Calculate remaining time if duration exists
  if (!tiebreaker.hasTimeLimit || !tiebreaker.expiresAt) {
    return Infinity;
  }
  
  const expiryTime = new Date(tiebreaker.expiresAt).getTime();
  return Math.max(0, expiryTime - currentTime);
};

const isExpired = () => {
  if (!tiebreaker) return false;
  
  // Check for NULL duration - never expires
  if (tiebreaker.duration_minutes === null || 
      tiebreaker.duration_minutes === undefined) {
    return false;
  }
  
  if (!tiebreaker.hasTimeLimit) return false;
  return getTimeRemaining() === 0;
};
```

### Backend Check (NULL duration)
```typescript
// When creating tiebreakers:
await sql`
  INSERT INTO tiebreakers (
    id, round_id, player_id, status, duration_minutes
  ) VALUES (
    ${tiebreakerId}, ${roundId}, ${playerId}, 'active', NULL
  )
`;
// NULL duration_minutes means no time limit
```

## Troubleshooting

### Issue: "Duplicate key violation"
**Cause:** Trying to insert with an ID that already exists  
**Solution:** The ID generator always checks the database for the latest ID, so this shouldn't happen. If it does, verify you're calling the generator, not hardcoding IDs.

### Issue: "Foreign key violation"
**Cause:** Referencing a team/round that doesn't exist  
**Solution:** Ensure teams are created before bids, and rounds exist before assigning bids to them.

### Issue: "Tiebreaker shows as expired when it shouldn't"
**Cause:** Old code not checking for NULL duration  
**Solution:** Use the updated `getTimeRemaining()` and `isExpired()` functions that check for NULL.

## Best Practices

1. **Always use generators** - Never hardcode IDs
2. **Check for NULL duration** - In tiebreaker expiration logic
3. **Validate IDs** - Use validation functions when accepting external input
4. **Parse compound IDs** - Use parse functions to extract components
5. **Use indexes** - Database queries on ID columns are fast due to indexes

## Migration Status

- ✅ Database schema updated
- ✅ All tables using VARCHAR IDs
- ✅ Foreign keys configured
- ✅ API routes updated
- ✅ Tiebreaker expiration fixed
- ✅ All tests passing

---

**Need Help?** See `READABLE_IDS_IMPLEMENTATION_SUMMARY.md` for detailed implementation notes.
