# Firebase Cleanup Scripts

## Overview
Two scripts are available to clear your Firebase database while preserving the super admin account.

---

## 📊 Script Comparison

| Feature | clear-firebase-keep-superadmin.js | clear-firebase-efficient.js |
|---------|----------------------------------|----------------------------|
| **Speed** | Slower | ⚡ Much Faster |
| **Quota Usage** | Higher (reads all data) | 💰 **Lower** (minimal reads) |
| **Batch Size** | 250 docs | 100 docs (optimized) |
| **Progress Tracking** | Every 1000 docs | Every 500 docs |
| **Document Counting** | After deletion | **Before deletion** (cheaper) |
| **Data Fetching** | Full documents | **Only IDs** (cheaper) |
| **Super Admin Detection** | Full user data | **Only username field** |
| **Best For** | Small databases | **Large databases / quota limits** |

---

## 🚀 Usage

### Option 1: Standard Script (Original)
```bash
node "C:\Drive d\SS\nosqltest\nextjs-project\scripts\clear-firebase-keep-superadmin.js"
```

### Option 2: Efficient Script (RECOMMENDED for quota limits)
```bash
node "C:\Drive d\SS\nosqltest\nextjs-project\scripts\clear-firebase-efficient.js"
```

Both require typing `DELETE ALL` to confirm.

---

## 💡 Quota Optimization Techniques

### What Makes the Efficient Script Better?

#### 1. **Count API (Before Deletion)**
```javascript
// ❌ OLD: Reads all documents (expensive)
const snapshot = await db.collection('teams').get();
console.log(`Count: ${snapshot.size}`);

// ✅ NEW: Uses count aggregation (1 read only)
const count = await db.collection('teams').count().get();
console.log(`Count: ${count.data().count}`);
```
**Savings:** Instead of N reads (where N = number of docs), only 1 read!

#### 2. **Select() Query (Fetch Only IDs)**
```javascript
// ❌ OLD: Fetches full documents with all fields
const snapshot = await db.collection('teams').get();

// ✅ NEW: Fetches only document IDs (cheaper)
const snapshot = await db.collection('teams').select().get();
```
**Savings:** Reduces data transfer and quota consumption significantly.

#### 3. **Selective Field Fetching**
```javascript
// ❌ OLD: Fetch entire user document
const users = await db.collection('users')
  .where('role', '==', 'super_admin')
  .get();

// ✅ NEW: Fetch only the username field
const users = await db.collection('users')
  .where('role', '==', 'super_admin')
  .select('username')
  .get();
```
**Savings:** Only reads the fields you need.

#### 4. **Smaller Batch Sizes with Delays**
```javascript
// Smaller batches = less memory, better rate limiting
const batchSize = 100; // vs 250 or 500

// Small delay between batches
await new Promise(resolve => setTimeout(resolve, 50));
```
**Benefit:** Avoids overwhelming Firestore and hitting rate limits.

---

## 📝 Collections Deleted

Both scripts delete the following collections:

1. ✅ `seasons` - All season data
2. ✅ `teams` - Team permanent data
3. ✅ `teamstats` - Team season statistics (NEW)
4. ✅ `realplayers` - Player permanent data
5. ✅ `realplayerstats` - Player season statistics
6. ✅ `bids` - Auction bids
7. ✅ `matches` - Match records
8. ✅ `invites` - Team invitations
9. ✅ `awards` - Awards and trophies (NEW)
10. ✅ `footballPlayers` - Football player database

Also deletes:
- All Firebase Auth users (except super admin)
- All Firestore user documents (except super admin)
- All username entries (except super admin)

---

## 🔒 What's Preserved

Both scripts preserve:
- ✅ Super admin user document
- ✅ Super admin Firebase Auth account
- ✅ Super admin username entry

The super admin can still log in after cleanup!

---

## 📊 Quota Usage Estimate

### For a database with 1000 documents:

**Standard Script:**
- Reads: ~1000 (fetching documents)
- Deletes: ~1000
- **Total operations: ~2000**

**Efficient Script:**
- Reads: ~110 (10 counts + 100 IDs)
- Deletes: ~1000
- **Total operations: ~1110**

**Savings: ~45% reduction in quota usage!**

---

## ⚠️ Important Notes

### Firestore Free Tier Quotas (Daily)
- **Reads:** 50,000
- **Writes:** 20,000
- **Deletes:** 20,000

### Tips to Avoid Quota Issues:
1. **Use the efficient script** if you have large collections
2. **Don't run multiple times per day** - plan your testing
3. **Consider using Firebase Emulator** for frequent testing
4. **Export data before cleanup** if you might need it later

### Emergency: Exceeded Quota?
If you exceed your daily quota:
- Wait until the next day (resets at midnight Pacific Time)
- OR upgrade to Blaze plan (pay-as-you-go)
- OR use Firebase Emulator for development

---

## 🧪 Alternative: Use Firebase Emulator

For **unlimited** testing without quota limits:

```bash
# Start emulator
firebase emulators:start

# Update .env.local to use emulator
FIREBASE_USE_EMULATOR=true
FIRESTORE_EMULATOR_HOST=localhost:8080
```

Then your app will use the emulator instead of production Firebase, giving you unlimited quota for testing!

---

## 🔧 Troubleshooting

### Script fails with "Permission denied"
- Check your Firebase Admin credentials in `.env.local`
- Ensure your service account has proper permissions

### "Cannot find module" error
```bash
npm install firebase-admin dotenv readline
```

### Quota exceeded during cleanup
- Wait until next day
- Use the efficient script instead
- Consider Firebase Emulator for testing

---

## 📚 References

- [Firestore Quotas & Limits](https://firebase.google.com/docs/firestore/quotas)
- [Firestore Count Aggregation](https://firebase.google.com/docs/firestore/query-data/aggregation-queries)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)
- [Firebase Emulator Suite](https://firebase.google.com/docs/emulator-suite)
