const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

// Initialize Firebase Admin
const serviceAccount = require(path.join(process.cwd(), process.env.FIREBASE_SERVICE_ACCOUNT_PATH || 'serviceAccountKey.json'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function initializeSlotFields() {
  console.log('\n🚀 Initializing Football Slot Fields in Firebase team_seasons...\n');
  
  try {
    // Get all team_seasons documents
    const teamSeasonsSnapshot = await db.collection('team_seasons').get();
    
    if (teamSeasonsSnapshot.empty) {
      console.log('⚠️  No team_seasons documents found');
      return;
    }
    
    console.log(`📊 Found ${teamSeasonsSnapshot.size} team_seasons documents\n`);
    
    // Get all seasons to get max_football_players defaults
    const seasonsSnapshot = await db.collection('seasons').get();
    const seasonsMap = new Map();
    
    seasonsSnapshot.forEach(doc => {
      const data = doc.data();
      seasonsMap.set(doc.id, {
        max_football_players: data.max_football_players || 25,
        football_base_slots: data.football_base_slots || data.max_football_players || 25,
      });
    });
    
    console.log(`📋 Loaded ${seasonsMap.size} season configurations\n`);
    
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    
    // Process in batches of 500 (Firestore limit)
    const batch = db.batch();
    let batchCount = 0;
    
    for (const doc of teamSeasonsSnapshot.docs) {
      const data = doc.data();
      const seasonId = data.season_id;
      
      // Check if slot fields already exist
      if (data.football_total_slots !== undefined) {
        console.log(`⏭️  Skipping ${doc.id} - already has slot fields`);
        skipped++;
        continue;
      }
      
      // Get season defaults
      const seasonConfig = seasonsMap.get(seasonId);
      const baseSlots = seasonConfig?.football_base_slots || 25;
      
      // Prepare update data
      const updateData = {
        football_base_slots: baseSlots,
        football_purchased_slots: 0,
        football_total_slots: baseSlots,
      };
      
      console.log(`✏️  Updating ${doc.id}:`, updateData);
      
      batch.update(doc.ref, updateData);
      batchCount++;
      updated++;
      
      // Commit batch every 500 operations
      if (batchCount >= 500) {
        await batch.commit();
        console.log(`\n💾 Committed batch of ${batchCount} updates\n`);
        batchCount = 0;
      }
    }
    
    // Commit remaining updates
    if (batchCount > 0) {
      await batch.commit();
      console.log(`\n💾 Committed final batch of ${batchCount} updates\n`);
    }
    
    console.log('\n📊 Summary:');
    console.log(`   ✅ Updated: ${updated}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   ❌ Errors: ${errors}`);
    
    // Verify a sample
    console.log('\n🔍 Verifying sample documents...\n');
    
    const sampleDocs = await db.collection('team_seasons').limit(3).get();
    sampleDocs.forEach(doc => {
      const data = doc.data();
      console.log(`📄 ${doc.id}:`);
      console.log(`   - football_base_slots: ${data.football_base_slots}`);
      console.log(`   - football_purchased_slots: ${data.football_purchased_slots}`);
      console.log(`   - football_total_slots: ${data.football_total_slots}`);
    });
    
    console.log('\n🎉 Firebase initialization complete!\n');
    
  } catch (error) {
    console.error('❌ Error initializing slot fields:', error);
    process.exit(1);
  }
}

// Run the initialization
initializeSlotFields()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
