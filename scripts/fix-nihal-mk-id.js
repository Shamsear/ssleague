/**
 * Fix Nihal MK Player ID Format
 * 
 * Updates the player_id from "157" to proper format "sspslpsl0157"
 */

const admin = require('firebase-admin');
const path = require('path');
const { neon } = require('@neondatabase/serverless');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

// Initialize Firebase Admin
if (!admin.apps.length) {
  if (process.env.FIREBASE_ADMIN_PROJECT_ID && 
      process.env.FIREBASE_ADMIN_CLIENT_EMAIL && 
      process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n')
      })
    });
    console.log('✅ Firebase Admin initialized');
  } else {
    console.error('❌ Firebase Admin credentials not found!');
    process.exit(1);
  }
}

const db = admin.firestore();

// Initialize Neon
const tournamentSql = process.env.NEON_TOURNAMENT_DB_URL ? neon(process.env.NEON_TOURNAMENT_DB_URL) : null;
if (!tournamentSql) {
  console.error('❌ NEON_TOURNAMENT_DB_URL not found!');
  process.exit(1);
}
console.log('✅ Neon Tournament DB initialized\n');

async function fixNihalMkId() {
  console.log('🔧 Fixing Nihal MK player_id format...\n');
  
  const oldId = '157';
  const newId = 'sspslpsl0157';
  
  try {
    // 1. Update Firebase
    console.log('1️⃣ Updating Firebase...');
    const nihalMkSnapshot = await db.collection('realplayers')
      .where('player_id', '==', oldId)
      .get();
    
    if (nihalMkSnapshot.empty) {
      console.log('   ❌ Could not find player with id "157"');
      return;
    }
    
    const nihalMkDoc = nihalMkSnapshot.docs[0];
    await nihalMkDoc.ref.update({
      player_id: newId,
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`   ✅ Updated Firebase: ${oldId} → ${newId}\n`);
    
    // 2. Update Neon
    console.log('2️⃣ Updating Neon stats...');
    
    await tournamentSql`
      UPDATE realplayerstats
      SET 
        player_id = ${newId},
        updated_at = NOW()
      WHERE player_id = ${oldId}
    `;
    
    console.log(`   ✅ Updated Neon stats: ${oldId} → ${newId}\n`);
    
    // 3. Verify
    console.log('3️⃣ Verifying...');
    const verifyStats = await tournamentSql`
      SELECT COUNT(*) as count
      FROM realplayerstats 
      WHERE player_id = ${newId}
    `;
    
    console.log(`   ✅ Confirmed: ${verifyStats[0].count} stats now have player_id ${newId}\n`);
    
    console.log('✅ Fix complete! Nihal MK now has player_id: sspslpsl0157\n');
    
  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
  }
}

// Run
fixNihalMkId().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
