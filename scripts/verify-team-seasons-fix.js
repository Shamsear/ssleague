/**
 * Verify Team Seasons Fix
 * Check both Kopites and TM Asgardians S17 documents
 */

require('dotenv').config({ path: '.env.local' });

const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  if (process.env.FIREBASE_ADMIN_PROJECT_ID && process.env.FIREBASE_ADMIN_CLIENT_EMAIL && process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n')
      })
    });
  } else {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
    admin.initializeApp({ projectId });
  }
}

const db = admin.firestore();

async function verifyTeamSeasons() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║         VERIFY TEAM SEASONS DOCUMENTS                     ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  try {
    // Check Kopites S17
    console.log('1️⃣  KOPITES S17 DOCUMENT\n');
    
    const kopitesDoc = await db.collection('team_seasons')
      .doc('SSPSLT0023_SSPSLS17')
      .get();

    if (kopitesDoc.exists) {
      const data = kopitesDoc.data();
      console.log(`   Document ID: ${kopitesDoc.id}`);
      console.log(`   Team ID: ${data.team_id}`);
      console.log(`   Team Name: ${data.team_name}`);
      console.log(`   Season: ${data.season_id}`);
      console.log(`   Football Budget: ${data.football_budget} eCoin`);
      console.log(`   Real Player Budget: ${data.real_player_budget} SSCoin`);
      
      if (data.team_id === 'SSPSLT0023' && data.team_name === 'Kopites') {
        console.log('   ✅ Correctly set to Kopites\n');
      } else {
        console.log('   ❌ Still showing wrong team!\n');
      }
    } else {
      console.log('   ❌ Document not found!\n');
    }

    // Check TM Asgardians S17
    console.log('2️⃣  TM ASGARDIANS S17 DOCUMENT\n');
    
    const asgardiansDoc = await db.collection('team_seasons')
      .doc('SSPSLT0005_SSPSLS17')
      .get();

    if (asgardiansDoc.exists) {
      const data = asgardiansDoc.data();
      console.log(`   Document ID: ${asgardiansDoc.id}`);
      console.log(`   Team ID: ${data.team_id}`);
      console.log(`   Team Name: ${data.team_name}`);
      console.log(`   Season: ${data.season_id}`);
      console.log(`   Football Budget: ${data.football_budget} eCoin`);
      console.log(`   Real Player Budget: ${data.real_player_budget} SSCoin`);
      
      if (data.team_id === 'SSPSLT0005' && data.team_name === 'TM Asgardians') {
        console.log('   ✅ Correctly set to TM Asgardians\n');
      } else {
        console.log('   ❌ Wrong team data!\n');
      }
    } else {
      console.log('   ❌ Document not found!\n');
    }

    // Check for any other S17 documents
    console.log('3️⃣  ALL S17 TEAM SEASONS\n');
    
    const allS17 = await db.collection('team_seasons')
      .where('season_id', '==', 'SSPSLS17')
      .get();

    console.log(`   Found ${allS17.size} S17 documents:\n`);
    
    allS17.forEach(doc => {
      const data = doc.data();
      console.log(`   - ${data.team_name} (${data.team_id}): ${data.football_budget} eCoin`);
    });

    console.log('\n✅ Verification complete!\n');

  } catch (error) {
    console.error('\n❌ Error during verification:', error);
    throw error;
  }
}

verifyTeamSeasons()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
