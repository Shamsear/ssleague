const admin = require('firebase-admin');
require('dotenv').config({ path: '.env.local' });

// Initialize Firebase Admin
if (!admin.apps.length) {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
  
  if (process.env.FIREBASE_ADMIN_PROJECT_ID && process.env.FIREBASE_ADMIN_CLIENT_EMAIL && process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
      databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || `https://${process.env.FIREBASE_ADMIN_PROJECT_ID}-default-rtdb.firebaseio.com`,
    });
  } else if (projectId) {
    admin.initializeApp({
      projectId: projectId,
      databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || `https://${projectId}-default-rtdb.firebaseio.com`,
    });
  } else {
    admin.initializeApp();
  }
}

const db = admin.firestore();

async function updateClassicTensSeasons() {
  try {
    console.log('🔍 Finding Classic Tens seasons from teamstats...\n');

    // Find all teamstats for Classic Tens (SSPSLT0001)
    const teamstatsSnapshot = await db.collection('teamstats')
      .where('team_id', '==', 'SSPSLT0001')
      .get();

    if (teamstatsSnapshot.empty) {
      console.log('⚠️  No teamstats found for Classic Tens');
      console.log('   Checking by team name...\n');
      
      // Try finding by team name
      const teamstatsByName = await db.collection('teamstats')
        .where('team_name', '==', 'Classic Tens')
        .get();
      
      if (teamstatsByName.empty) {
        console.log('❌ No teamstats found for Classic Tens by name either');
        console.log('   Keeping current seasons: [SSPSLS15]');
        return;
      }
      
      const seasons = teamstatsByName.docs.map(doc => doc.data().season_id).sort();
      console.log(`✅ Found ${seasons.length} seasons by team name:`);
      console.log(`   Seasons: [${seasons.join(', ')}]\n`);
      
      await updateTeamSeasons(seasons);
    } else {
      const seasons = teamstatsSnapshot.docs.map(doc => doc.data().season_id).sort();
      console.log(`✅ Found ${seasons.length} seasons from teamstats:`);
      console.log(`   Seasons: [${seasons.join(', ')}]\n`);
      
      await updateTeamSeasons(seasons);
    }

  } catch (error) {
    console.error('❌ Error updating Classic Tens seasons:', error);
    throw error;
  }
}

async function updateTeamSeasons(seasons) {
  console.log('🔄 Updating Classic Tens team document...');
  
  const uniqueSeasons = [...new Set(seasons)].sort();
  
  await db.collection('teams').doc('SSPSLT0001').update({
    seasons: uniqueSeasons,
    total_seasons_participated: uniqueSeasons.length,
    current_season_id: uniqueSeasons[uniqueSeasons.length - 1],
    updated_at: admin.firestore.FieldValue.serverTimestamp()
  });

  console.log(`✅ Updated Classic Tens:`);
  console.log(`   Seasons: [${uniqueSeasons.join(', ')}]`);
  console.log(`   Total: ${uniqueSeasons.length}`);
  console.log(`   Current: ${uniqueSeasons[uniqueSeasons.length - 1]}\n`);
}

// Run the update
updateClassicTensSeasons()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
