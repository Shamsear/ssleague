/**
 * Delete salary transactions for Los Galacticos Round 4
 */

const admin = require('firebase-admin');
require('dotenv').config({ path: '.env.local' });

// Initialize Firebase Admin
if (!admin.apps.length) {
  if (process.env.FIREBASE_ADMIN_PROJECT_ID && process.env.FIREBASE_ADMIN_CLIENT_EMAIL && process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
    console.log('✅ Firebase Admin initialized\n');
  } else {
    admin.initializeApp();
    console.log('✅ Firebase Admin initialized with default credentials\n');
  }
}

const db = admin.firestore();

async function deleteRound4Transactions() {
  try {
    console.log('🔍 Finding Los Galacticos team...');
    
    const teamSeasonsSnapshot = await db.collection('team_seasons')
      .where('team_name', '==', 'Los Galacticos')
      .where('status', '==', 'registered')
      .get();
    
    if (teamSeasonsSnapshot.empty) {
      console.error('❌ Los Galacticos team_season not found');
      return;
    }
    
    const teamSeasonDoc = teamSeasonsSnapshot.docs[0];
    const teamSeasonData = teamSeasonDoc.data();
    const teamId = teamSeasonData.team_id;
    
    console.log(`✅ Found team: ${teamSeasonData.team_name}`);
    console.log(`   Team ID: ${teamId}`);
    console.log(`   Current balance: ${teamSeasonData.real_player_budget || 0}`);
    
    // Find all salary transactions for round 4
    console.log('\n🔍 Finding round 4 transactions...');
    
    const transactionsSnapshot = await db.collection('transactions')
      .where('team_id', '==', teamId)
      .where('transaction_type', 'in',