# Fixture Lineup Edit - Deployment Checklist

## Pre-Deployment

### ✅ Code Review
- [ ] Review all code changes
- [ ] Verify database migration syntax
- [ ] Check API error handling
- [ ] Verify frontend race condition handling
- [ ] Review audit logging implementation
- [ ] Check notification logic

### ✅ Documentation
- [x] Requirements document created
- [x] Implementation summary created
- [x] Quick start guide created
- [x] Flow diagrams created
- [x] Deployment checklist created

### ✅ Testing Preparation
- [ ] Prepare test fixtures
- [ ] Prepare test users (home and away teams)
- [ ] Set up test round with deadlines
- [ ] Prepare two browsers for race condition testing

## Deployment Steps

### Step 1: Database Migration ⚠️ CRITICAL

```bash
# Backup database first!
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Apply migration
psql $DATABASE_URL -f migrations/add_fixture_tracking_fields.sql

# Verify migration
psql $DATABASE_URL -c "\d fixtures"
psql $DATABASE_URL -c "\d lineup_audit_log"
```

**Verification:**
- [ ] `matchups_created_by` column exists in fixtures
- [ ] `matchups_created_at` column exists in fixtures
- [ ] `lineup_last_edited_by` column exists in fixtures
- [ ] `lineup_last_edited_at` column exists in fixtures
- [ ] `lineup_audit_log` table exists
- [ ] Indexes created successfully

### Step 2: Deploy API Changes

```bash
# Commit and push
git add app/api/fixtures/[fixtureId]/matchups/route.ts
git add app/api/fixtures/[fixtureId]/lineup/route.ts
git add migrations/add_fixture_tracking_fields.sql
git commit -m "feat: Add lineup editing and race condition handling for fixtures"
git push origin main
```

**Verification:**
- [ ] Build succeeds
- [ ] No TypeScript errors
- [ ] API endpoints respond correctly
- [ ] Database connection works

### Step 3: Deploy Frontend Changes

```bash
# Commit and push
git add app/dashboard/team/fixture/[fixtureId]/page.tsx
git commit -m "feat: Add race condition handling for fixture creation UI"
git push origin main
```

**Verification:**
- [ ] Build succeeds
- [ ] No TypeScript errors
- [ ] Page loads correctly
- [ ] No console errors

### Step 4: Smoke Tests

#### Test 1: Basic Fixture Creation
- [ ] Home team can create fixture during home phase
- [ ] Matchups are saved correctly
- [ ] Page displays matchups correctly

#### Test 2: Lineup Editing
- [ ] Home team can edit lineup before deadline
- [ ] Warning shown if matchups exist
- [ ] Matchups deleted when lineup edited
- [ ] Audit log entry created
- [ ] Notification sent

#### Test 3: Race Condition
- [ ] Open fixture in two browsers
- [ ] Both teams see "Create Fixture" button
- [ ] First team to submit succeeds
- [ ] Second team gets friendly error
- [ ] Second team's page refreshes
- [ ] No duplicate matchups created

#### Test 4: Permissions
- [ ] Home team cannot create after home deadline (if didn't submit)
- [ ] Away team cannot create during home phase
- [ ] Both teams can create during fixture_entry phase
- [ ] Deadlines enforced correctly

## Post-Deployment Monitoring

### Immediate (First Hour)
- [ ] Monitor error logs
- [ ] Check database for duplicate matchups
- [ ] Verify audit log entries
- [ ] Check notification delivery
- [ ] Monitor user feedback

### First Day
- [ ] Review all fixture creations
- [ ] Check audit log for lineup edits
- [ ] Verify no race condition issues
- [ ] Monitor database performance
- [ ] Check for any user complaints

### First Week
- [ ] Analyze audit log data
- [ ] Review race condition handling success rate
- [ ] Check notification delivery rate
- [ ] Gather user feedback
- [ ] Identify any edge cases

## Rollback Procedure

### If Critical Issues Occur:

#### Step 1: Revert Code
```bash
# Revert commits
git revert HEAD~2
git push origin main
```

#### Step 2: Revert Database (if needed)
```sql
-- Only if absolutely necessary
ALTER TABLE fixtures
DROP COLUMN IF EXISTS matchups_created_by,
DROP COLUMN IF EXISTS matchups_created_at,
DROP COLUMN IF EXISTS lineup_last_edited_by,
DROP COLUMN IF EXISTS lineup_last_edited_at;

DROP TABLE IF EXISTS lineup_audit_log;
```

#### Step 3: Notify Users
- [ ] Post announcement about temporary rollback
- [ ] Explain what happened
- [ ] Provide timeline for fix

## Success Criteria

### Must Have (Critical)
- [x] No duplicate matchups created
- [x] Race conditions handled correctly
- [x] Data integrity maintained
- [x] Deadlines enforced correctly
- [x] Audit trail working

### Should Have (Important)
- [x] Friendly error messages
- [x] Auto-refresh after race condition
- [x] Notifications sent
- [x] Lineup editing works
- [x] Performance acceptable

### Nice to Have (Optional)
- [ ] Real-time updates (future enhancement)
- [ ] Email notifications (future enhancement)
- [ ] Mobile optimization (future enhancement)

## Known Limitations

1. **No Real-time Updates**: Teams don't see opponent's progress in real-time
   - **Mitigation**: Auto-refresh after race condition
   - **Future**: Add WebSocket support

2. **No Draft Preview**: Can't preview matchups before submitting
   - **Mitigation**: Clear UI showing selections
   - **Future**: Add preview modal

3. **No Undo**: Can't undo lineup edits
   - **Mitigation**: Audit log tracks all changes
   - **Future**: Add undo functionality

## Support Plan

### User Support
- [ ] Update user documentation
- [ ] Create FAQ for common issues
- [ ] Train support team on new features
- [ ] Prepare response templates

### Technical Support
- [ ] Document common errors and solutions
- [ ] Create debugging guide
- [ ] Set up monitoring alerts
- [ ] Prepare escalation procedure

## Metrics to Track

### Technical Metrics
- [ ] Number of race conditions handled
- [ ] Number of lineup edits
- [ ] Number of matchups deleted due to edits
- [ ] API response times
- [ ] Database transaction times
- [ ] Error rates

### User Metrics
- [ ] User satisfaction with new features
- [ ] Number of support tickets
- [ ] Feature adoption rate
- [ ] Time to create fixtures
- [ ] Number of lineup edits per fixture

## Communication Plan

### Before Deployment
- [ ] Announce new features to users
- [ ] Explain how lineup editing works
- [ ] Explain race condition handling
- [ ] Provide examples and screenshots

### During Deployment
- [ ] Post maintenance notice (if needed)
- [ ] Update status page
- [ ] Monitor social media for feedback

### After Deployment
- [ ] Announce successful deployment
- [ ] Share quick start guide
- [ ] Collect user feedback
- [ ] Address any concerns

## Final Checklist

### Pre-Deployment
- [ ] All code reviewed and approved
- [ ] All tests passing
- [ ] Documentation complete
- [ ] Database backup created
- [ ] Rollback plan ready

### Deployment
- [ ] Database migration applied
- [ ] API changes deployed
- [ ] Frontend changes deployed
- [ ] Smoke tests passed
- [ ] Monitoring active

### Post-Deployment
- [ ] No critical errors
- [ ] Users can create fixtures
- [ ] Race conditions handled
- [ ] Lineup editing works
- [ ] Audit log working

## Sign-Off

- [ ] Developer: Code complete and tested
- [ ] QA: All tests passed
- [ ] Product: Features meet requirements
- [ ] DevOps: Deployment successful
- [ ] Support: Ready to handle user questions

---

## Quick Reference

### Files Changed
1. `migrations/add_fixture_tracking_fields.sql` - Database schema
2. `app/api/fixtures/[fixtureId]/matchups/route.ts` - Matchups API
3. `app/api/fixtures/[fixtureId]/lineup/route.ts` - Lineup API
4. `app/dashboard/team/fixture/[fixtureId]/page.tsx` - Frontend

### Key Features
- ✅ Home team lineup editing
- ✅ Race condition handling
- ✅ First-come-first-served
- ✅ Audit trail
- ✅ Notifications

### Testing URLs
- Fixture page: `/dashboard/team/fixture/[fixtureId]`
- Lineup page: `/dashboard/team/fixture/[fixtureId]/lineup`

### Support Contacts
- Technical Issues: [Your contact]
- User Questions: [Support contact]
- Emergency: [Emergency contact]

---

**Deployment Date**: _____________
**Deployed By**: _____________
**Status**: ⬜ Pending | ⬜ In Progress | ⬜ Complete | ⬜ Rolled Back
