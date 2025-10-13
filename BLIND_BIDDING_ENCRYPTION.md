# Blind Bidding Encryption Implementation

## Overview

To ensure true blind bidding, we need to encrypt sensitive bid data (`player_id` and `amount`) so that:
1. Database administrators cannot see bid details
2. Teams cannot see other teams' bids
3. Only the finalization process can decrypt and reveal bids

## Implementation Strategy

### Current Schema
```sql
CREATE TABLE bids (
  id UUID PRIMARY KEY,
  team_id VARCHAR(255) NOT NULL,
  player_id VARCHAR(255) NOT NULL,    -- ❌ Visible in DB
  round_id UUID NOT NULL,
  amount INTEGER NOT NULL,             -- ❌ Visible in DB
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### Proposed Schema with Encryption
```sql
CREATE TABLE bids (
  id UUID PRIMARY KEY,
  team_id VARCHAR(255) NOT NULL,
  encrypted_bid_data TEXT NOT NULL,    -- ✅ Encrypted: {player_id, amount}
  round_id UUID NOT NULL,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

## Setup Steps

### 1. Add Encryption Key to Environment

Add the generated key to `.env.local`:
```bash
BID_ENCRYPTION_KEY=597a51bbf0a45371fe1c64059a2ca0cab45abe35936db076b46c8ce2835e96bc
```

### 2. Update Database Schema

```sql
-- Add new encrypted column
ALTER TABLE bids ADD COLUMN encrypted_bid_data TEXT;

-- Migrate existing data (if any)
-- Note: Existing unencrypted bids need to be encrypted or removed

-- Make encrypted column required after migration
ALTER TABLE bids ALTER COLUMN encrypted_bid_data SET NOT NULL;

-- Drop old columns (after migration is complete)
ALTER TABLE bids DROP COLUMN player_id;
ALTER TABLE bids DROP COLUMN amount;
```

### 3. Update API Endpoints

#### Create Bid API (`/api/team/bids`)
```typescript
import { encryptBidData } from '@/lib/encryption';

// When creating a bid
const encryptedData = encryptBidData({
  player_id: player_id,
  amount: amount
});

await sql`
  INSERT INTO bids (team_id, encrypted_bid_data, round_id, status)
  VALUES (${teamId}, ${encryptedData}, ${roundId}, 'active')
`;
```

#### Finalization Process (`lib/finalize-round.ts`)
```typescript
import { decryptBidData } from '@/lib/encryption';

// When finalizing, decrypt all bids
const bids = await sql`SELECT * FROM bids WHERE round_id = ${roundId}`;

const decryptedBids = bids.map(bid => ({
  ...bid,
  ...decryptBidData(bid.encrypted_bid_data)
}));

// Process bids normally
```

## Security Benefits

✅ **Database Admin Cannot See Bids**: Even with direct database access, admins only see encrypted gibberish

✅ **Tamper-Proof**: AES-256-GCM provides authentication, preventing bid tampering

✅ **Teams Cannot Snoop**: No API endpoint exposes encrypted data before finalization

✅ **Audit Trail**: Creation timestamps remain visible for fairness verification

## Migration Plan

### Phase 1: Add Encryption (Non-Breaking)
1. Add `encrypted_bid_data` column
2. Update bid creation to write BOTH old and new format
3. Deploy and test

### Phase 2: Switch to Encrypted (Breaking Change)
1. Update finalization to read from `encrypted_bid_data`
2. Remove old columns
3. Deploy

### Phase 3: Clean Up
1. Remove backwards compatibility code
2. Update documentation

## Testing

```javascript
// Test encryption/decryption
const { encryptBidData, decryptBidData } = require('./lib/encryption');

const original = { player_id: '2341', amount: 500 };
const encrypted = encryptBidData(original);
const decrypted = decryptBidData(encrypted);

console.log('Original:', original);
console.log('Encrypted:', encrypted);
console.log('Decrypted:', decrypted);
console.log('Match:', JSON.stringify(original) === JSON.stringify(decrypted));
```

## Rollback Plan

If issues occur:
1. Revert to previous code version
2. Encrypted bids remain in database (safe to leave)
3. Future bids use old format until fixed

## Notes

- ⚠️ **Keep encryption key secret!**
- ⚠️ **Backup key securely!** (losing it means unable to decrypt bids)
- ⚠️ **Use same key across all environments accessing same DB**
- Consider key rotation strategy for long-term security
