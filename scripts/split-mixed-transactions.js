require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('FIREBASE_ADMIN_PRIVATE_KEY is not set');
  }
  
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: privateKey.replace(/\\n/g, '\n'),
    }),
  });
  console.log('✅ Firebase Admin initialized\n');
}

const db = admin.firestore();

async function splitTransactions() {
  try {
    console.log('🔄 Splitting mixed currency transactions into separate transactions\n');

    // Get all mixed match reward transactions
    const transactionsSnapshot = await db.collection('transactions')
      .where('transaction_type', '==', 'match_reward')
      .where('currency_type', '==', 'mixed')
      .get();

    console.log(`Found ${transactionsSnapshot.size} mixed transactions to split\n`);
    console.log('═'.repeat(80));

    let successCount = 0;
    let errorCount = 0;

    const batch = db.batch();
    let batchCount = 0;
    const MAX_BATCH = 500;

    for (const doc of transactionsSnapshot.docs) {
      try {
        const data = doc.data();
        const ecoin = data.amount || data.metadata?.ecoin || 0;
        const sscoin = data.amount_real || data.metadata?.sscoin || 0;

        console.log(`\n📊 Transaction ${doc.id}`);
        console.log(`   Team: ${data.team_id}`);
        console.log(`   Description: ${data.description}`);
        console.log(`   eCoin: ${ecoin}, SSCoin: ${sscoin}`);

        // Create eCoin transaction
        if (ecoin > 0) {
          const ecoinRef = db.collection('transactions').doc();
          batch.set(ecoinRef, {
            team_id: data.team_id,
            season_id: data.season_id,
            transaction_type: 'match_reward',
            currency_type: 'football',
            amount: ecoin,
            description: data.description.replace(' [Retroactive]', '') + ' - eCoin' + (data.metadata?.retroactive ? ' [Retroactive]' : ''),
            created_at: data.created_at,
            updated_at: new Date(),
            metadata: {
              ...data.metadata,
              currency: 'ecoin',
              split_from: doc.id
            }
          });
          batchCount++;
        }

        // Create SSCoin transaction
        if (sscoin > 0) {
          const sscoinRef = db.collection('transactions').doc();
          batch.set(sscoinRef, {
            team_id: data.team_id,
            season_id: data.season_id,
            transaction_type: 'match_reward',
            currency_type: 'real',
            amount: sscoin,
            description: data.description.replace(' [Retroactive]', '') + ' - SSCoin' + (data.metadata?.retroactive ? ' [Retroactive]' : ''),
            created_at: data.created_at,
            updated_at: new Date(),
            metadata: {
              ...data.metadata,
              currency: 'sscoin',
              split_from: doc.id
            }
          });
          batchCount++;
        }

        // Delete the old mixed transaction
        batch.delete(doc.ref);
        batchCount++;

        console.log(`   ✅ Queued for split`);

        // Commit batch if we reach the limit
        if (batchCount >= MAX_BATCH) {
          await batch.commit();
          console.log(`\n💾 Committed batch of ${batchCount} operations`);
          batchCount = 0;
        }

        successCount++;
      } catch (error) {
        console.error(`   ❌ Error processing transaction ${doc.id}:`, error.message);
        errorCount++;
      }
    }

    // Commit remaining operations
    if (batchCount > 0) {
      await batch.commit();
      console.log(`\n💾 Committed final batch of ${batchCount} operations`);
    }

    console.log(`\n${'═'.repeat(80)}`);
    console.log(`\n✅ Split complete!`);
    console.log(`   Success: ${successCount} transactions split`);
    console.log(`   Errors: ${errorCount} transactions`);
    console.log(`   Total: ${successCount + errorCount} transactions`);

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

splitTransactions()
  .then(() => {
    console.log('\n✅ Script complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
