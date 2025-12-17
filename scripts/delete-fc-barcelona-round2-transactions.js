/**
 * Delete FC Barcelona Round 2 salary transactions
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

async function deleteRound2Transactions() {
  try {
    console.log('🔍 Finding FC Barcelona Round 2 transactions...');
    
    const teamId = 'SSPSLT0006';
    const seasonId = 'SSPSLS16';
    const fixtureId = 'SSPSLS16L_leg1_r2_m2';
    
    // Find all transactions for this fixture
    const transactionsSnapshot = await db.collection('transactions')
      .where('team_id', '==', teamId)
      .where('season_id', '==', seasonId)
      .get();
    
    const round2Txns = transactionsSnapshot.docs.filter(doc => {
      const metadata = doc.data().metadata || {};
      return metadata.fixture_id === fixtureId;
    });
    
    console.log(`   Found ${round2Txns.length} transactions to delete`);
    
    if (round2Txns.length === 0) {
      console.log('   No transactions to delete');
      return;
    }
    
    // Calculate total to refund
    let totalRefund = 0;
    round2Txns.forEach(doc => {
      const amount = doc.data().amount || 0;
      totalRefund += Math.abs(amount);
      console.log(`   - ${doc.data().metadata?.player_name}: ${amount}`);
    });
    
    console.log(`\n💰 Total to refund: ${totalRefund.toFixed(2)}`);
    
    // Delete transactions
    const batch = db.batch();
    round2Txns.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    console.log(`✅ Deleted ${round2Txns.length} transactions`);
    
    // Update team balance
    const teamSeasonDoc = await db.collection('team_seasons')
      .where('team_id', '==', teamId)
      .where('season_id', '==', seasonId)
      .limit(1)
      .get();
    
    if (!teamSeasonDoc.empty) {
      const doc = teamSeasonDoc.docs[0];
      const currentBalance = doc.data().real_player_budget || 0;
      const newBalance = currentBalance + totalRefund;
      
      await doc.ref.update({
        real_player_budget: newBalance,
        updated_at: new Date()
      });
      
      console.log(`\n💰 Updated team balance:`);
      console.log(`   Old: ${currentBalance.toFixed(2)}`);
      console.log(`   Refund: +${totalRefund.toFixed(2)}`);
      console.log(`   New: ${newBalance.toFixed(2)}`);
    }
    
    console.log('\n✅ COMPLETE!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

deleteRound2Transactions();
