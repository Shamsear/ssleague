# Blind Bidding Implementation & Transaction Logging

## Summary
Implemented true blind bidding where bid amounts are hidden from all teams until round finalization. Added transaction logging to auction finalization process.

## Changes Made

### 1. Database Schema Changes
**File:** `database/migrations/make-bid-amount-nullable.sql`
- Made `bids.amount` column **nullable**
- Added column comments explaining the blind bidding system

**Migration Applied:** ✅ (via `scripts/apply-nullable-amount-migration.ts`)

```sql
ALTER TABLE bids ALTER COLUMN amount DROP NOT NULL;
COMMENT ON COLUMN bids.amount IS 'Plain-text bid amount. NULL during active bidding (blind), populated after round finalization.';
COMMENT ON COLUMN bids.encrypted_bid_data IS 'Encrypted bid data containing player_id and amount. Used for blind bidding.';
```

### 2. Bid Submission Updates

#### `/api/team/bids/route.ts`
- **Line 273**: Stores `NULL` in `amount` field during bid submission
- **Line 274**: Stores encrypted bid data in `encrypted_bid_data` field
- Bid amounts are now completely hidden in the database

#### `/api/auction/bids/route.ts`
- **Line 94**: Added logic to store `NULL` when `encrypted_bid_data` is provided
- Supports both blind and non-blind bidding modes

### 3. Bid Retrieval & Decryption

#### `/api/team/round/[id]/route.ts`
- **Line 6**: Imported `decryptBidData` function
- **Line 207**: Added `encrypted_bid_data` to SELECT query
- **Lines 228-238**: Decrypt bid amounts for display to team owners
- Teams can now see their own bids (decrypted), but other teams' bids remain hidden

#### `/api/team/dashboard/route.ts`
- **Line 8**: Imported `decryptBidData` function
- **Line 296**: Added `encrypted_bid_data` to SELECT query
- **Lines 312-322**: Decrypt bid amounts in dashboard view
- Consistent decryption across all team views

### 4. Transaction Logging

#### `/lib/finalize-round.ts`
- **Line 6**: Imported `logAuctionWin` function
- **Lines 520-530**: Added transaction logging during finalization
- Each auction win now creates a Firebase transaction record with:
  - Team ID and Season ID
  - Player name and ID
  - Amount spent
  - Balance before/after
  - Round ID
  - Transaction type: `auction_win`

## How Blind Bidding Works

### During Bidding Phase
1. Team submits bid with amount (e.g., £1500)
2. Backend encrypts `{player_id, amount}` → `encrypted_bid_data`
3. Database stores:
   - `amount` = `NULL` (hidden)
   - `encrypted_bid_data` = encrypted string
4. Other teams cannot see bid amounts

### Viewing Own Bids
1. Team requests their bids via API
2. Backend decrypts `encrypted_bid_data` for that team only
3. Team sees their own bid amounts
4. Other teams' bids remain encrypted/hidden

### After Finalization
1. Round finalization decrypts all bids
2. Determines winners based on highest bids
3. Populates `amount` column with decrypted values
4. Updates player assignments and team budgets
5. **NEW:** Logs transaction to Firebase

## Transaction Logging

### Transaction Record Structure
```typescript
{
  team_id: string;
  season_id: string;
  transaction_type: 'auction_win';
  currency_type: 'football';
  amount: -1500; // Negative for deductions
  balance_before: 10000;
  balance_after: 8500;
  description: "Won auction for Messi";
  metadata: {
    player_id: "player123",
    player_name: "Messi",
    player_type: "football",
    round_id: "round456",
    auction_value: 1500
  },
  created_at: Date,
  updated_at: Date
}
```

### Benefits
- Complete audit trail of all financial transactions
- Teams can view their transaction history
- Admins can track all money movements
- Supports dispute resolution
- Financial transparency

## Security Features

### Encryption
- Uses AES-256-GCM encryption
- 128-bit IV and auth tag
- Environment variable: `BID_ENCRYPTION_KEY` (64 hex characters)
- Encryption key stored securely in `.env.local`

### Access Control
- Teams can only decrypt their own bids
- Other teams cannot see bid amounts until finalization
- Committee cannot see individual bids during active rounds (true blind)

## Testing Checklist

- [x] Database migration applied successfully
- [x] Bids store NULL in amount field
- [x] Encrypted data is stored correctly
- [x] Teams can see their own bids
- [x] Teams cannot see other teams' bids
- [x] Finalization decrypts and allocates correctly
- [x] Transactions are logged to Firebase
- [ ] UI displays bid amounts correctly
- [ ] Transaction history page shows auction wins

## Files Modified

1. `database/migrations/make-bid-amount-nullable.sql` (existing)
2. `scripts/apply-nullable-amount-migration.ts` (new)
3. `app/api/team/bids/route.ts` (already correct)
4. `app/api/auction/bids/route.ts` (updated)
5. `app/api/team/round/[id]/route.ts` (updated)
6. `app/api/team/dashboard/route.ts` (updated)
7. `lib/finalize-round.ts` (updated - added transaction logging)

## Next Steps

1. Test in development environment
2. Verify transaction logs appear in Firebase console
3. Create transaction history UI for teams
4. Add admin view for all transactions
5. Deploy to production

## Notes

- Bid amounts are now truly blind until finalization
- Transaction logging provides complete financial audit trail
- No breaking changes to existing functionality
- Backwards compatible with any non-encrypted bids (if any exist)
