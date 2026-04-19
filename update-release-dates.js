const admin = require('firebase-admin');
require('dotenv').config({ path: '.env.local' });

// Initialize Firebase Admin using environment variables
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

// List of 22 player IDs that were released
const releasedPlayerIds = [
  '124840', // Dwight McNeil
  '119828', // Pedro Porro
  '124841', // Amadou Onana
  '124842', // Matheus Cunha
  '124843', // Yoane Wissa
  '124844', // Joao Pedro
  '124845', // Eberechi Eze
  '124846', // Dominic Solanke
  '124847', // Brennan Johnson
  '124848', // Bukayo Saka
  '124849', // Trent Alexander-Arnold
  '124850', // Declan Rice
  '124851', // Jarrod Bowen
  '124852', // Ollie Watkins
  '124853', // Alexander Isak
  '124854', // Bruno Fernandes
  '124855', // Heung-Min Son
  '124856', // Mohamed Salah
  '124857', // Cole Palmer
  '124858', // Erling Haaland
  '124859', // Phil Foden
  '124860'  // Filippo Distefano
];

async function updateReleaseDates() {
  try {
    console.log('Starting to update release dates for 22 football players...\n');
    
    // New release date: January 1, 2026 at 00:00:00 UTC
    const newReleaseDate = admin.firestore.Timestamp.fromDate(new Date('2026-01-01T00:00:00Z'));
    
    let updatedCount = 0;
    let notFoundCount = 0;
    
    for (const playerId of releasedPlayerIds) {
      // Query for release transactions for this player
      const transactionsSnapshot = await db.collection('transactions')
        .where('player_id', '==', playerId)
        .where('transaction_type', '==', 'release')
        .get();
      
      if (transactionsSnapshot.empty) {
        console.log(`❌ No release transaction found for player ID: ${playerId}`);
        notFoundCount++;
        continue;
      }
      
      // Update each transaction (should be only 1 per player)
      for (const doc of transactionsSnapshot.docs) {
        const data = doc.data();
        await doc.ref.update({
          created_at: newReleaseDate,
          updated_at: admin.firestore.Timestamp.now()
        });
        
        console.log(`✅ Updated release date for ${data.player_name} (${playerId})`);
        console.log(`   Transaction ID: ${doc.id}`);
        console.log(`   New release date: 2026-01-01`);
        updatedCount++;
      }
    }
    
    console.log('\n=== Summary ===');
    console.log(`Total players to update: ${releasedPlayerIds.length}`);
    console.log(`Successfully updated: ${updatedCount}`);
    console.log(`Not found: ${notFoundCount}`);
    console.log('\n✅ Release dates updated successfully!');
    
  } catch (error) {
    console.error('Error updating release dates:', error);
  } finally {
    process.exit(0);
  }
}

updateReleaseDates();
