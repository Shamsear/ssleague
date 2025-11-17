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

async function fixDuplicateSeasons() {
  try {
    console.log('Starting duplicate seasons fix...\n');

    // Get all teams
    const teamsSnapshot = await db.collection('teams').get();
    
    let teamsFixed = 0;
    let teamsChecked = 0;

    for (const doc of teamsSnapshot.docs) {
      const teamData = doc.data();
      teamsChecked++;

      if (!teamData.seasons || !Array.isArray(teamData.seasons)) {
        console.log(`⚠️  Team ${doc.id} (${teamData.team_name}) has no seasons array`);
        continue;
      }

      // Remove duplicates while preserving order
      const uniqueSeasons = [...new Set(teamData.seasons)];
      const hasDuplicates = uniqueSeasons.length !== teamData.seasons.length;

      if (hasDuplicates) {
        console.log(`\n🔧 Fixing: ${teamData.team_name} (${doc.id})`);
        console.log(`   Before: seasons = [${teamData.seasons.join(', ')}]`);
        console.log(`   Before: total_seasons_participated = ${teamData.total_seasons_participated}`);
        console.log(`   After:  seasons = [${uniqueSeasons.join(', ')}]`);
        console.log(`   After:  total_seasons_participated = ${uniqueSeasons.length}`);

        // Update the document
        await doc.ref.update({
          seasons: uniqueSeasons,
          total_seasons_participated: uniqueSeasons.length,
          updated_at: admin.firestore.FieldValue.serverTimestamp()
        });

        teamsFixed++;
        console.log('   ✅ Fixed!');
      } else {
        // Check if total_seasons_participated is correct
        if (teamData.total_seasons_participated !== uniqueSeasons.length) {
          console.log(`\n🔧 Fixing count: ${teamData.team_name} (${doc.id})`);
          console.log(`   Seasons count: ${uniqueSeasons.length}`);
          console.log(`   Stored total: ${teamData.total_seasons_participated}`);
          
          await doc.ref.update({
            total_seasons_participated: uniqueSeasons.length,
            updated_at: admin.firestore.FieldValue.serverTimestamp()
          });

          teamsFixed++;
          console.log('   ✅ Fixed count!');
        }
      }
    }

    console.log(`\n${'='.repeat(50)}`);
    console.log(`✅ Complete!`);
    console.log(`   Teams checked: ${teamsChecked}`);
    console.log(`   Teams fixed: ${teamsFixed}`);
    console.log(`${'='.repeat(50)}\n`);

  } catch (error) {
    console.error('❌ Error fixing duplicate seasons:', error);
    throw error;
  }
}

// Run the fix
fixDuplicateSeasons()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });
