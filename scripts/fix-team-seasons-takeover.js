/**
 * Fix Team Seasons for Takeover
 * 
 * The takeover should:
 * 1. Keep Kopites S17 document unchanged (revert team_id/team_name back)
 * 2. Create NEW TM Asgardians S17 document with same budgets
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

async function fixTeamSeasons() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║           FIX TEAM SEASONS FOR TAKEOVER                   ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  if (DRY_RUN) {
    console.log('⚠️  DRY RUN MODE - No changes will be made\n');
  } else {
    console.log('🚨 LIVE MODE - Changes will be applied!\n');
  }

  try {
    // Step 1: Find the modified document
    console.log('STEP 1: Find modified Kopites S17 document\n');
    
    const modifiedDoc = await db.collection('team_seasons')
      .where('team_id', '==', 'SSPSLT0005')
      .where('season_id', '==', 'SSPSLS17')
      .get();

    if (modifiedDoc.size === 0) {
      console.log('❌ No modified document found. Already fixed?\n');
      return;
    }

    const doc = modifiedDoc.docs[0];
    const data = doc.data();
    
    console.log(`Found document: ${doc.id}`);
    console.log(`Current team_id: ${data.team_id}`);
    console.log(`Current team_name: ${data.team_name}`);
    console.log(`Football budget: ${data.football_budget} eCoin`);
    console.log(`Real player budget: ${data.real_player_budget} SSCoin\n`);

    // Step 2: Revert the document back to Kopites
    console.log('STEP 2: Revert document back to Kopites\n');

    if (!DRY_RUN) {
      await doc.ref.update({
        team_id: 'SSPSLT0023',
        team_name: 'Kopites'
      });
      console.log('✅ Reverted document to Kopites\n');
    } else {
      console.log('📝 Would revert team_id to SSPSLT0023 and team_name to Kopites\n');
    }

    // Step 3: Create new TM Asgardians S17 document
    console.log('STEP 3: Create new TM Asgardians S17 document\n');

    const newDocId = 'SSPSLT0005_SSPSLS17';
    const newDocData = {
      team_id: 'SSPSLT0005',
      team_name: 'TM Asgardians',
      season_id: 'SSPSLS17',
      football_budget: data.football_budget,
      real_player_budget: data.real_player_budget,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    };

    console.log('New document details:');
    console.log(`  ID: ${newDocId}`);
    console.log(`  Team: ${newDocData.team_name} (${newDocData.team_id})`);
    console.log(`  Season: ${newDocData.season_id}`);
    console.log(`  Football budget: ${newDocData.football_budget} eCoin`);
    console.log(`  Real player budget: ${newDocData.real_player_budget} SSCoin\n`);

    if (!DRY_RUN) {
      await db.collection('team_seasons').doc(newDocId).set(newDocData);
      console.log('✅ Created new TM Asgardians S17 document\n');
    } else {
      console.log('📝 Would create new document\n');
    }

    // Summary
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('📊 SUMMARY\n');
    console.log('✅ Kopites S17 document: Reverted to original team');
    console.log('✅ TM Asgardians S17 document: Created with same budgets');
    console.log('\n✅ Team seasons fix complete!\n');

    if (DRY_RUN) {
      console.log('⚠️  This was a DRY RUN - no changes were made');
      console.log('Set DRY_RUN = false to execute\n');
    }

  } catch (error) {
    console.error('\n❌ Error during fix:', error);
    throw error;
  }
}

fixTeamSeasons()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
