# Bulk Round Finalization - Debugging Guide

## Issue
Bulk round finalization is getting stuck and not completing.

## Potential Causes

### 1. **Timeout Issues**
- Vercel has a 10-second timeout for serverless functions on free tier
- Finalization involves many database operations which might exceed this limit

**Solution:**
- Add timeout handling
- Break finalization into smaller chunks
- Use background jobs for long-running operations

### 2. **Database Deadlocks**
- Multiple concurrent updates might cause deadlocks
- Transaction conflicts between different operations

**Solution:**
- Add proper transaction handling
- Implement retry logic with exponential backoff

### 3. **Missing Error Handling**
- Errors might be silently failing
- No proper logging of where the process stops

**Solution:**
- Add comprehensive try-catch blocks
- Log each step of the finalization process
- Return detailed error messages

### 4. **Infinite Loops**
- Code might be stuck in a loop waiting for a condition
- Async operations not properly awaited

**Solution:**
- Review all loops and async operations
- Add timeouts to async operations
- Use Promise.race() for operations that might hang

## Recommended Debugging Steps

### Step 1: Add Detailed Logging

```typescript
console.log('[Finalize] Step 1: Fetching bids...');
const allBids = await sql`...`;
console.log(`[Finalize] Step 1 Complete: Found ${allBids.length} bids`);

console.log('[Finalize] Step 2: Grouping bids by player...');
// ... grouping logic
console.log(`[Finalize] Step 2 Complete: ${singleBidders.length} singles, ${conflicts.length} conflicts`);

console.log('[Finalize] Step 3: Assigning single bidders...');
// ... assignment logic
console.log(`[Finalize] Step 3 Complete: Assigned ${immediatelyAssigned} players`);

console.log('[Finalize] Step 4: Creating tiebreakers...');
// ... tiebreaker logic
console.log(`[Finalize] Step 4 Complete: Created ${tiebreakerCreated} tiebreakers`);

console.log('[Finalize] Step 5: Updating round status...');
// ... status update
console.log('[Finalize] Step 5 Complete: Round finalized');
```

### Step 2: Add Timeout Protection

```typescript
const FINALIZE_TIMEOUT = 8000; // 8 seconds (leave 2s buffer for Vercel)

const finalizeWithTimeout = Promise.race([
  actualFinalizationLogic(),
  new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Finalization timeout')), FINALIZE_TIMEOUT)
  )
]);

try {
  await finalizeWithTimeout;
} catch (error) {
  if (error.message === 'Finalization timeout') {
    // Handle timeout - maybe queue for background processing
    return NextResponse.json({
      success: false,
      error: 'Finalization is taking longer than expected. Please try again or contact support.',
      timeout: true
    }, { status: 408 });
  }
  throw error;
}
```

### Step 3: Check for Blocking Operations

Look for:
- `await` inside loops (can be slow)
- Firebase operations without proper error handling
- Database queries without indexes
- Large batch operations

### Step 4: Add Progress Tracking

```typescript
// Store progress in database or cache
await sql`
  INSERT INTO finalization_progress (round_id, step, status, timestamp)
  VALUES (${roundId}, 'started', 'in_progress', NOW())
`;

// Update as you go
await sql`
  UPDATE finalization_progress 
  SET step = 'assigning_singles', status = 'in_progress'
  WHERE round_id = ${roundId}
`;

// Mark complete
await sql`
  UPDATE finalization_progress 
  SET step = 'completed', status = 'success'
  WHERE round_id = ${roundId}
`;
```

## Quick Fixes to Try

### 1. Add Early Return for Already Finalized Rounds
The code already has this, but ensure it's working:

```typescript
if (round.status === 'completed') {
  return NextResponse.json({
    success: true,
    message: 'Round already finalized'
  });
}
```

### 2. Add Request Deduplication
Prevent multiple simultaneous finalization requests:

```typescript
const lockKey = `finalize_lock_${roundId}`;
const isLocked = await checkLock(lockKey);
if (isLocked) {
  return NextResponse.json({
    success: false,
    error: 'Finalization already in progress'
  }, { status: 409 });
}
await setLock(lockKey, 30); // 30 second lock
```

### 3. Optimize Database Queries
- Use batch inserts instead of individual inserts
- Add indexes on frequently queried columns
- Use transactions to group related operations

## Monitoring

Add these logs to track performance:

```typescript
console.time('Total Finalization');
console.time('Fetch Bids');
const bids = await sql`...`;
console.timeEnd('Fetch Bids');

console.time('Process Singles');
// ... singles logic
console.timeEnd('Process Singles');

console.time('Create Tiebreakers');
// ... tiebreaker logic
console.timeEnd('Create Tiebreakers');

console.timeEnd('Total Finalization');
```

## Next Steps

1. Check server logs to see where the process stops
2. Add the detailed logging above
3. Test with a small round first (few players/bids)
4. Monitor execution time for each step
5. Optimize the slowest operations

## Common Issues Found

- **Firebase batch operations timing out**: Use smaller batches (max 500 operations)
- **SQL queries without proper indexes**: Add indexes on `round_id`, `player_id`, `team_id`
- **Notification sending blocking**: Make notifications async/fire-and-forget
- **Transaction logging taking too long**: Batch transaction logs

---

**Note:** Without access to server logs showing where exactly it's getting stuck, these are general debugging strategies. Check your Vercel logs or local console to see the last log message before it hangs.
