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

async function updateTeamSeasons() {
  try {
    console.log('🔄 Updating team_seasons documents for Los Blancos...\n');

    const oldDocs = [
      'SSPSLT0001_SSPSLS16',
      'SSPSLT0001_SSPSLS17'
    ];

    const newTeamId = 'SSPSLT0034';

    for (const oldDocId of oldDocs) {
      console.log(`📋 Processing ${oldDocId}...`);
      
      // Get the old document
      const oldDocRef = db.collection('team_seasons').doc(oldDocId);
      const oldDoc = await oldDocRef.get();

      if (!oldDoc.exists) {
        console.log(`   ⚠️  Document not found, skipping\n`);
        continue;
      }

      const oldData = oldDoc.data();
      const seasonId = oldDocId.split('_')[1];
      const newDocId = `${newTeamId}_${seasonId}`;

      console.log(`   Old: ${oldDocId}`);
      console.log(`   New: ${newDocId}`);

      // Create new document with updated team_id
      const newDocRef = db.collection('team_seasons').doc(newDocId);
      await newDocRef.set({
        ...oldData,
        team_id: newTeamId,
        team_uid: newTeamId, // Update this too if it exists
        updated_at: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log(`   ✅ Created new document`);

      // Delete old document
      await oldDocRef.delete();
      console.log(`   ✅ Deleted old document\n`);
    }

    console.log('════════════════════════════════════════════════');
    console.log('✅ All team_seasons documents updated!');
    console.log('════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('❌ Error updating team_seasons:', error);
    throw error;
  }
}

// Run the update
updateTeamSeasons()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
