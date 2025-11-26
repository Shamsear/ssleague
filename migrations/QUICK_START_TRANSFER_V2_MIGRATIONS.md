# Quick Start: Transfer V2 Migrations

## TL;DR - Run These Commands

### 1. Neon Database Migration

```bash
# Copy and paste the SQL into Neon SQL Editor, or:
psql $NEON_DATABASE_URL -f migrations/add_transfer_v2_fields.sql

# Test it
node migrations/test_transfer_v2_migration.js
```

### 2. Firebase Migration

```bash
# Run migration
npx ts-node scripts/init-transfer-v2-firebase.ts

# Deploy indexes
firebase deploy --only firestore:indexes

# Test it
npx ts-node scripts/test-transfer-v2-firebase.ts
```

## What Gets Added

### Neon (footballplayers table)
- `star_rating` (3-10, default: 5)
- `points` (default: 180)
- `salary_per_match` (default: 0.00)
- `transfer_count` (default: 0)
- 5 new indexes

### Firebase (team_seasons collection)
- `transfer_count` (default: 0) on all documents
- 6 new indexes for player_transactions queries

## Expected Time
- Neon: < 1 minute
- Firebase: 2-5 minutes (depends on document count)
- Index building: 5-30 minutes (background process)

## Verification

### Neon
```sql
SELECT star_rating, points, salary_per_match, transfer_count 
FROM footballplayers 
LIMIT 5;
```

### Firebase
Check any team_seasons document - should have `transfer_count: 0`

## Rollback

### Neon
```sql
ALTER TABLE footballplayers 
DROP COLUMN star_rating, 
DROP COLUMN points, 
DROP COLUMN salary_per_match, 
DROP COLUMN transfer_count;
```

### Firebase
```typescript
// Use the rollback script in FIREBASE_TRANSFER_V2_MIGRATION_README.md
```

## Need Help?

- Neon issues: See `migrations/TRANSFER_V2_MIGRATION_README.md`
- Firebase issues: See `migrations/FIREBASE_TRANSFER_V2_MIGRATION_README.md`
- Full details: See `migrations/TRANSFER_V2_MIGRATION_SUMMARY.md`

## Files Reference

| File | Purpose |
|------|---------|
| `migrations/add_transfer_v2_fields.sql` | Neon migration SQL |
| `migrations/test_transfer_v2_migration.js` | Neon test script |
| `scripts/init-transfer-v2-firebase.ts` | Firebase migration |
| `scripts/test-transfer-v2-firebase.ts` | Firebase test script |
| `migrations/firestore_indexes_transfer_v2.json` | Index config |

## Common Issues

**"Column already exists"** → Safe to ignore, migration is idempotent

**"Index already exists"** → Safe to ignore, indexes won't be duplicated

**"Service account key not found"** → Check `.env.local` has `FIREBASE_SERVICE_ACCOUNT_KEY`

**"Permission denied"** → Ensure database user has ALTER TABLE permissions

**Test fails** → Run migration first, then test

## Success Indicators

✅ Neon test shows: "🎉 All migration tests passed!"
✅ Firebase test shows: "🎉 All tests passed!"
✅ No errors in migration output
✅ Verification queries return expected data

## Next Steps After Migration

1. Update TypeScript interfaces with new fields
2. Implement transfer calculation functions
3. Create API endpoints
4. Build UI components

---

**Ready to go?** Start with the Neon migration, then Firebase, then run the tests!
