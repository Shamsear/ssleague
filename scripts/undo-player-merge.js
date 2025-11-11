/**
 * Undo Player Merge
 * 
 * This script helps undo an accidental player merge by:
 * 1. Recreating the deleted player in Firebase
 * 2. Splitting stats back between the two players (if possible)
 * 
 * ⚠️ IMPORTANT: This requires you to know:
 * - The kept player's ID
 * - The deleted player's information (name, player_id)
 * - Ideally, which stats belonged to which player
 * 
 * Usage: node scripts/undo-player-merge.js
 */

const admin = require('firebase-admin');
const readline = require('readline');
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
    console.error('❌ Error: Firebase Admin credentials not found!');
    process.exit(1);
  }
}

const db = admin.firestore();

// Initialize Neon
const tournamentSql = process.env.NEON_TOURNAMENT_DB_URL ? neon(process.env.NEON_TOURNAMENT_DB_URL) : null;
if (!tournamentSql) {
  console.error('❌ Error: NEON_TOURNAMENT_DB_URL not found!');
  process.exit(1);
}
console.log('✅ Neon Tournament DB initialized');

// Readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => {
  return new Promise(resolve => rl.question(query, resolve));
};

// Main undo function
async function undoMerge() {
  console.log('\n' + '='.repeat(80));
  console.log('↩️  UNDO PLAYER MERGE');
  console.log('='.repeat(80));
  console.log('\nThis script will help you undo an accidental player merge.\n');
  
  // Get information about the merge
  console.log('📝 Please provide the following information:\n');
  
  const keptPlayerId = await question('1. Player ID that was KEPT (still exists): ');
  if (!keptPlayerId.trim()) {
    console.log('❌ Player ID is required');
    rl.close();
    return;
  }
  
  // Verify kept player exists
  console.log(`\n🔍 Looking up player: ${keptPlayerId}...`);
  const keptPlayerSnapshot = await db.collection('realplayers')
    .where('player_id', '==', keptPlayerId.trim())
    .get();
  
  if (keptPlayerSnapshot.empty) {
    console.log('❌ Error: Could not find player with that ID');
    rl.close();
    return;
  }
  
  const keptPlayerDoc = keptPlayerSnapshot.docs[0];
  const keptPlayer = keptPlayerDoc.data();
  
  console.log(`✅ Found: ${keptPlayer.name} (${keptPlayer.player_id})`);
  
  // Get deleted player information
  console.log('\n📝 Information about the DELETED player:\n');
  const deletedPlayerId = await question('2. Player ID that was DELETED (merged into kept player): ');
  const deletedPlayerName = await question('3. Name of the deleted player: ');
  const deletedPlayerEmail = await question('4. Email of the deleted player (optional, press Enter to skip): ');
  
  if (!deletedPlayerId.trim() || !deletedPlayerName.trim()) {
    console.log('❌ Player ID and name are required');
    rl.close();
    return;
  }
  
  // Show summary
  console.log('\n' + '='.repeat(80));
  console.log('📋 UNDO SUMMARY');
  console.log('='.repeat(80));
  console.log(`\nKept Player (will remain):`);
  console.log(`  - ID: ${keptPlayer.player_id}`);
  console.log(`  - Name: ${keptPlayer.name}`);
  console.log(`\nDeleted Player (will be recreated):`);
  console.log(`  - ID: ${deletedPlayerId.trim()}`);
  console.log(`  - Name: ${deletedPlayerName.trim()}`);
  if (deletedPlayerEmail.trim()) {
    console.log(`  - Email: ${deletedPlayerEmail.trim()}`);
  }
  
  console.log('\n⚠️  WARNING:');
  console.log('  - This will recreate the deleted player document in Firebase');
  console.log('  - Stats in Neon will remain with the kept player');
  console.log('  - You may need to manually reassign stats if you know which belong to each player');
  
  const confirm = await question('\n❓ Proceed with undo? (type "yes" to confirm): ');
  
  if (confirm.toLowerCase() !== 'yes') {
    console.log('❌ Cancelled');
    rl.close();
    return;
  }
  
  console.log('\n🔄 Starting undo process...\n');
  
  try {
    // 1. Recreate the deleted player in Firebase
    console.log('1️⃣ Recreating deleted player in Firebase...');
    
    const newPlayerData = {
      player_id: deletedPlayerId.trim(),
      name: deletedPlayerName.trim(),
      display_name: deletedPlayerName.trim(),
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
      // Add optional fields
      ...(deletedPlayerEmail.trim() && { email: deletedPlayerEmail.trim() }),
      // Add a note about restoration
      restoration_note: `Restored from merge with ${keptPlayer.player_id} on ${new Date().toISOString()}`,
      original_merge_target: keptPlayer.player_id
    };
    
    await db.collection('realplayers').add(newPlayerData);
    console.log(`   ✅ Player recreated: ${deletedPlayerName.trim()} (${deletedPlayerId.trim()})\n`);
    
    // 2. Inform about stats
    console.log('2️⃣ Checking stats in Neon...');
    const stats = await tournamentSql`
      SELECT tournament_id, matches_played, goals, assists 
      FROM realplayerstats 
      WHERE player_id = ${keptPlayer.player_id}
    `;
    
    if (stats.length > 0) {
      console.log(`   ℹ️  Found ${stats.length} stat record(s) for kept player`);
      console.log(`   ⚠️  Stats remain with ${keptPlayer.name} (${keptPlayer.player_id})`);
      console.log(`   ℹ️  If you know which stats belong to ${deletedPlayerName.trim()},`);
      console.log(`      you'll need to manually update them in the database\n`);
    } else {
      console.log(`   ℹ️  No stats found in Neon\n`);
    }
    
    console.log('✅ Undo complete!\n');
    console.log('📝 Next steps:');
    console.log(`   1. Verify the player appears in your admin panel`);
    console.log(`   2. If needed, manually reassign stats between the two players`);
    console.log(`   3. Update any photo URLs or other metadata\n`);
    
  } catch (error) {
    console.error('❌ Error during undo:', error);
  }
  
  rl.close();
}

// Run the script
undoMerge().catch(error => {
  console.error('Fatal error:', error);
  rl.close();
  process.exit(1);
});
