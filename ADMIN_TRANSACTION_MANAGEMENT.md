# Admin Transaction Management

## Overview
The Admin Transaction Management system allows administrators to issue fines, bonuses, and manual adjustments to team balances. All transactions are automatically logged and appear in team transaction histories.

## Features

### Transaction Types

1. **Fine** - Deduct money from a team
   - Always uses positive amounts (e.g., 200 = deduct $200)
   - Deducted from team balance
   - Common uses: Disciplinary actions, rule violations, late submissions

2. **Bonus** - Add money to a team
   - Always uses positive amounts (e.g., 500 = add $500)
   - Added to team balance
   - Common uses: Rewards, achievements, special events

3. **Adjustment** - Manual balance correction
   - Can be positive (add) or negative (deduct)
   - Used for corrections or special circumstances
   - Example: +100 adds $100, -50 deducts $50

## Admin Interface

### Location
`/admin/transactions`

### How to Use

1. **Select Season** - Choose the active season
2. **Select Team** - Pick the team to apply the transaction to
3. **Choose Transaction Type** - Fine, Bonus, or Adjustment
4. **Enter Amount**
   - Fine/Bonus: Positive numbers only
   - Adjustment: Positive (add) or negative (deduct)
5. **Provide Reason** - Explain why the transaction is being made
6. **Review Preview** - Check the balance change before submitting
7. **Apply Transaction** - Click the button to process

### Balance Preview
The interface shows:
- Current balance
- Change amount
- New balance after transaction

### Validation
- Amount cannot be zero for adjustments
- Fine/Bonus amounts must be positive
- Adjustments cannot result in negative balance
- All fields are required

## API Endpoints

### Issue Fine
```
POST /api/admin/transactions/fine
```

**Request Body:**
```json
{
  "teamId": 1,
  "amount": 200,
  "reason": "Late lineup submission",
  "seasonId": 1,
  "issuedBy": "Admin Name"
}
```

**Response:**
```json
{
  "success": true,
  "teamName": "Team Alpha",
  "previousBalance": 10000,
  "newBalance": 9800,
  "fineAmount": 200,
  "reason": "Late lineup submission"
}
```

### Issue Bonus
```
POST /api/admin/transactions/bonus
```

**Request Body:**
```json
{
  "teamId": 1,
  "amount": 500,
  "reason": "Tournament winner bonus",
  "seasonId": 1,
  "issuedBy": "Admin Name"
}
```

**Response:**
```json
{
  "success": true,
  "teamName": "Team Alpha",
  "previousBalance": 10000,
  "newBalance": 10500,
  "bonusAmount": 500,
  "reason": "Tournament winner bonus"
}
```

### Apply Adjustment
```
POST /api/admin/transactions/adjustment
```

**Request Body:**
```json
{
  "teamId": 1,
  "amount": -100,
  "reason": "Balance correction",
  "seasonId": 1,
  "adjustedBy": "Admin Name"
}
```

**Response:**
```json
{
  "success": true,
  "teamName": "Team Alpha",
  "previousBalance": 10000,
  "newBalance": 9900,
  "adjustmentAmount": -100,
  "reason": "Balance correction"
}
```

## Error Handling

### Common Errors

**400 Bad Request**
- Missing required fields
- Invalid amounts (zero, negative for fine/bonus)
- Adjustment would cause negative balance

**404 Not Found**
- Team not found in the specified season

**500 Internal Server Error**
- Database connection issues
- Transaction logging failure

### Error Response Format
```json
{
  "error": "Error message description"
}
```

## Transaction Logging

All transactions are automatically logged to the `transactions` table:

### Fine Transaction
```typescript
{
  team_id: 1,
  season_id: 1,
  currency_type: 'football',
  transaction_type: 'fine',
  amount: -200,
  reason: 'Late lineup submission',
  balance_after: 9800,
  metadata: {
    issued_by: 'Admin Name',
    previous_balance: 10000,
    new_balance: 9800
  }
}
```

### Bonus Transaction
```typescript
{
  team_id: 1,
  season_id: 1,
  currency_type: 'football',
  transaction_type: 'bonus',
  amount: 500,
  reason: 'Tournament winner bonus',
  balance_after: 10500,
  metadata: {
    issued_by: 'Admin Name',
    previous_balance: 10000,
    new_balance: 10500
  }
}
```

### Adjustment Transaction
```typescript
{
  team_id: 1,
  season_id: 1,
  currency_type: 'football',
  transaction_type: 'adjustment',
  amount: -100,
  reason: 'Balance correction',
  balance_after: 9900,
  metadata: {
    adjusted_by: 'Admin Name',
    previous_balance: 10000,
    new_balance: 9900
  }
}
```

## Team Transaction View

### Filtering
Teams can filter their transaction history by type:
- All Transactions
- Auction Wins
- Salaries
- Fines
- Bonuses
- Adjustments
- Transfer Payments
- Transfer Compensation
- Swap Fees Paid
- Swap Fees Received
- Release Refunds
- Real Player Fees
- Initial Balance

### Transaction Icons
Each transaction type has a unique icon:
- 💰 Salary
- ⚠️ Fine
- 🔨 Auction
- 👤 Real Player Fee
- 🎁 Bonus
- 🔧 Adjustment
- ➡️ Transfer Payment
- ⬅️ Transfer Compensation
- 🔄 Swap Fee Paid
- 🔁 Swap Fee Received
- ↩️ Player Release Refund
- 🏦 Initial Balance

## Best Practices

### When to Use Each Type

**Fine:**
- Rule violations
- Late submissions
- Disciplinary actions
- Policy infractions

**Bonus:**
- Achievement rewards
- Tournament prizes
- Special event bonuses
- Performance incentives

**Adjustment:**
- Correcting errors
- Technical issues
- Special circumstances
- Balance fixes

### Reason Guidelines
Always provide clear, specific reasons:
- ✅ "Late lineup submission for Match 5"
- ✅ "Won tournament championship"
- ✅ "Correction for duplicate auction charge"
- ❌ "Fine" (too vague)
- ❌ "Adjustment" (no context)

### Amount Guidelines
- Keep amounts reasonable and fair
- Document large transactions
- Use adjustments for corrections only
- Always double-check preview before applying

## Database Schema

### Transactions Table
```sql
CREATE TABLE transactions (
  id SERIAL PRIMARY KEY,
  team_id INT NOT NULL,
  season_id INT NOT NULL,
  currency_type VARCHAR(20) NOT NULL,
  transaction_type VARCHAR(50) NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  reason TEXT NOT NULL,
  balance_after NUMERIC(10, 2) NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Teams Table (Updated Balance)
```sql
-- Balance is updated directly
UPDATE teams 
SET balance = balance + amount 
WHERE id = team_id;
```

## Security Considerations

1. **Admin Only** - Only admin users should access `/admin/transactions`
2. **Audit Trail** - All transactions include who issued them
3. **Reason Required** - Transparency for all balance changes
4. **Validation** - Prevents negative balances and invalid amounts
5. **Metadata** - Stores previous/new balance for verification

## Integration Points

### Files Modified/Created
1. `app/api/admin/transactions/fine/route.ts` - Fine API endpoint
2. `app/api/admin/transactions/bonus/route.ts` - Bonus API endpoint
3. `app/api/admin/transactions/adjustment/route.ts` - Adjustment API endpoint
4. `app/admin/transactions/page.tsx` - Admin UI
5. `app/dashboard/team/transactions/page.tsx` - Enhanced with filters
6. `lib/transaction-logger.ts` - Logger functions (already existed)

### Dependencies
- `@/lib/neon` - Database connection
- `@/lib/transaction-logger` - Transaction logging functions
- Next.js 14 App Router
- PostgreSQL with JSONB support

## Testing Checklist

- [ ] Fine deducts correct amount
- [ ] Bonus adds correct amount
- [ ] Adjustment handles positive/negative
- [ ] Transactions appear in team history
- [ ] Filters work correctly
- [ ] Validation prevents invalid transactions
- [ ] Metadata is saved correctly
- [ ] Balance preview is accurate
- [ ] Error messages are helpful
- [ ] Export includes new transactions

## Future Enhancements

1. **Bulk Operations** - Apply transaction to multiple teams
2. **Transaction Reversal** - Undo/reverse transactions
3. **Scheduled Transactions** - Auto-apply at specific times
4. **Transaction Templates** - Save common transaction types
5. **Admin Permissions** - Different admin roles for transactions
6. **Transaction Limits** - Max fine/bonus amounts per admin
7. **Approval Workflow** - Require multiple admin approvals
8. **Email Notifications** - Notify teams of fines/bonuses
