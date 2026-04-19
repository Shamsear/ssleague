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

async function createDistefanoTransaction() {
  console.log('Creating release transaction for Filippo Distefano...\n');
  console.log('='.repeat(80));
  
  const playerName = 'Filippo Distefano';
  const teamName = 'LOS BLANCOS';
  const auctionValue = 390;
  const refund75 = Math.floor(auctionValue * 0.75); // 292
  const seasonId = 'SSPSLS16';
  const releaseDate = new Date('2024-06-15');
  
  // Find player in database
  const players = await sql`
    SELECT id, player_id, name, team_name
    FROM footballplayers
    WHERE LOWER(name) LIKE '%distefano%'
    LIMIT 5
  `;
  
  console.log(`Found ${players.length} players matching "Distefano":\n`);
  players.forEach(p => {
    console.log(`  - ${p.name} (ID: ${p.id}, Team: ${p.team_name})`);
  });
  
  if (players.length === 0) {
    console.log('\n❌ Player not found in database');
    process.exit(1);
  }
  
  const player = players[0]; // Filippo Distefano
  
  // Get team ID from Firebase
  const teamsSnapshot = await db.collection('teams').get();
  let teamId = null;
  
  teamsSnapshot.forEach(doc => {
    const data = doc.data();
    if (data.team_name && data.team_name.toUpperCase() === teamName.toUpperCase()) {
      teamId = doc.id;
    }
  });
  
  if (!teamId) {
    console.log(`\n❌ Team not found: ${teamName}`);
    process.exit(1);
  }
  
  console.log(`\n✅ Found team: ${teamName} (${teamId})`);
  console.log(`✅ Found player: ${player.name} (${player.id})`);
  
  // Create the transaction
  try {
    const transactionRef = await db.collection('transactions').add({
      transaction_type: 'release',
      player_id: player.id,
      player_name: player.name,
      player_type: 'football',
      team_id: teamId,
      team_name: teamName,
      season_id: seasonId,
      release_timing: 'mid',
      release_season: 'SSPSLS16.5',
      refund_amount: refund75,
      refund_percentage: 75,
      auction_value: auctionValue,
      original_contract_start: seasonId,
      original_contract_end: seasonId,
      total_half_seasons: 1,
      elapsed_half_seasons: 1,
      remaining_half_seasons: 0,
      processed_by: 'system',
      processed_by_name: 'Historical Import',
      created_at: releaseDate,
      updated_at: releaseDate
    });
    
    console.log('\n' + '='.repeat(80));
    console.log('\n✅ Transaction created successfully!');
    console.log(`   Transaction ID: ${transactionRef.id}`);
    console.log(`   Player: ${player.name}`);
    console.log(`   Team: ${teamName}`);
    console.log(`   Auction Value: ${auctionValue} coins`);
    console.log(`   Refund (75%): ${refund75} coins`);
    
  } catch (error) {
    console.error('\n❌ Error creating transaction:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

createDistefanoTransaction().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
