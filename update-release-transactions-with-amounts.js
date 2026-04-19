const admin = require('firebase-admin');
const { neon } = require('@neondatabase/serverless');
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
const sql = neon(process.env.DATABASE_URL);

// Player auction amounts provided by user
const playerAuctionAmounts = {
  'Jackson Tchatchoua': 23,
  'Nicola Zalewski': 30,
  'Andrej Kramarić': 55,
  'Jacob Ramsey': 14,
  'Leon Bailey': 40,
  'Paulinho': 13,
  'Ander Barrenetxea': 32,
  'Julio Enciso': 14,
  'Iliman Ndiaye': 18,
  'Simon Adingra': 19,
  'Pedro Porro': 14,
  'Giacomo Raspadori': 216,
  'Kevin Danso': 30,
  'Dwight McNeil': 54,
  'Francisco Conceição': 50,
  'Kim Min-Jae': 320,
  'Pablo Barrios': 15,
  'Noussair Mazraoui': 11,
  'Nico González': 17,
  'Álex Zendejas': 14,
  'Jarrad Branthwaite': 10
};

async function updateReleaseTransactions() {
  console.log('Updating release transactions with correct auction amounts and 75% refunds...\n');
  console.log('='.repeat(80));
  console.log('PREVIEW MODE - Review before confirming\n');
  console.log('='.repeat(80));
  
  const updates = [];
  
  for (const [playerName, auctionAmount] of Object.entries(playerAuctionAmounts)) {
    // Find the transaction in Firestore
    const snapshot = await db.collection('transactions')
      .where('transaction_type', '==', 'release')
      .where('season_id', '==', 'SSPSLS16')
      .where('player_type', '==', 'football')
      .where('player_name', '==', playerName)
      .get();
    
    if (snapshot.empty) {
      console.log(`⚠️  Transaction not found for: ${playerName}`);
      continue;
    }
    
    const doc = snapshot.docs[0];
    const data = doc.data();
    const refund75 = Math.floor(auctionAmount * 0.75);
    
    updates.push({
      docId: doc.id,
      playerName: playerName,
      teamName: data.team_name,
      currentAuction: data.auction_value || 0,
      currentRefund: data.refund_amount || 0,
      newAuction: auctionAmount,
      newRefund: refund75
    });
  }
  
  // Display preview
  console.log('\nPREVIEW OF UPDATES:\n');
  
  const byTeam = new Map();
  updates.forEach(u => {
    if (!byTeam.has(u.teamName)) {
      byTeam.set(u.teamName, []);
    }
    byTeam.get(u.teamName).push(u);
  });
  
  for (const [teamName, players] of byTeam.entries()) {
    console.log(`\n${teamName}:`);
    players.forEach(p => {
      console.log(`  ${p.playerName}`);
      console.log(`    Current: Auction=${p.currentAuction}, Refund=${p.currentRefund}`);
      console.log(`    New:     Auction=${p.newAuction}, Refund=${p.newRefund} (75%)`);
    });
  }
  
  const totalCurrentRefund = updates.reduce((sum, u) => sum + u.currentRefund, 0);
  const totalNewRefund = updates.reduce((sum, u) => sum + u.newRefund, 0);
  const totalAuction = updates.reduce((sum, u) => sum + u.newAuction, 0);
  
  console.log('\n' + '='.repeat(80));
  console.log('\nSUMMARY:');
  console.log(`  Players to update: ${updates.length}`);
  console.log(`  Total auction value: ${totalAuction} coins`);
  console.log(`  Current total refund: ${totalCurrentRefund} coins`);
  console.log(`  New total refund (75%): ${totalNewRefund} coins`);
  console.log(`  Difference: +${totalNewRefund - totalCurrentRefund} coins`);
  
  console.log('\n' + '='.repeat(80));
  console.log('\nPREVIEW COMPLETE - No changes made yet');
  console.log('\nTo apply these updates, run: node apply-release-transaction-updates.js');
  
  // Save updates to a file for the apply script
  const fs = require('fs');
  fs.writeFileSync('release-transaction-updates.json', JSON.stringify(updates, null, 2));
  console.log('\nUpdates saved to: release-transaction-updates.json');
  
  process.exit(0);
}

updateReleaseTransactions().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
