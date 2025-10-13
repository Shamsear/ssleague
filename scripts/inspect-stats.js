const admin = require('firebase-admin');
const path = require('path');

if (!admin.apps.length) {
  const serviceAccountPath = path.join(__dirname, '..', 'serviceAccountKey.json');
  admin.initializeApp({
    credential: admin.credential.cert(require(serviceAccountPath))
  });
}

const db = admin.firestore();

async function inspectStats() {
  try {
    // Get a few documents to inspect
    const snapshot = await db.collection('realplayerstats')
      .limit(5)
      .get();
    
    console.log(`Found ${snapshot.size} documents\n`);
    
    snapshot.forEach(doc => {
      const data = doc.data();
      console.log('Document ID:', doc.id);
      console.log('Fields:');
      console.log('  - id:', data.id);
      console.log('  - player_id:', data.player_id);
      console.log('  - player_name:', data.player_name);
      console.log('  - season_id:', data.season_id);
      console.log('  - team:', data.team);
      console.log('  - category:', data.category);
      console.log('  - has stats object:', !!data.stats);
      console.log('  - matches_played:', data.matches_played || data.stats?.matches_played);
      console.log('---\n');
    });
    
  } catch (error) {
    console.error('Error:', error);
  }
  
  process.exit(0);
}

inspectStats();
