/**
 * Demerge Nihal and Nihal MK
 * 
 * This script separates the stats of two players that were incorrectly merged:
 * - Nihal (kept player)
 * - Nihal MK (deleted player whose stats are under Nihal's ID)
 * 
 * The script will:
 * 1. Recreate Nihal MK in Firebase
 * 2. Let you choose which tournaments/stats belong to which player
 * 3. Split the stats accordingly in Neon
 * 
 * Usage: node scripts/demerge-nihal-players.js
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

async function demergeNihalPlayers() {
  console.log('\n' + '='.repeat(80));
  console.log('🔀 DEMERGE NIHAL PLAYERS');
  console.log('='.repeat(80));
  console.log('\nThis script will separate Nihal and Nihal MK stats.\n');
  
  // Step 1: Find Nihal in Firebase
  console.log('1️⃣ Looking for Nihal in Firebase...\n');
  
  const nihalSnapshot = await db.collection('realplayers')
    .where('name', '>=', 'Nihal')
    .where('name', '<=', 'Nihal\uf8ff')
    .get();
  
  if (nihalSnapshot.empty) {
    console.log('❌ Could not find any players named Nihal');
    rl.close();
    return;
  }
  
  console.log('Found players:');
  const players = [];
  nihalSnapshot.forEach((doc, idx) => {
    const data = doc.data();
    players.push({ id: doc.id, ...data });
    console.log(`  ${idx + 1}. ${data.name} (ID: ${data.player_id})`);
  });
  
  console.log('\n');
  const nihalChoice = await question('Select Nihal (the kept player) by number: ');
  const nihalIndex = parseInt(nihalChoice) - 1;
  
  if (nihalIndex < 0 || nihalIndex >= players.length) {
    console.log('❌ Invalid selection');
    rl.close();
    return;
  }
  
  const nihal = players[nihalIndex];
  console.log(`\n✅ Selected: ${nihal.name} (${nihal.player_id})\n`);
  
  // Step 2: Get Nihal MK details
  console.log('2️⃣ Information about Nihal MK (deleted player):\n');
  
  const nihalMkId = await question('Enter player_id for Nihal MK (e.g., sspslpsl0123): ');
  const nihalMkEmail = await question('Enter email for Nihal MK (optional, press Enter to skip): ');
  const nihalMkPhone = await question('Enter phone for Nihal MK (optional, press Enter to skip): ');
  
  if (!nihalMkId.trim()) {
    console.log('❌ Player ID is required');
    rl.close();
    return;
  }
  
  // Step 3: Get stats from Neon
  console.log('\n3️⃣ Fetching stats from Neon...\n');
  
  const stats = await tournamentSql`
    SELECT 
      id,
      player_id,
      player_name,
      team,
      team_id,
      tournament_id,
      season_name,
      matches_played,
      goals,
      assists,
      clean_sheets,
      yellow_cards,
      red_cards,
      created_at
    FROM realplayerstats 
    WHERE player_id = ${nihal.player_id}
    ORDER BY created_at ASC
  `;
  
  if (stats.length === 0) {
    console.log('❌ No stats found for this player');
    rl.close();
    return;
  }
  
  console.log(`Found ${stats.length} stat record(s):\n`);
  stats.forEach((stat, idx) => {
    console.log(`${idx + 1}. Tournament: ${stat.season_name || stat.tournament_id}`);
    console.log(`   Team: ${stat.team || 'N/A'}`);
    console.log(`   Matches: ${stat.matches_played}, Goals: ${stat.goals}, Assists: ${stat.assists}`);
    console.log(`   Created: ${stat.created_at ? new Date(stat.created_at).toLocaleDateString() : 'Unknown'}`);
    console.log('');
  });
  
  // Step 4: Assign stats to each player
  console.log('4️⃣ Assign stats to players:\n');
  console.log('For each stat record, enter:');
  console.log('  - "1" to keep with Nihal');
  console.log('  - "2" to move to Nihal MK');
  console.log('  - "s" to split (if both played in same tournament)\n');
  
  const assignments = [];
  
  for (let i = 0; i < stats.length; i++) {
    const stat = stats[i];
    console.log(`\nStat ${i + 1}: ${stat.season_name || stat.tournament_id} - ${stat.team || 'N/A'}`);
    console.log(`   Matches: ${stat.matches_played}, Goals: ${stat.goals}`);
    
    const choice = await question('Assign to (1=Nihal, 2=Nihal MK, s=skip): ');
    
    if (choice === '1') {
      assignments.push({ stat, assignTo: 'nihal' });
      console.log('   ✅ Keeping with Nihal');
    } else if (choice === '2') {
      assignments.push({ stat, assignTo: 'nihalMk' });
      console.log('   ✅ Will move to Nihal MK');
    } else if (choice.toLowerCase() === 's') {
      console.log('   ⏭️  Skipped');
    }
  }
  
  // Step 5: Show summary and confirm
  const nihalStats = assignments.filter(a => a.assignTo === 'nihal');
  const nihalMkStats = assignments.filter(a => a.assignTo === 'nihalMk');
  
  console.log('\n' + '='.repeat(80));
  console.log('📋 DEMERGE SUMMARY');
  console.log('='.repeat(80));
  console.log(`\nNihal (${nihal.player_id}) will keep ${nihalStats.length} stat record(s)`);
  console.log(`Nihal MK (${nihalMkId.trim()}) will receive ${nihalMkStats.length} stat record(s)`);
  
  if (nihalMkStats.length === 0) {
    console.log('\n⚠️  Warning: No stats assigned to Nihal MK. Continue anyway?');
  }
  
  const confirm = await question('\n❓ Proceed with demerge? (type "yes" to confirm): ');
  
  if (confirm.toLowerCase() !== 'yes') {
    console.log('❌ Cancelled');
    rl.close();
    return;
  }
  
  console.log('\n🔄 Starting demerge process...\n');
  
  try {
    // Step 6: Create Nihal MK in Firebase
    console.log('5️⃣ Creating Nihal MK in Firebase...');
    
    const nihalMkData = {
      player_id: nihalMkId.trim(),
      name: 'Nihal MK',
      display_name: 'Nihal MK',
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
      ...(nihalMkEmail.trim() && { email: nihalMkEmail.trim() }),
      ...(nihalMkPhone.trim() && { phone: nihalMkPhone.trim() }),
      demerge_note: `Separated from ${nihal.player_id} on ${new Date().toISOString()}`,
      original_merge_source: nihal.player_id
    };
    
    const nihalMkDoc = await db.collection('realplayers').add(nihalMkData);
    console.log(`   ✅ Created Nihal MK (${nihalMkId.trim()})\n`);
    
    // Step 7: Update stats in Neon
    console.log('6️⃣ Updating stats in Neon...');
    
    let movedCount = 0;
    for (const assignment of assignments) {
      if (assignment.assignTo === 'nihalMk') {
        await tournamentSql`
          UPDATE realplayerstats
          SET 
            player_id = ${nihalMkId.trim()},
            player_name = 'Nihal MK',
            updated_at = NOW()
          WHERE id = ${assignment.stat.id}
        `;
        movedCount++;
      }
    }
    
    console.log(`   ✅ Moved ${movedCount} stat record(s) to Nihal MK\n`);
    
    // Step 8: Update Firebase stats references
    console.log('7️⃣ Updating Firebase realplayerstats references...');
    
    const firebaseStats = await db.collection('realplayerstats')
      .where('player_id', '==', nihal.player_id)
      .get();
    
    const batch = db.batch();
    let fbUpdated = 0;
    
    // Get tournament IDs that belong to Nihal MK
    const nihalMkTournamentIds = new Set(
      nihalMkStats.map(a => a.stat.tournament_id)
    );
    
    firebaseStats.forEach(doc => {
      const data = doc.data();
      if (nihalMkTournamentIds.has(data.tournament_id)) {
        batch.update(doc.ref, {
          player_id: nihalMkId.trim(),
          player_name: 'Nihal MK',
          updated_at: admin.firestore.FieldValue.serverTimestamp()
        });
        fbUpdated++;
      }
    });
    
    if (fbUpdated > 0) {
      await batch.commit();
      console.log(`   ✅ Updated ${fbUpdated} Firebase stat record(s)\n`);
    } else {
      console.log(`   ℹ️  No Firebase stats to update\n`);
    }
    
    console.log('✅ Demerge complete!\n');
    console.log('📝 Summary:');
    console.log(`   - Nihal (${nihal.player_id}): ${nihalStats.length} tournaments`);
    console.log(`   - Nihal MK (${nihalMkId.trim()}): ${nihalMkStats.length} tournaments`);
    console.log('\n📝 Next steps:');
    console.log('   1. Verify both players appear in your admin panel');
    console.log('   2. Upload photos for Nihal MK if needed');
    console.log('   3. Check player pages to confirm stats are correct\n');
    
  } catch (error) {
    console.error('❌ Error during demerge:', error);
    console.error(error.stack);
  }
  
  rl.close();
}

// Run the script
demergeNihalPlayers().catch(error => {
  console.error('Fatal error:', error);
  rl.close();
  process.exit(1);
});
