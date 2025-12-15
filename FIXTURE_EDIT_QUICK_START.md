# Fixture Lineup Edit - Quick Start Guide

## 🚀 Implementation Complete!

All code changes have been implemented. Follow these steps to deploy:

## Step 1: Apply Database Migration

Run this command to add the new database fields:

```bash
psql $DATABASE_URL -f migrations/add_fixture_tracking_fields.sql
```

Or if using a different database tool, execute the SQL in:
`migrations/add_fixture_tracking_fields.sql`

## Step 2: Test the Changes

### Test 1: Home Team Lineup Editing
1. Create a fixture with both lineups submitted
2. Home team creates matchups
3. Before home deadline, home team edits lineup
4. Verify matchups are deleted
5. Home team recreates matchups with new lineup

### Test 2: Race Condition (Both Teams Create)
1. Let home deadline pass without home team creating matchups
2. Open fixture page in two different browsers (one as home team, one as away team)
3. Both teams select players and prepare matchups
4. Click "Create Matchups" on both browsers at the same time
5. Verify only one succeeds
6. Verify the other gets friendly error message
7. Verify page auto-refreshes to show created matchups

## What's New?

### For Home Teams:
- ✅ Can edit lineup multiple times before home deadline
- ✅ If matchups exist, they'll be deleted when lineup is edited
- ✅ Can recreate matchups with new lineup
- ✅ Away team gets notified of lineup changes

### For Both Teams (After Home Deadline):
- ✅ Both teams can create fixture if home team didn't submit
- ✅ First team to click "Submit" wins
- ✅ Second team gets friendly message: "Opponent already created fixture"
- ✅ Page auto-refreshes to show created matchups
- ✅ No duplicate matchups possible

### Technical Improvements:
- ✅ Database transactions prevent race conditions
- ✅ Row-level locking ensures data integrity
- ✅ Audit trail tracks all lineup changes
- ✅ Notifications keep teams informed
- ✅ Graceful error handling

## Files Changed

1. **Database**: `migrations/add_fixture_tracking_fields.sql`
2. **API - Matchups**: `app/api/fixtures/[fixtureId]/matchups/route.ts`
3. **API - Lineup**: `app/api/fixtures/[fixtureId]/lineup/route.ts`
4. **Frontend**: `app/dashboard/team/fixture/[fixtureId]/page.tsx`

## Key Features

### Race Condition Handling
```typescript
// In handleCreateMatchups
if (response.status === 409 && errorData.error === 'MATCHUPS_ALREADY_EXIST') {
  showAlert({
    type: 'warning',
    title: 'Fixture Already Created',
    message: 'The opponent has already created the fixture. Refreshing...'
  });
  setTimeout(() => window.location.reload(), 2000);
}
```

### Database Transaction
```typescript
// In matchups POST API
await sql.begin(async (tx) => {
  // Lock fixture row
  const [lockedFixture] = await tx`
    SELECT * FROM fixtures WHERE id = ${fixtureId} FOR UPDATE
  `;
  
  // Check if matchups exist
  const existingMatchups = await tx`
    SELECT COUNT(*) as count FROM matchups WHERE fixture_id = ${fixtureId}
  `;
  
  if (existingMatchups[0].count > 0 && !allow_overwrite) {
    throw new Error('MATCHUPS_ALREADY_EXIST');
  }
  
  // Insert matchups...
});
```

### Lineup Edit with Audit
```typescript
// In lineup PUT API
await logLineupChange({
  fixtureId,
  teamId,
  action: 'updated',
  previousLineup,
  newLineup: lineupData,
  changedBy: userId,
  reason: matchupsDeleted ? 'Lineup edited - matchups deleted' : 'Lineup edited',
  matchupsDeleted
});
```

## Monitoring

After deployment, monitor:
- Database logs for transaction errors
- Application logs for API errors
- `lineup_audit_log` table for lineup changes
- User feedback on race condition handling

## Troubleshooting

### Issue: Duplicate matchups created
**Solution**: Check if database migration was applied correctly. Verify `FOR UPDATE` lock is working.

### Issue: Both teams see error
**Solution**: Check round deadlines configuration. Verify phase calculation logic.

### Issue: Lineup edit doesn't delete matchups
**Solution**: Check `delete_matchups` parameter is being sent. Verify API permissions.

### Issue: Page doesn't refresh after race condition
**Solution**: Check browser console for errors. Verify `setTimeout` is executing.

## Next Steps

1. ✅ Apply database migration
2. ✅ Test in staging environment
3. ✅ Deploy to production
4. ✅ Monitor for issues
5. ✅ Gather user feedback

## Support

For issues or questions:
1. Check `FIXTURE_LINEUP_EDIT_IMPLEMENTATION_SUMMARY.md` for detailed documentation
2. Check `FIXTURE_LINEUP_EDIT_REQUIREMENTS.md` for requirements
3. Review audit logs in `lineup_audit_log` table
4. Check application logs for errors

---

**Status**: ✅ Ready for deployment
**Last Updated**: December 15, 2025
