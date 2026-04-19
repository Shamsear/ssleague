const admin = require('firebase-admin');
const fs = require('fs');
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

async function applyUpdates() {
  console.log('Applying release transaction updates...\n');
  console.log('='.repeat(80));
  
  // Load updates from file
  const updates = JSON.parse(fs.readFileSync('release-transaction-updates.json', 'utf8'));
  
  console.log(`\nUpdating ${updates.length} transactions...\n`);
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const update of updates) {
    try {
      await db.collection('transactions').doc(update.docId).update({
        auction_value: update.newAuction,
        refund_amount: update.newRefund,
        refund_percentage: 75,
        updated_at: new Date()
      });
      
      console.log(`✅ ${update.playerName} (${update.teamName}): Auction=${update.newAuction}, Refund=${update.newRefund}`);
      successCount++;
      
    } catch (error) {
      console.error(`❌ Error updating ${update.playerName}:`, error.message);
      errorCount++;
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('\nUPDATE COMPLETE:');
  console.log(`  ✅ Successfully updated: ${successCount}`);
  console.log(`  ❌ Errors: ${errorCount}`);
  
  if (successCount === updates.length) {
    console.log('\n🎉 All transactions updated successfully!');
  }
  
  process.exit(0);
}

applyUpdates().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
