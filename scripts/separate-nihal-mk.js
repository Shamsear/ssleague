/**
 * Separate Nihal MK from Nihal
 * 
 * Both players currently share the same player_id in stats.
 * This script:
 * 1. Creates Nihal MK as a new player in Firebase with a new player_id
 * 2. Updates stats in Neon where player_name = 'Nihal MK' to use the new player_id
 * 
 * Usage: node scripts/separate-nihal-mk.js
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

// Readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => {
  return new Promise(resolve => rl.question(query, resolve));
};

async function separateNihalMK() {
  console.log('='.repeat(80));
  console.log('🔀 SEPARATE NIHAL MK FROM NIHAL');
  console.log('='.repeat(80));
  console.log('\nThis will create Nihal MK with a new player_id and update their stats.\n');
  
  // Step 1: Get new player_id for Nihal MK
  const nihalMkNewId = await question('Enter NEW player_id for Nihal MK (e.g., sspslpsl0157): ');
  if (!nihalMkNewId.trim()) {
    console.log('❌ Player ID required');
    rl.close();
    return;
  }
  
  const nihalMkEmail = await question('Enter email for Nihal MK (optional): ');
  const nihalMkPhone = await question('Enter phone for Nihal MK (optional): ');
  
  // Step 2: Check stats in Neon for "Nihal MK"
  console.log('\n🔍 Checking stats for "Nihal MK" in Neon...\n');
  
  const nihalMkStats = await tournamentSql`
    SELECT 
      id,
      player_id,
      player_name,
      team,
      tournament_id,
      matches_played
    FROM realplayerstats 
    WHERE player_name ILIKE '%Nihal MK%' OR player_name ILIKE '%Nihal Mk%'
    ORDER BY tournament_id
  `;
  
  if (nihalMkStats.length === 0) {
    console.log('❌ No stats found for "Nihal MK"');
    console.log('Checking for all Nihal stats...\n');
    
    const allNihalStats = await tournamentSql`
      SELECT 
        id,
        player_id,
        player_name,
        team,
        tournament_id,
        matches_played
      FROM realplayerstats 
      WHERE player_name ILIKE '%Nihal%'
      ORDER BY player_name, tournament_id
    `;
    
    console.log(`Found ${allNihalStats.length} stat records for players with "Nihal":\n`);
    allNihalStats.forEach(stat => {
      console.log(`- ${stat.player_name} (ID: ${stat.player_id}) - ${stat.tournament_id}`);
    });
    
    rl.close();
    return;
  }
  
  console.log(`Found ${nihalMkStats.length} stat record(s) for Nihal MK:\n`);
  
  const currentPlayerId = nihalMkStats[0].player_id;
  console.log(`Current player_id: ${currentPlayerId}`);
  console.log(`\nTournaments:`);
  nihalMkStats.forEach(stat => {
    console.log(`  - ${stat.tournament_id} (Team: ${stat.team || 'N/A'}, Matches: ${stat.matches_played})`);
  });
  
  // Step 3: Show summary
  console.log('\n' + '='.repeat(80));
  console.log('📋 SUMMARY');
  console.log('='.repeat(80));
  console.log(`\nWill create player:`);
  console.log(`  Name: Nihal MK`);
  console.log(`  New player_id: ${nihalMkNewId.trim()}`);
  if (nihalMkEmail.trim()) console.log(`  Email: ${nihalMkEmail.trim()}`);
  if (nihalMkPhone.trim()) console.log(`  Phone: ${nihalMkPhone.trim()}`);
  
  console.log(`\nWill update ${nihalMkStats.length} stat record(s):`);
  console.log(`  From player_id: ${currentPlayerId}`);
  console.log(`  To player_id: ${nihalMkNewId.trim()}`);
  
  const confirm = await question('\n❓ Proceed? (type "yes"): ');
  
  if (confirm.toLowerCase() !== 'yes') {
    console.log('❌ Cancelled');
    rl.close();
    return;
  }
  
  console.log('\n🔄 Processing...\n');
  
  try {
    // Step 4: Create Nihal MK in Firebase
    console.log('1️⃣ Creating Nihal MK in Firebase...');
    
    const nihalMkData = {
      player_id: nihalMkNewId.trim(),
      name: 'Nihal MK',
      display_name: 'Nihal MK',
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
      ...(nihalMkEmail.trim() && { email: nihalMkEmail.trim() }),
      ...(nihalMkPhone.trim() && { phone: nihalMkPhone.trim() })
    };
    
    await db.collection('realplayers').add(nihalMkData);
    console.log(`   ✅ Created Nihal MK (${nihalMkNewId.trim()})\n`);
    
    // Step 5: Update stats in Neon
    console.log('2️⃣ Updating stats in Neon...');
    
    await tournamentSql`
      UPDATE realplayerstats
      SET 
        player_id = ${nihalMkNewId.trim()},
        updated_at = NOW()
      WHERE player_name ILIKE '%Nihal MK%' OR player_name ILIKE '%Nihal Mk%'
    `;
    
    console.log(`   ✅ Updated ${nihalMkStats.length} stat record(s)\n`);
    
    // Step 6: Update Firebase stats if they exist
    console.log('3️⃣ Checking Firebase realplayerstats...');
    
    const fbStatsQuery = await db.collection('realplayerstats')
      .where('player_name', '==', 'Nihal MK')
      .get();
    
    if (!fbStatsQuery.empty) {
      const batch = db.batch();
      
      fbStatsQuery.forEach(doc => {
        batch.update(doc.ref, {
          player_id: nihalMkNewId.trim(),
          updated_at: admin.firestore.FieldValue.serverTimestamp()
        });
      });
      
      await batch.commit();
      console.log(`   ✅ Updated ${fbStatsQuery.size} Firebase stat record(s)\n`);
    } else {
      console.log(`   ℹ️  No Firebase stats found for Nihal MK\n`);
    }
    
    // Verify
    console.log('4️⃣ Verifying...');
    const verifyStats = await tournamentSql`
      SELECT COUNT(*) as count
      FROM realplayerstats 
      WHERE player_id = ${nihalMkNewId.trim()}
    `;
    
    console.log(`   ✅ Confirmed: ${verifyStats[0].count} stats now belong to player_id ${nihalMkNewId.trim()}\n`);
    
    console.log('✅ Complete!\n');
    console.log('📝 Next steps:');
    console.log('   1. Verify Nihal MK appears in player list');
    console.log('   2. Upload photo for Nihal MK');
    console.log('   3. Check both player pages to confirm stats are separated\n');
    
  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
  }
  
  rl.close();
}

// Run
separateNihalMK().catch(error => {
  console.error('Fatal error:', error);
  rl.close();
  process.exit(1);
});
