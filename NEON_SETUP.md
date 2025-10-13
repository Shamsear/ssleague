# Neon Database Setup for Football Players

This guide will help you migrate `footballplayers` from Firestore to Neon PostgreSQL to eliminate read/write costs.

## 📊 Why Neon?

- **Cost:** ~$0/month for hobby tier vs $60-120/auction in Firestore
- **Speed:** Faster queries for 2000+ players
- **Reliability:** Better for concurrent writes during live auctions
- **No read limits:** Unlimited reads without charges

---

## 🚀 Setup Steps

### 1. Create Neon Account

1. Go to https://neon.tech
2. Sign up for free account
3. Create a new project named "football-auction"
4. Copy your connection string

### 2. Add Environment Variable

Add to `.env.local`:

```bash
NEON_DATABASE_URL="postgresql://user:password@ep-xxxx.us-east-2.aws.neon.tech/neondb?sslmode=require"
```

### 3. Install Dependencies

Already installed:
```bash
npm install @neondatabase/serverless
```

### 4. Run Migration

```bash
# Install tsx if not already installed
npm install -D tsx

# Run migration script
npx tsx scripts/migrate-to-neon.ts
```

This will:
- ✅ Create `footballplayers` table in Neon
- ✅ Create all necessary indexes
- ✅ Migrate all players from Firestore
- ✅ Verify data integrity

### 5. Update Your Code

The following functions are now available in `lib/neon/players.ts`:

```typescript
import { 
  getAllPlayers,
  getPlayerById,
  updatePlayer,
  updatePlayerEligibility,
  bulkUpdateEligibility,
  deletePlayer,
  searchPlayers,
  getTotalPlayerCount
} from '@/lib/neon/players';

// Example usage
const players = await getAllPlayers({ 
  is_auction_eligible: true,
  limit: 50 
});
```

---

## 🔄 Migration Impact

### Before (Firestore):
- 2000 reads per page load
- $0.06 per 100K reads
- **Cost:** ~$1.20 per 100 page loads

### After (Neon):
- Unlimited reads
- $0/month (hobby tier)
- **Cost:** $0 🎉

### During Auction:
- Before: 2M reads × $0.06/100K = **$120**
- After: Unlimited = **$0**

---

## 📝 API Routes to Update

You'll need to create API routes for server-side access:

### Example: Get all players
`app/api/players/route.ts`:
```typescript
import { getAllPlayers } from '@/lib/neon/players';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const position = searchParams.get('position');
  
  const players = await getAllPlayers({ 
    position: position || undefined,
    limit: 100 
  });
  
  return Response.json(players);
}
```

---

## ✅ Testing

1. **Verify migration:**
   ```bash
   npx tsx scripts/migrate-to-neon.ts
   ```

2. **Test connection:**
   ```typescript
   import { testNeonConnection } from '@/lib/neon/config';
   await testNeonConnection();
   ```

3. **Query players:**
   ```typescript
   import { getAllPlayers } from '@/lib/neon/players';
   const players = await getAllPlayers({ limit: 10 });
   console.log(players);
   ```

---

## 🗑️ Cleanup (After Testing)

Once you've verified everything works:

1. Keep Firestore for: users, teams, seasons, invites
2. Delete `footballplayers` collection from Firestore (optional)
3. Save ~$100+ per month on Firestore costs

---

## 🔧 Troubleshooting

### Connection Error
```bash
Error: NEON_DATABASE_URL environment variable is not set
```
**Solution:** Add connection string to `.env.local`

### Migration Fails
```bash
Error: relation "footballplayers" already exists
```
**Solution:** Table already created, skip to data import step

### Type Errors
Make sure to import types:
```typescript
import type { FootballPlayer } from '@/lib/neon/players';
```

---

## 📚 Resources

- Neon Docs: https://neon.tech/docs
- Neon Serverless Driver: https://github.com/neondatabase/serverless
- Migration Guide: This file!

---

## 🎯 Next Steps

1. Run migration script
2. Create API routes for player operations  
3. Update frontend to call API routes
4. Test thoroughly
5. Deploy to production
6. Monitor costs (should be $0!)

**Ready to migrate? Run:** `npx tsx scripts/migrate-to-neon.ts`
