const admin = require('firebase-admin');
require('dotenv').config({ path: '.env.local' });

if (!admin.apps.length) {
  const serviceAccount = {
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n')
  };

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function findAllReleaseTransactions() {
  try {
    console.log('Finding all release transactions...\n');
    
    const transactionsSnapshot = await db.collection('transactions')
      .where('transaction_type', '==', 'release')
      .get();
    
    console.log(`Found ${transactionsSnapshot.size} release transactions:\n`);
    
    const transactions = [];
    transactionsSnapshot.forEach(doc => {
      const data = doc.data();
      transactions.push({
        id: doc.id,
        player_id: data.player_id,
        player_name: data.player_name,
        team_name: data.team_name,
        created_at: data.created_at
      });
    });
    
    // Sort by player name
    transactions.sort((a, b) => a.player_name.localeCompare(b.player_name));
    
    transactions.forEach((t, i) => {
      console.log(`${i + 1}. ${t.player_name} (ID: ${t.player_id})`);
      console.log(`   Team: ${t.team_name}`);
      console.log(`   Transaction ID: ${t.id}`);
      console.log(`   Date: ${t.created_at ? new Date(t.created_at._seconds * 1000).toISOString() : 'N/A'}`);
      console.log('');
    });
    
    console.log(`\nTotal: ${transactions.length} release transactions`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

findAllReleaseTransactions();
