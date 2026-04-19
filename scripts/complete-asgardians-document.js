/**
 * Complete TM Asgardians S17 Document
 * 
 * Copy all fields from Kopites S16 document and update for TM Asgardians S17
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

async function completeAsgardiansDocument() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║      COMPLETE TM ASGARDIANS S17 DOCUMENT                  ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  if (DRY_RUN) {
    console.log('⚠️  DRY RUN MODE - No changes will be made\n');
  } else {
    console.log('🚨 LIVE MODE - Changes will be applied!\n');
  }

  try {
    // Step 1: Get Kopites S16 document as template
    console.log('STEP 1: Get Kopites S16 document\n');
    
    const kopitesS16Doc = await db.collection('team_seasons')
      .doc('SSPSLT0023_SSPSLS16')
      .get();

    if (!kopitesS16Doc.exists) {
      console.log('❌ Kopites S16 document not found!\n');
      return;
    }

    const s16Data = kopitesS16Doc.data();
    console.log('✅ Found Kopites S16 document\n');

    // Step 2: Get current TM Asgardians S17 document
    console.log('STEP 2: Get current TM Asgardians S17 document\n');
    
    const asgardiansDoc = await db.collection('team_seasons')
      .doc('SSPSLT0005_SSPSLS17')
      .get();

    if (!asgardiansDoc.exists) {
      console.log('❌ TM Asgardians S17 document not found!\n');
      return;
    }

    const currentData = asgardiansDoc.data();
    console.log('✅ Found TM Asgardians S17 document\n');
    console.log(`Current fields: ${Object.keys(currentData).length}`);
    console.log(`Template fields: ${Object.keys(s16Data).length}\n`);

    // Step 3: Get TM Asgardians team info
    console.log('STEP 3: Get TM Asgardians team info\n');
    
    const asgardiansTeamDoc = await db.collection('teams')
      .doc('SSPSLT0005')
      .get();

    const teamData = asgardiansTeamDoc.exists ? asgardiansTeamDoc.data() : {};
    console.log(`Team: ${teamData.name || 'TM Asgardians'}`);
    console.log(`Owner: ${teamData.owner_name || 'Unknown'}`);
    console.log(`Email: ${teamData.email || 'N/A'}\n`);

    // Step 4: Build complete document
    console.log('STEP 4: Build complete document\n');

    const completeData = {
      // Core identifiers (updated for S17 and new team)
      team_id: 'SSPSLT0005',
      team_name: 'TM Asgardians',
      season_id: 'SSPSLS17',
      
      // Contract info (updated for S17)
      contract_start_season: 'SSPSLS17',
      contract_end_season: s16Data.contract_end_season || 'SSPSLS17', // Keep original end or use S17
      contract_length: s16Data.contract_length || 1,
      contract_id: `contract_SSPSLT0005_SSPSLS17_${Date.now()}`,
      
      // Budget info (from S16 carryover)
      football_budget: currentData.football_budget || 1543,
      real_player_budget: currentData.real_player_budget || 542.04,
      football_starting_balance: s16Data.football_starting_balance || 10000,
      real_player_starting_balance: s16Data.real_player_starting_balance || 1000,
      
      // Spending (reset for new season)
      football_spent: 0,
      real_player_spent: 0,
      total_spent: 0,
      
      // Counts (reset for new season)
      players_count: 0,
      transfers_used: 0,
      football_swap_count: 0,
      penalty_amount: 0,
      skipped_seasons: 0,
      
      // Position counts (reset)
      position_counts: {
        GK: 0, DEF: 0, MID: 0, FWD: 0,
        CB: 0, LB: 0, RB: 0, DMF: 0, CMF: 0, AMF: 0,
        LWF: 0, RWF: 0, CF: 0, SS: 0,
        LMF: 0, RMF: 0
      },
      
      // System settings
      currency_system: s16Data.currency_system || 'dual',
      status: 'registered',
      is_auto_registered: false,
      
      // Team info (from teams collection or defaults)
      owner_name: teamData.owner_name || s16Data.owner_name || 'Team Owner',
      team_email: teamData.email || 'asgardians@ssleague.com',
      team_logo: teamData.logo || s16Data.team_logo || '',
      username: teamData.username || 'asgardians',
      user_id: teamData.user_id || s16Data.user_id || '',
      
      // Timestamps
      created_at: currentData.created_at || admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
      joined_at: currentData.joined_at || admin.firestore.FieldValue.serverTimestamp(),
      
      // Optional fields
      last_played_season: 'SSPSLS16',
      last_salary_deduction: s16Data.last_salary_deduction || null
    };

    console.log('Complete document structure:');
    console.log(`  Total fields: ${Object.keys(completeData).length}`);
    console.log(`  Contract: ${completeData.contract_start_season} → ${completeData.contract_end_season}`);
    console.log(`  Budgets: ${completeData.football_budget} eCoin, ${completeData.real_player_budget} SSCoin`);
    console.log(`  Status: ${completeData.status}\n`);

    // Step 5: Update document
    console.log('STEP 5: Update TM Asgardians S17 document\n');

    if (!DRY_RUN) {
      await db.collection('team_seasons')
        .doc('SSPSLT0005_SSPSLS17')
        .set(completeData, { merge: true });
      
      console.log('✅ Updated TM Asgardians S17 document with all fields\n');
    } else {
      console.log('📝 Would update document with complete data\n');
      console.log('Sample fields that would be added:');
      const newFields = Object.keys(completeData).filter(k => !currentData[k]);
      newFields.slice(0, 10).forEach(field => {
        console.log(`  - ${field}: ${JSON.stringify(completeData[field])}`);
      });
      if (newFields.length > 10) {
        console.log(`  ... and ${newFields.length - 10} more fields\n`);
      }
    }

    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('✅ TM Asgardians S17 document completed!\n');

    if (DRY_RUN) {
      console.log('⚠️  This was a DRY RUN - no changes were made');
      console.log('Set DRY_RUN = false to execute\n');
    }

  } catch (error) {
    console.error('\n❌ Error during completion:', error);
    throw error;
  }
}

completeAsgardiansDocument()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
