/**
 * Recreate Kopites S17 Document
 * 
 * The document was accidentally deleted. We need to recreate it
 * with the original budgets (1543 eCoin, 542.04 SSCoin)
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

const DRY_RUN = false; // Set to false to execute

async function recreateKopitesDoc() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║         RECREATE KOPITES S17 DOCUMENT                     ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  if (DRY_RUN) {
    console.log('⚠️  DRY RUN MODE - No changes will be made\n');
  } else {
    console.log('🚨 LIVE MODE - Changes will be applied!\n');
  }

  try {
    // Check if document already exists
    const existingDoc = await db.collection('team_seasons')
      .doc('SSPSLT0023_SSPSLS17')
      .get();

    if (existingDoc.exists) {
      console.log('✅ Document already exists!\n');
      const data = existingDoc.data();
      console.log(`   Team: ${data.team_name} (${data.team_id})`);
      console.log(`   Season: ${data.season_id}`);
      console.log(`   Football Budget: ${data.football_budget} eCoin`);
      console.log(`   Real Player Budget: ${data.real_player_budget} SSCoin\n`);
      return;
    }

    // Create Kopites S17 document
    console.log('Creating Kopites S17 document...\n');

    const docId = 'SSPSLT0023_SSPSLS17';
    const docData = {
      team_id: 'SSPSLT0023',
      team_name: 'Kopites',
      season_id: 'SSPSLS17',
      football_budget: 1543,
      real_player_budget: 542.04,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    };

    console.log('Document details:');
    console.log(`  ID: ${docId}`);
    console.log(`  Team: ${docData.team_name} (${docData.team_id})`);
    console.log(`  Season: ${docData.season_id}`);
    console.log(`  Football budget: ${docData.football_budget} eCoin`);
    console.log(`  Real player budget: ${docData.real_player_budget} SSCoin\n`);

    if (!DRY_RUN) {
      await db.collection('team_seasons').doc(docId).set(docData);
      console.log('✅ Created Kopites S17 document\n');
    } else {
      console.log('📝 Would create document\n');
    }

    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('✅ Kopites S17 document recreated!\n');

    if (DRY_RUN) {
      console.log('⚠️  This was a DRY RUN - no changes were made');
      console.log('Set DRY_RUN = false to execute\n');
    }

  } catch (error) {
    console.error('\n❌ Error during recreation:', error);
    throw error;
  }
}

recreateKopitesDoc()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
