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

async function createMissingTransactions() {
  console.log('Creating transactions for missing players...\n');
  console.log('='.repeat(80));
  
  const seasonId = 'SSPSLS16';
  const releaseDate = new Date('2024-06-15');
  
  // Get team IDs from Firebase
  const teamMap = new Map();
  const teamsSnapshot = await db.collection('teams').get();
  teamsSnapshot.forEach(doc => {
    const data = doc.data();
    if (data.team_name) {
      teamMap.set(data.team_name.toUpperCase(), doc.id);
    }
  });
  
  const playersToCreate = [
    { name: 'Jarrad Branthwaite', teamName: 'FC BARCELONA' },
    { name: 'Álex Zendejas', teamName: 'QATAR GLADIATORS' }
  ];
  
  for (const item of playersToCreate) {
    // Find player in database
    const players = await sql`
      SELECT player_id, name, acquisition_value
      FROM footballplayers
      WHERE name = ${item.name}
      LIMIT 1
    `;
    
    if (players.length === 0) {
      console.log(`⚠️  Player not found: ${item.name}`);
      continue;
    }
    
    const player = players[0];
    const teamId = teamMap.get(item.teamName.toUpperCase());
    
    if (!teamId) {
      console.log(`⚠️  Team not found: ${item.teamName}`);
      continue;
    }
    
    const refundAmount = player.acquisition_value ? Math.floor(player.acquisition_value * 0.7) : 0;
    const balanceBefore = 0;
    const balanceAfter = refundAmount;
    
    try {
      const transactionRef = await db.collection('transactions').add({
        team_id: teamId,
        season_id: seasonId,
        transaction_type: 'release_refund',
        currency_type: 'football',
        amount: refundAmount,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        description: `Released ${player.name} - Refund received`,
        metadata: {
          player_id: player.player_id,
          player_name: player.name,
          player_type: 'football',
          refund_amount: refundAmount,
          original_acquisition_value: player.acquisition_value || 0,
          historical_import: true
        },
        created_at: releaseDate,
        updated_at: releaseDate
      });
      
      console.log(`✅ ${item.teamName}: ${player.name} - Refund: ${refundAmount} (${transactionRef.id})`);
      
    } catch (error) {
      console.error(`❌ Error creating transaction for ${player.name}:`, error.message);
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('\n✅ Completed creating transactions for found players');
  console.log('\n⚠️  Note: "Di Stéfano" was not found in the database');
  console.log('   This might be a nickname or incorrect name.');
  
  process.exit(0);
}

createMissingTransactions().catch(err => {
  console.error(err);
  process.exit(1);
});
