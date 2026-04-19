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

// List of released players organized by team
const releasedPlayers = [
  // LA MASIA FC
  { teamName: 'LA MASIA FC', playerName: 'Jackson Tchatchoua' },
  { teamName: 'LA MASIA FC', playerName: 'Nicola Zalewski' },
  { teamName: 'LA MASIA FC', playerName: 'Andrej Kramarić' },
  
  // SKILL 555
  { teamName: 'SKILL 555', playerName: 'Jacob Ramsey' },
  { teamName: 'SKILL 555', playerName: 'Leon Bailey' },
  { teamName: 'SKILL 555', playerName: 'Paulinho' },
  
  // KOPITES
  { teamName: 'KOPITES', playerName: 'Ander Barrenetxea' },
  { teamName: 'KOPITES', playerName: 'Julio Enciso' },
  
  // LEGENDS FC
  { teamName: 'LEGENDS FC', playerName: 'Iliman Ndiaye' },
  { teamName: 'LEGENDS FC', playerName: 'Simon Adingra' },
  
  // LOS GALACTICOS
  { teamName: 'LOS GALACTICOS', playerName: 'Pedro Porro' },
  { teamName: 'LOS GALACTICOS', playerName: 'Giacomo Raspadori' },
  
  // VARSITY SOCCERS
  { teamName: 'VARSITY SOCCERS', playerName: 'Kevin Danso' },
  { teamName: 'VARSITY SOCCERS', playerName: 'Dwight McNeil' },
  
  // PORTLAND TIMBERS
  { teamName: 'PORTLAND TIMBERS', playerName: 'Francisco Conceição' },
  { teamName: 'PORTLAND TIMBERS', playerName: 'Kim Min-jae' },
  
  // MANCHESTER UNITED
  { teamName: 'MANCHESTER UNITED', playerName: 'Pablo Barrios' },
  { teamName: 'MANCHESTER UNITED', playerName: 'Noussair Mazraoui' },
  
  // FC BARCELONA
  { teamName: 'FC BARCELONA', playerName: 'Jarrad Branthwaite' },
  { teamName: 'FC BARCELONA', playerName: 'Nico González' },
  
  // QATAR GLADIATORS
  { teamName: 'QATAR GLADIATORS', playerName: 'Álex Zendejas' }
];

async function recreateTransactions() {
  try {
    console.log('Step 1: Deleting old incorrectly structured transactions...\n');
    console.log('='.repeat(80));
    
    // Delete old transactions (those with metadata.player_name)
    const oldSnapshot = await db.collection('transactions')
      .where('transaction_type', '==', 'release')
      .where('season_id', '==', 'SSPSLS16')
      .get();
    
    const toDelete = [];
    oldSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.metadata?.player_name) {
        toDelete.push(doc.ref);
        console.log(`  Marking for deletion: ${data.metadata.player_name} (${doc.id})`);
      }
    });
    
    console.log(`\nDeleting ${toDelete.length} old transactions...`);
    const deleteBatch = db.batch();
    toDelete.forEach(ref => deleteBatch.delete(ref));
    await deleteBatch.commit();
    console.log('✅ Old transactions deleted\n');
    
    console.log('='.repeat(80));
    console.log('\nStep 2: Creating new transactions with correct structure...\n');
    
    const seasonId = 'SSPSLS16';
    const releaseDate = new Date('2024-06-15'); // Mid-season 16
    
    // Get team IDs and names from Firebase
    const teamMap = new Map();
    const teamsSnapshot = await db.collection('teams').get();
    teamsSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.team_name) {
        teamMap.set(data.team_name.toUpperCase(), {
          id: doc.id,
          name: data.team_name
        });
      }
    });
    
    const created = [];
    const notFound = [];
    
    for (const release of releasedPlayers) {
      const searchName = release.playerName.toLowerCase();
      
      // Find player in database
      const players = await sql`
        SELECT 
          player_id,
          name,
          acquisition_value
        FROM footballplayers
        WHERE LOWER(name) LIKE ${`%${searchName}%`}
        ORDER BY season_id DESC
        LIMIT 1
      `;
      
      if (players.length === 0) {
        notFound.push(release.playerName);
        console.log(`⚠️  Player not found: ${release.playerName}`);
        continue;
      }
      
      const player = players[0];
      const teamInfo = teamMap.get(release.teamName.toUpperCase());
      
      if (!teamInfo) {
        console.log(`⚠️  Team not found: ${release.teamName}`);
        continue;
      }
      
      // Calculate refund (70% of acquisition value for mid-season release)
      const auctionValue = player.acquisition_value || 0;
      const refundAmount = Math.floor(auctionValue * 0.7);
      const refundPercentage = 70;
      
      try {
        // Create transaction with same structure as existing ones
        const transactionRef = await db.collection('transactions').add({
          transaction_type: 'release',
          player_id: player.player_id,
          player_name: player.name,
          player_type: 'football',
          team_id: teamInfo.id,
          team_name: teamInfo.name,
          season_id: seasonId,
          release_timing: 'mid',
          release_season: 'SSPSLS16.5',
          refund_amount: refundAmount,
          refund_percentage: refundPercentage,
          auction_value: auctionValue,
          original_contract_start: seasonId,
          original_contract_end: seasonId,
          total_half_seasons: 1,
          elapsed_half_seasons: 1,
          remaining_half_seasons: 0,
          processed_by: 'system',
          processed_by_name: 'Historical Import',
          created_at: releaseDate
        });
        
        console.log(`✅ ${release.teamName}: ${player.name} - Refund: ${refundAmount} (${transactionRef.id})`);
        created.push(player.name);
        
      } catch (error) {
        console.error(`❌ Error creating transaction for ${player.name}:`, error.message);
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log(`\n✅ Successfully created ${created.length} transactions with correct structure`);
    
    if (notFound.length > 0) {
      console.log(`\n⚠️  ${notFound.length} players not found:`);
      notFound.forEach(p => console.log(`  - ${p}`));
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

recreateTransactions();
