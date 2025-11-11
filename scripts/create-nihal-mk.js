/**
 * Create Nihal MK Player and Reassign Stats
 * 
 * This script:
 * 1. Creates Nihal MK as a new player in Firebase
 * 2. Updates specific stats in Neon to point to Nihal MK instead of Nihal
 * 
 * Usage: node scripts/create-nihal-mk.js
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
console.log('✅ Neon Tournament DB initialized');

// Readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => {
  return new Promise(resolve => rl.question(query, resolve));
};

async function createNihalMK() {
  console.log('\n' + '='.repeat(80));
  console.log('➕ CREATE NIHAL MK PLAYER');
  console.log('='.repeat(80));
  console.log('\nThis will create Nihal MK and reassign their stats.\n');
  
  // Get Nihal MK details
  const nihalMkId = await question('Enter player_id for Nihal MK (e.g., sspslpsl0089): ');
  if (!nihalMkId.trim()) {
    console.log('❌ Player ID required');
    rl.close();
    return;
  }
  
  const nihalMkEmail = await question('Enter email for Nihal MK (optional): ');
  const nihalMkPhone = await question('Enter phone for Nihal MK (optional): ');
  
  // Get Nihal's ID
  console.log('\n');
  const nihalId = await question("Enter Nihal's player_id (whose stats need to be split): ");
  if (!nihalId.trim()) {
    console.log('❌ Nihal player ID required');
    rl.close();
    return;
  }
  
  // Show Nihal's current stats
  console.log('\n🔍 Fetching stats currently under Nihal...\n');
  
  const stats = await tournamentSql`
    SELECT 
      id,
      player_id,
      team,
      team_id,
      tournament_id,
      matches_played,
      goals,
      assists,
      created_at
    FROM realplayerstats 
    WHERE player_id = ${nihalId.trim()}
    ORDER BY created_at DESC
  `;
  
  if (stats.length === 0) {
    console.log('❌ No stats found for Nihal');
    rl.close();
    return;
  }
  
  console.log(`Found ${stats.length} stat record(s):\n`);
  stats.forEach((stat, idx) => {
    console.log(`${idx + 1}. Tournament: ${stat.tournament_id}`);
    console.log(`   Team: ${stat.team || 'N/A'}`);
    console.log(`   Stats: ${stat.matches_played} matches, ${stat.goals} goals, ${stat.assists} assists`);
    console.log('');
  });
  
  // Ask which stats belong to Nihal MK
  console.log('Enter the numbers of stats that belong to Nihal MK (comma-separated):');
  console.log('Example: 1,3,5 or just press Enter to skip reassignment\n');
  
  const selectedInput = await question('Stats for Nihal MK: ');
  
  let selectedStats = [];
  if (selectedInput.trim()) {
    const indices = selectedInput.split(',').map(s => parseInt(s.trim()) - 1);
    selectedStats = indices
      .filter(i => i >= 0 && i < stats.length)
      .map(i => stats[i]);
  }
  
  // Show summary
  console.log('\n' + '='.repeat(80));
  console.log('📋 SUMMARY');
  console.log('='.repeat(80));
  console.log(`\nWill create player:`);
  console.log(`  Name: Nihal MK`);
  console.log(`  ID: ${nihalMkId.trim()}`);
  if (nihalMkEmail.trim()) console.log(`  Email: ${nihalMkEmail.trim()}`);
  if (nihalMkPhone.trim()) console.log(`  Phone: ${nihalMkPhone.trim()}`);
  
  if (selectedStats.length > 0) {
    console.log(`\nWill reassign ${selectedStats.length} stat record(s) to Nihal MK:`);
    selectedStats.forEach(s => {
      console.log(`  - ${s.tournament_id} (${s.team || 'N/A'})`);
    });
  } else {
    console.log(`\n⚠️  No stats will be reassigned`);
  }
  
  const confirm = await question('\n❓ Proceed? (type "yes"): ');
  
  if (confirm.toLowerCase() !== 'yes') {
    console.log('❌ Cancelled');
    rl.close();
    return;
  }
  
  console.log('\n🔄 Processing...\n');
  
  try {
    // Step 1: Create Nihal MK in Firebase
    console.log('1️⃣ Creating Nihal MK in Firebase...');
    
    const nihalMkData = {
      player_id: nihalMkId.trim(),
      name: 'Nihal MK',
      display_name: 'Nihal MK',
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
      ...(nihalMkEmail.trim() && { email: nihalMkEmail.trim() }),
      ...(nihalMkPhone.trim() && { phone: nihalMkPhone.trim() })
    };
    
    await db.collection('realplayers').add(nihalMkData);
    console.log(`   ✅ Created Nihal MK (${nihalMkId.trim()})\n`);
    
    // Step 2: Update stats in Neon
    if (selectedStats.length > 0) {
      console.log('2️⃣ Updating stats in Neon...');
      
      for (const stat of selectedStats) {
        await tournamentSql`
          UPDATE realplayerstats
          SET 
            player_id = ${nihalMkId.trim()},
            player_name = 'Nihal MK',
            updated_at = NOW()
          WHERE id = ${stat.id}
        `;
      }
      
      console.log(`   ✅ Reassigned ${selectedStats.length} stat record(s)\n`);
      
      // Step 3: Update Firebase stats if they exist
      console.log('3️⃣ Checking Firebase realplayerstats...');
      
      const tournamentIds = selectedStats.map(s => s.tournament_id);
      
      if (tournamentIds.length > 0) {
        const fbStatsQuery = await db.collection('realplayerstats')
          .where('player_id', '==', nihalId.trim())
          .get();
        
        const batch = db.batch();
        let updated = 0;
        
        fbStatsQuery.forEach(doc => {
          const data = doc.data();
          if (tournamentIds.includes(data.tournament_id)) {
            batch.update(doc.ref, {
              player_id: nihalMkId.trim(),
              player_name: 'Nihal MK',
              updated_at: admin.firestore.FieldValue.serverTimestamp()
            });
            updated++;
          }
        });
        
        if (updated > 0) {
          await batch.commit();
          console.log(`   ✅ Updated ${updated} Firebase stat record(s)\n`);
        } else {
          console.log(`   ℹ️  No Firebase stats to update\n`);
        }
      }
    } else {
      console.log('2️⃣ Skipped stat reassignment\n');
    }
    
    console.log('✅ Complete!\n');
    console.log('📝 Next steps:');
    console.log('   1. Verify Nihal MK appears in player list');
    console.log('   2. Upload photo for Nihal MK');
    console.log('   3. Check player stats page to confirm\n');
    
  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
  }
  
  rl.close();
}

// Run
createNihalMK().catch(error => {
  console.error('Fatal error:', error);
  rl.close();
  process.exit(1);
});
