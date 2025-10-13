const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkDuplicates(playerId, seasonId) {
  console.log(`\nChecking for duplicates: player=${playerId}, season=${seasonId || 'ALL'}\n`);
  
  try {
    let query = db.collection('realplayerstats').where('player_id', '==', playerId);
    
    if (seasonId) {
      query = query.where('season_id', '==', seasonId);
    }
    
    const snapshot = await query.get();
    
    console.log(`Found ${snapshot.size} documents\n`);
    
    const groupedBySeasonId = {};
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const key = `${data.player_id}-${data.season_id}`;
      
      if (!groupedBySeasonId[key]) {
        groupedBySeasonId[key] = [];
      }
      
      groupedBySeasonId[key].push({
        docId: doc.id,
        id: data.id,
        player_id: data.player_id,
        season_id: data.season_id,
        stats: data.stats ? 'nested' : 'flattened'
      });
    });
    
    console.log('Documents grouped by player_id-season_id:');
    for (const [key, docs] of Object.entries(groupedBySeasonId)) {
      console.log(`\n${key}: ${docs.length} document(s)`);
      docs.forEach((doc, idx) => {
        console.log(`  [${idx}] Firestore Doc ID: ${doc.docId}`);
        console.log(`      id field: ${doc.id}`);
        console.log(`      stats structure: ${doc.stats}`);
      });
      
      if (docs.length > 1) {
        console.log(`  ⚠️  DUPLICATE FOUND! ${docs.length} documents for the same player-season combo`);
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
  
  process.exit(0);
}

// Get command line args
const playerId = process.argv[2];
const seasonId = process.argv[3];

if (!playerId) {
  console.error('Usage: node check-duplicates.js <player_id> [season_id]');
  process.exit(1);
}

checkDuplicates(playerId, seasonId);
