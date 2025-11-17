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

async function fixClassicTensSeasons() {
  try {
    console.log('🔄 Updating Classic Tens seasons...\n');

    // Classic Tens participated in S11, S12, S13, and S15
    const seasons = ['SSPSLS11', 'SSPSLS12', 'SSPSLS13', 'SSPSLS15'];

    console.log(`📊 Setting seasons: [${seasons.join(', ')}]`);
    console.log(`   Total seasons: ${seasons.length}\n`);

    await db.collection('teams').doc('SSPSLT0001').update({
      seasons: seasons,
      total_seasons_participated: seasons.length,
      current_season_id: 'SSPSLS15',
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log('✅ Classic Tens updated successfully!');
    console.log(`   Seasons: [${seasons.join(', ')}]`);
    console.log(`   Total: ${seasons.length}`);
    console.log(`   Current: SSPSLS15\n`);

  } catch (error) {
    console.error('❌ Error updating Classic Tens:', error);
    throw error;
  }
}

// Run the update
fixClassicTensSeasons()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
