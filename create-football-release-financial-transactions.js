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
  
  // LOS BLANCOS
  { teamName: 'LOS BLANCOS', playerName: 'Di Stéfano' },
  
  // PORTLAND TIMBERS
  { teamName: 'PORTLAND TIMBERS', playerName: 'Francisco Conceição' },
  { teamName: 'PORTLAND TIMBERS', playerName: 'Kim Min-jae' },
  
  // MANCHESTER UNITED
  { teamName: 'MANCHESTER UNITED', playerName: 'Pablo Barrios' },
  { teamName: 'MANCHESTER UNITED', playerName: 'Noussair Mazraoui' },
  
  // FC BARCELONA
  { teamName: 'FC BARCELONA', playerName: 'J. Branthwaite' },
  { teamName: 'FC BARCELONA', playerName: 'Nico González' },
  
  // QATAR GLADIATORS
  { teamName: 'QATAR GLADIATORS', playerName: 'A. Zendejas' }
];

async function createFinancialTransactions() {
  try {
    console.log('Creating financial transaction records for released eFootball players...\n');
    console.log('='.repeat(80));
    
    const seasonId = 'SSPSLS16';
    const releaseDate = new Date('2024-06-15'); // Mid-season 16
    
    const found = [];
    const notFound = [];
    const created = [];
    
    // First, find all players
    for (const release of releasedPlayers) {
      const searchName = release.playerName.toLowerCase();
      
      const players = await sql`
        SELECT 
          player_id,
          name,
          team_id,
          team_name,
          acquisition_value
        FROM footballplayers
        WHERE LOWER(name) LIKE ${`%${searchName}%`}
        ORDER BY season_id DESC
        LIMIT 1
      `;
      
      if (players.length > 0) {
        found.push({
          ...release,
          player: players[0]
        });
      } else {
        notFound.push(release);
      }
    }
    
    console.log(`Found ${found.length} players, ${notFound.length} not found\n`);
    
    // Get team IDs from Firebase
    const teamMap = new Map();
    const teamsSnapshot = await db.collection('teams').get();
    teamsSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.team_name) {
        teamMap.set(data.team_name.toUpperCase(), doc.id);
      }
    });
    
    console.log(`Loaded ${teamMap.size} teams from Firebase\n`);
    
    // Create financial transactions in the transactions collection
    for (const item of found) {
      const player = item.player;
      const teamId = teamMap.get(item.teamName.toUpperCase());
      
      if (!teamId) {
        console.log(`⚠️  Team not found: ${item.teamName} - skipping ${player.name}`);
        continue;
      }
      
      // Calculate refund (70% of acquisition value)
      const refundAmount = player.acquisition_value ? Math.floor(player.acquisition_value * 0.7) : 0;
      
      // Assume balance before was 0 (we don't have historical balance data)
      const balanceBefore = 0;
      const balanceAfter = refundAmount;
      
      try {
        // Create financial transaction record
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
        created.push(player.name);
        
      } catch (error) {
        console.error(`❌ Error creating transaction for ${player.name}:`, error.message);
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log(`\n✅ Successfully created ${created.length} financial transaction records`);
    
    if (notFound.length > 0) {
      console.log(`\n⚠️  ${notFound.length} players not found in database:`);
      notFound.forEach(p => console.log(`  - ${p.playerName} (${p.teamName})`));
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

createFinancialTransactions();
