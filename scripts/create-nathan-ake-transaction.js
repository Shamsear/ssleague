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

async function createNathanAkeTransaction() {
  console.log('\n🚀 Creating Missing Transaction for Nathan Aké...\n');
  
  try {
    // Transaction details for Nathan Aké
    const transactionData = {
      userId: 'POOEoZr5lvZoeiQeA492LafRG9R2', // FC Barcelona firebase_uid
      seasonId: 'SSPSLS17',
      type: 'auction_win',
      category: 'football',
      amount: -10,
      balanceBefore: 3395.70,
      balanceAfter: 3385.70,
      description: 'Won Nathan Aké in auction',
      metadata: {
        playerId: '285',
        playerName: 'Nathan Aké',
        roundId: 'SSPSLFBR00010',
        bidAmount: 10,
      },
      createdAt: new Date(),
    };

    console.log('📝 Transaction Details:');
    console.log(`   Player: Nathan Aké (ID: 285)`);
    console.log(`   Team: FC Barcelona (SSPSLT0006)`);
    console.log(`   Amount: £${Math.abs(transactionData.amount)}`);
    console.log(`   Round: SSPSLFBR00010`);
    console.log(`   Balance Before: £${transactionData.balanceBefore}`);
    console.log(`   Balance After: £${transactionData.balanceAfter}`);
    console.log('');

    // Create transaction in Firebase
    const transactionRef = await db.collection('transactions').add(transactionData);

    console.log('✅ Transaction created successfully!');
    console.log(`   Transaction ID: ${transactionRef.id}`);
    console.log('');

    // Verify the transaction was created
    const verifyDoc = await transactionRef.get();
    if (verifyDoc.exists) {
      console.log('🔍 Verification: Transaction exists in Firebase');
      const data = verifyDoc.data();
      console.log(`   Type: ${data.type}`);
      console.log(`   Category: ${data.category}`);
      console.log(`   Amount: £${Math.abs(data.amount)}`);
      console.log(`   Player: ${data.metadata.playerName}`);
    } else {
      console.error('❌ Verification failed: Transaction not found');
      process.exit(1);
    }

    console.log('\n🎉 Transaction creation complete!\n');
    
  } catch (error) {
    console.error('❌ Error creating transaction:', error);
    process.exit(1);
  }
}

// Run the script
createNathanAkeTransaction()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
