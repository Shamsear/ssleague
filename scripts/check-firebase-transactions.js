const admin = require('firebase-admin');
require('dotenv').config({ path: '.env.local' });

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

async function checkTransactions() {
  try {
    console.log('🔍 Checking Firebase transactions collection...\n');

    // Get all transactions
    const transactionsSnapshot = await db.collection('transactions').limit(10).get();

    console.log(`📊 Found ${transactionsSnapshot.size} transactions (showing first 10)\n`);

    if (transactionsSnapshot.empty) {
      console.log('❌ No transactions found in Firebase!');
      return;
    }

    transactionsSnapshot.forEach((doc, index) => {
      const data = doc.data();
      console.log(`\n${index + 1}. Transaction ID: ${doc.id}`);
      console.log('   Data:', JSON.stringify(data, null, 2));
      console.log('   ---');
    });

    // Check for transactions with season_id
    const withSeasonId = await db.collection('transactions')
      .where('season_id', '!=', null)
      .limit(5)
      .get();

    console.log(`\n\n✅ Transactions with season_id: ${withSeasonId.size}`);

    // Check for transactions with transaction_type
    const withType = await db.collection('transactions')
      .where('transaction_type', '!=', null)
      .limit(5)
      .get();

    console.log(`✅ Transactions with transaction_type: ${withType.size}`);

    // Get unique season_ids
    const allTransactions = await db.collection('transactions').get();
    const seasonIds = new Set();
    const transactionTypes = new Set();

    allTransactions.forEach(doc => {
      const data = doc.data();
      if (data.season_id) seasonIds.add(data.season_id);
      if (data.transaction_type) transactionTypes.add(data.transaction_type);
    });

    console.log(`\n📋 Unique season_ids found: ${Array.from(seasonIds).join(', ')}`);
    console.log(`📋 Unique transaction_types found: ${Array.from(transactionTypes).join(', ')}`);

    // Check for release transactions specifically
    console.log('\n\n🔍 Checking for RELEASE transactions...\n');
    const releaseTransactions = await db.collection('transactions')
      .where('transaction_type', '==', 'release')
      .limit(5)
      .get();

    console.log(`📊 Found ${releaseTransactions.size} release transactions (showing first 5)\n`);

    if (releaseTransactions.empty) {
      console.log('❌ No release transactions found!');
    } else {
      releaseTransactions.forEach((doc, index) => {
        const data = doc.data();
        console.log(`\n${index + 1}. Release Transaction ID: ${doc.id}`);
        console.log('   Data:', JSON.stringify(data, null, 2));
        console.log('   ---');
      });
    }

    // Check for transfer-related transaction types
    console.log('\n\n🔍 Checking for TRANSFER-related transactions...\n');
    const transferTypes = ['transfer', 'swap', 'player_transfer', 'player_swap'];
    
    for (const type of transferTypes) {
      const typeTransactions = await db.collection('transactions')
        .where('transaction_type', '==', type)
        .limit(1)
        .get();
      
      if (!typeTransactions.empty) {
        console.log(`✅ Found transaction_type: "${type}" (${typeTransactions.size} found)`);
        typeTransactions.forEach(doc => {
          console.log(`   Sample:`, JSON.stringify(doc.data(), null, 2));
        });
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

checkTransactions();
