# Migration Guide: Firestore → Neon for Football Players

## ✅ What's Been Created:

### API Routes (Server-side - Uses Neon):
- ✅ `GET /api/players` - Get all players with filters
- ✅ `GET /api/players/[id]` - Get single player
- ✅ `PATCH /api/players/[id]` - Update player
- ✅ `DELETE /api/players/[id]` - Delete player
- ✅ `GET /api/players/stats` - Get player statistics
- ✅ `POST /api/players/bulk` - Bulk operations (import, update eligibility, delete all)

---

## 📋 Pages That Need Updating:

### 1. **Player Selection Page**
**File:** `app/dashboard/committee/player-selection/page.tsx`

**Current:** Fetches from Firestore `footballplayers` collection  
**Change to:** Fetch from `/api/players`

```typescript
// OLD (Firestore):
const playersRef = collection(db, 'footballplayers')
const playersSnapshot = await getDocs(playersRef)

// NEW (Neon via API):
const response = await fetch('/api/players')
const { data: players } = await response.json()
```

### 2. **Committee Players Page**
**File:** `app/dashboard/committee/players/page.tsx`

**Current:** Fetches players and teams from Firestore  
**Change to:** Fetch players from `/api/players`, keep teams in Firestore

```typescript
// OLD:
const playersSnapshot = await getDocs(collection(db, 'footballplayers'))

// NEW:
const response = await fetch('/api/players')
const { data: players } = await response.json()
```

### 3. **Database Management Page**
**File:** `app/dashboard/committee/database/page.tsx`

**Current:** Direct Firestore operations  
**Change to:** Use API routes

```typescript
// Get player count
const response = await fetch('/api/players/stats')
const { data } = await response.json()
// data.total, data.byPosition

// Delete all players
await fetch('/api/players/bulk', {
  method: 'POST',
  body: JSON.stringify({ action: 'deleteAll' })
})

// Bulk import
await fetch('/api/players/bulk', {
  method: 'POST',
  body: JSON.stringify({ action: 'import', players: playersArray })
})
```

### 4. **Player Detail Page** (if exists)
**File:** `app/dashboard/committee/players/[id]/page.tsx`

```typescript
// OLD:
const playerDoc = await getDoc(doc(db, 'footballplayers', id))

// NEW:
const response = await fetch(`/api/players/${id}`)
const { data: player } = await response.json()
```

### 5. **Team Dashboard** (if shows players)
**File:** `app/dashboard/team/page.tsx`

Filter by team_id:
```typescript
const response = await fetch(`/api/players?team_id=${teamId}`)
const { data: players } = await response.json()
```

---

## 🔄 Common Patterns:

### Fetch All Players:
```typescript
const fetchPlayers = async () => {
  try {
    const response = await fetch('/api/players');
    const { data, success } = await response.json();
    if (success) {
      setPlayers(data);
    }
  } catch (error) {
    console.error('Error fetching players:', error);
  }
};
```

### Fetch with Filters:
```typescript
const params = new URLSearchParams({
  position: 'CF',
  is_auction_eligible: 'true',
  limit: '50'
});
const response = await fetch(`/api/players?${params}`);
```

### Update Player:
```typescript
await fetch(`/api/players/${playerId}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ is_auction_eligible: true })
});
```

### Bulk Update Eligibility:
```typescript
await fetch('/api/players/bulk', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'updateEligibility',
    playerIds: ['id1', 'id2', 'id3'],
    isEligible: true
  })
});
```

### Delete Player:
```typescript
await fetch(`/api/players/${playerId}`, {
  method: 'DELETE'
});
```

### Get Statistics:
```typescript
const response = await fetch('/api/players/stats');
const { data } = await response.json();
// data.total, data.byPosition
```

---

## 🚀 Step-by-Step Migration:

1. **Test API Routes:**
   ```bash
   # Start your dev server
   npm run dev
   
   # Test in browser or Postman:
   http://localhost:3000/api/players/stats
   ```

2. **Update One Page at a Time:**
   - Start with database management page
   - Then player selection
   - Then committee players
   - Test thoroughly after each change

3. **Keep Firestore for:**
   - ✅ Users
   - ✅ Teams
   - ✅ Seasons
   - ✅ Invites
   - ✅ Authentication

4. **Remove from Firestore (after testing):**
   - ❌ footballplayers collection (keep as backup for now)

---

## 💰 Cost Comparison:

### Before (Firestore Only):
- 2000 reads per page load × $0.06/100K = **$1.20 per 100 loads**
- Per auction event: **$60-120**

### After (Neon):
- Unlimited reads = **$0.00**
- Per auction event: **$0.00**

---

## 🛠️ Helper Function (Optional):

Create a `lib/api/players.ts` helper:
```typescript
export async function fetchPlayers(filters?: any) {
  const params = new URLSearchParams(filters);
  const response = await fetch(`/api/players?${params}`);
  const { data, success } = await response.json();
  if (!success) throw new Error('Failed to fetch players');
  return data;
}

export async function updatePlayerEligibility(id: string, isEligible: boolean) {
  const response = await fetch(`/api/players/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_auction_eligible: isEligible })
  });
  return response.json();
}
```

---

## ✅ Testing Checklist:

- [ ] API routes work (test in browser)
- [ ] Player selection page loads
- [ ] Can update player eligibility
- [ ] Bulk operations work
- [ ] Player statistics display correctly
- [ ] Filters work (position, team, etc.)
- [ ] Pagination works (if implemented)
- [ ] Delete operations work
- [ ] No Firestore errors in console

---

## 🆘 Troubleshooting:

### "NEON_DATABASE_URL is not set"
**Solution:** Check `.env.local` has the connection string

### "Failed to fetch"
**Solution:** Make sure dev server is running

### "Player not found"
**Solution:** Check if table has data, run migration if needed

### Type errors
**Solution:** Import types from `@/lib/neon/players`

---

**Ready to migrate? Start with testing the API routes first!**

Run: `npm run dev` and visit `http://localhost:3000/api/players/stats`
