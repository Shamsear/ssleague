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

async function updateJuneReleaseDates() {
  try {
    console.log('Updating all June 2024 release dates to January 1, 2026...\n');
    
    // New release date: January 1, 2026 at 00:00:00 UTC
    const newReleaseDate = admin.firestore.Timestamp.fromDate(new Date('2026-01-01T00:00:00Z'));
    const juneDate = new Date('2024-06-15T00:00:00Z');
    
    // Get all release transactions
    const transactionsSnapshot = await db.collection('transactions')
      .where('transaction_type', '==', 'release')
      .get();
    
    console.log(`Found ${transactionsSnapshot.size} total release transactions\n`);
    
    let updatedCount = 0;
    let skippedCount = 0;
    
    for (const doc of transactionsSnapshot.docs) {
      const data = doc.data();
      const createdAt = data.created_at;
      
      // Check if the date is June 15, 2024
      if (createdAt && createdAt._seconds) {
        const docDate = new Date(createdAt._seconds * 1000);
        
        // Check if it's June 15, 2024
        if (docDate.toISOString().startsWith('2024-06-15')) {
          await doc.ref.update({
            created_at: newReleaseDate,
            updated_at: admin.firestore.Timestamp.now()
          });
          
          console.log(`✅ Updated: ${data.player_name} (${data.player_id}) - ${data.team_name}`);
          updatedCount++;
        } else {
          console.log(`⏭️  Skipped: ${data.player_name} - Date: ${docDate.toISOString().split('T')[0]}`);
          skippedCount++;
        }
      } else {
        console.log(`⚠️  No date: ${data.player_name}`);
        skippedCount++;
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log(`\n✅ Successfully updated ${updatedCount} release transactions`);
    console.log(`⏭️  Skipped ${skippedCount} transactions (different dates)`);
    console.log('\nAll June 15, 2024 release dates have been updated to January 1, 2026!');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

updateJuneReleaseDates();
