#!/usr/bin/env node

/**
 * Migration Script: Sync Owner Names to Usernames
 * 
 * This script will update all team records to ensure
 * owner_name matches username for consistency.
 */

// Uncomment and configure when ready to run:
/*
const admin = require('firebase-admin');

// Initialize with your service account
admin.initializeApp({
  credential: admin.credential.cert(require('../serviceAccount.json')),
});

const db = admin.firestore();

async function syncOwnerNameToUsername() {
  try {
    console.log('🔄 Starting owner_name to username sync...');
    
    const batch = db.batch();
    const teamSeasonsRef = db.collection('team_seasons');
    const snapshot = await teamSeasonsRef.get();
    
    let updates = 0;
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      
      // If has username but owner_name doesn't match
      if (data.username && data.owner_name !== data.username) {
        batch.update(doc.ref, { owner_name: data.username });
        updates++;
        console.log(`📝 Will update ${doc.id}: "${data.owner_name}" → "${data.username}"`);
      }
    });
    
    if (updates > 0) {
      console.log(`\n💾 Committing ${updates} updates...`);
      await batch.commit();
      console.log('✅ Migration completed successfully!');
    } else {
      console.log('✅ No updates needed - all records are consistent!');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

// Run migration
syncOwnerNameToUsername().then(() => process.exit(0));
*/

console.log('📝 Migration script template created!');
console.log('Uncomment and configure the code above to run the migration.');
