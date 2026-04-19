const { neon } = require('@neondatabase/serverless');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

async function createDistefanoBid() {
  console.log('Creating bid for Filippo Distefano...\n');
  console.log('='.repeat(80));
  
  // First, find Antoine Griezmann's bid to get the dates and structure
  console.log('Looking for Antoine Griezmann bid...\n');
  
  const griezmannBids = await sql`
    SELECT *
    FROM bids
    WHERE player_id IN (
      SELECT id FROM footballplayers WHERE LOWER(name) LIKE '%griezmann%'
    )
    AND status = 'won'
    AND season_id = 'SSPSLS16'
    ORDER BY created_at DESC
    LIMIT 1
  `;
  
  if (griezmannBids.length === 0) {
    console.log('❌ No Griezmann bid found. Using default dates.');
  } else {
    const griezmann = griezmannBids[0];
    console.log('✅ Found Griezmann bid:');
    console.log(`   Round: ${griezmann.round_id}`);
    console.log(`   Team: ${griezmann.team_name}`);
    console.log(`   Created: ${griezmann.created_at}`);
    console.log(`   Submitted: ${griezmann.submitted_at}`);
  }
  
  // Get Filippo Distefano's ID
  const distefano = await sql`
    SELECT id, player_id, name
    FROM footballplayers
    WHERE LOWER(name) LIKE '%distefano%'
    LIMIT 1
  `;
  
  if (distefano.length === 0) {
    console.log('\n❌ Filippo Distefano not found');
    process.exit(1);
  }
  
  console.log(`\n✅ Found player: ${distefano[0].name} (ID: ${distefano[0].id})`);
  
  // Get Los Blancos team ID from Firebase
  const admin = require('firebase-admin');
  
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
  const teamsSnapshot = await db.collection('teams').get();
  
  let teamId = null;
  let teamName = null;
  
  teamsSnapshot.forEach(doc => {
    const data = doc.data();
    if (data.team_name && data.team_name.toUpperCase().includes('LOS BLANCOS')) {
      teamId = doc.id;
      teamName = data.team_name;
    }
  });
  
  if (!teamId) {
    console.log('\n❌ Los Blancos team not found');
    process.exit(1);
  }
  
  console.log(`✅ Found team: ${teamName} (ID: ${teamId})`);
  
  // Use Griezmann's dates or default
  const referenceDate = griezmannBids.length > 0 ? griezmannBids[0].created_at : new Date('2024-01-15');
  const roundId = griezmannBids.length > 0 ? griezmannBids[0].round_id : 'SSPSLFR00001';
  
  // Create the bid
  const bidId = uuidv4();
  
  const newBid = {
    id: bidId,
    round_id: roundId,
    team_id: teamId,
    team_name: teamName,
    player_id: distefano[0].id,
    amount: 390,
    actual_bid_amount: 390,
    encrypted_bid_data: null,
    status: 'won',
    phase: 'incomplete',
    submitted_at: referenceDate,
    created_at: referenceDate,
    updated_at: referenceDate,
    season_id: 'SSPSLS16'
  };
  
  console.log('\n' + '='.repeat(80));
  console.log('\nCreating bid with the following details:');
  console.log(`  Bid ID: ${bidId}`);
  console.log(`  Player: ${distefano[0].name} (${distefano[0].id})`);
  console.log(`  Team: ${teamName}`);
  console.log(`  Amount: 390`);
  console.log(`  Status: won`);
  console.log(`  Phase: incomplete`);
  console.log(`  Round: ${roundId}`);
  console.log(`  Season: SSPSLS16`);
  console.log(`  Date: ${referenceDate}`);
  
  try {
    await sql`
      INSERT INTO bids (
        id, round_id, team_id, team_name, player_id, amount, actual_bid_amount,
        encrypted_bid_data, status, phase, submitted_at, created_at, updated_at, season_id
      ) VALUES (
        ${bidId}, ${roundId}, ${teamId}, ${teamName},
        ${distefano[0].id}, ${390}, ${390}, ${null}, ${'won'}, ${'incomplete'},
        ${referenceDate}, ${referenceDate}, ${referenceDate}, ${'SSPSLS16'}
      )
    `;
    
    console.log('\n✅ Bid created successfully!');
    
  } catch (error) {
    console.error('\n❌ Error creating bid:', error);
    process.exit(1);
  }
  
  console.log('\n' + '='.repeat(80));
  
  process.exit(0);
}

createDistefanoBid().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
