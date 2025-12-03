# Add football_swap_count to team_seasons

## Purpose
Add tracking for football player swap counts to implement progressive fee system.

## Firestore Update

For each document in the `team_seasons` collection, add:

```javascript
{
  football_swap_count: 0  // Initialize to 0 for all teams
}
```

## Manual Update Script

Run this in Firebase Console or using Admin SDK:

```javascript
const admin = require('firebase-admin');
const db = admin.firestore();

async function addFootballSwapCount() {
  const batch = db.batch();
  const snapshot = await db.collection('team_seasons').get();
  
  let count = 0;
  snapshot.forEach(doc => {
    const data = doc.data();
    
    // Only add if field doesn't exist
    if (data.football_swap_count === undefined) {
      batch.update(doc.ref, {
        football_swap_count: 0
      });
      count++;
    }
  });
  
  await batch.commit();
  console.log(`Updated ${count} team_seasons documents with football_swap_count`);
}

addFootballSwapCount();
```

## Verification

Check a few team_seasons documents to ensure they have:
- `football_swap_count: 0`

## Notes

- This field tracks the number of football player swaps a team has made in a season
- Used to calculate progressive fees: 0/0/0/100/125 for swaps 1-5
- Resets each season (new team_seasons documents start at 0)
