/**
 * Create release transactions for eFootball players released mid-Season 16
 * 
 * This script:
 * 1. Finds each player in the footballplayers table
 * 2. Calculates refund based on remaining contract
 * 3. Updates player status to free_agent
 * 4. Updates team balance
 * 5. Creates transaction records
 */

const admin = require('firebase-admin');
const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

// Initialize Firebase Admin
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
const auctionSql = neon(process.env.DATABASE_URL); // footballplayers table
const tournamentSql = neon(process.env.NEON_TOURNAMENT_DB_URL); // teams table

// Released players data
const releasedPlayers = [
  {
    teamName: 'LA MASIA FC',
    teamId: 'SSPSLT0038', // Need to find this
    players: [
      'Jackson Tchatchoua',
      'Nicola Zalewski',
      'Andrej Kramarić'
    ]
  },
  {
    teamName: 'SKILL 555',
    teamId: 'SSPSLT0039', // Need to find this
    players: [
      'JACOB RAMSEY',
      'LEON BAILEY',
      'PAULINHO'
    ]
  },
  {
    teamName: 'KOPITES',
    teamId: 'SSPSLT0023',
    players: [
      'ANDER BARRENETXEA',
      'JULIO ENCISO'
    ]
  },
  {
    teamName: 'LEGENDS FC',
    teamId: 'SSPSLT0015',
    players: [
      'ILIMAN NDIAYE',
      'SIMON ADINGRA'
    ]
  },
  {
    teamName: 'LOS GALACTICOS',
    teamId: 'SSPSLT0021',
    players: [
      'PEDRO PORRO',
      'GIACOMO RASPADORI'
    ]
  },
  {
    teamName: 'VARSITY SOCCERS',
    teamId: 'SSPSLT0010',
    players: [
      'KEVIN DANSO',
      'DWIGHT McNEIL'
    ]
  },
  {
    teamName: 'LOS BLANCOS',
    teamId: 'SSPSLT0040', // Need to find this
    players: [
      'DI STEFFANO'
    ]
  },
  {
    teamName: 'PORTLAND TIMBERS',
    teamId: 'SSPSLT0026',
    players: [
      'Francisco conceicao',
      'Kim Min Jae'
    ]
  },
  {
    teamName: 'MANCHESTER UNITED',
    teamId: 'SSPSLT0041', // Need to find this
    players: [
      'PABLO BARRIOS',
      'NOUSSAIR MAZRAOUI'
    ]
  },
  {
    teamName: 'FC BARCELONA',
    teamId: 'SSPSLT0006',
    players: [
      'J. BRATHWAITH',
      'NICO GONZALEZ'
    ]
  },
  {
    teamName: 'QATAR GLADIATORS',
    teamId: 'SSPSLT0009',
    players: [
      'A.Zendejas'
    ]
  }
];

const seasonId = 'SSPSLS16';
const processedBy = 'system';
const processedByName = 'System (Mid-Season Release)';

/**
 * Calculate refund amount for released player (70% of remaining contract value)
 */
function calculateRefund(auctionValue, contractStartSeason, contractEndSeason, currentSeasonId) {
  const startNum = parseInt(contractStartSeason.replace(/\D/g, ''));
  const endNum = parseInt(contractEndSeason.replace(/\D/g, ''));
  const currentNum = parseInt(currentSeasonId.replace(/\D/g, ''));
  
  if (isNaN(startNum) || isNaN(endNum) || isNaN(currentNum)) {
    return 0;
  }
  
  const totalSeasons = endNum - startNum + 1;
  const remainingSeasons = Math.max(0, endNum - currentNum + 1);
  const remainingPercentage = remainingSeasons / totalSeasons;
  const refund = Math.floor(auctionValue * remainingPercentage * 0.7);
  
  return Math.max(0, refund);
}

/**
 * Find team ID by name
 */
async function findTeamId(teamName) {
  const teams = await tournamentSql`
    SELECT id, team_name FROM teams 
    WHERE LOWER(team_name) = LOWER(${teamName})
    LIMIT 1
  `;
  
  if (teams.length > 0) {
    return teams[0].id;
  }
  
  // Try partial match
  const partialMatch = await tournamentSql`
    SELECT id, team_name FROM teams 
    WHERE LOWER(team_name) LIKE LOWER(${'%' + teamName + '%'})
    LIMIT 1
  `;
  
  return partialMatch.length > 0 ? partialMatch[0].id : null;
}

/**
 * Process releases for one team
 */
async function processTeamReleases(teamData) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Processing: ${teamData.teamName}`);
  console.log(`${'='.repeat(60)}`);
  
  // Find team ID if not provided
  let teamId = teamData.teamId;
  if (!teamId || teamId.includes('Need to find')) {
    console.log(`🔍 Finding team ID for ${teamData.teamName}...`);
    teamId = await findTeamId(teamData.teamName);
    if (!teamId) {
      console.log(`❌ Team not found: ${teamData.teamName}`);
      return { success: false, teamName: teamData.teamName, error: 'Team not found' };
    }
    console.log(`✅ Found team ID: ${teamId}`);
  }
  
  const results = [];
  
  for (const playerName of teamData.players) {
    console.log(`\n  Processing: ${playerName}`);
    
    try {
      // Find player in footballplayers table
      const players = await auctionSql`
        SELECT * FROM footballplayers 
        WHERE LOWER(name) LIKE LOWER(${'%' + playerName + '%'})
          AND season_id = ${seasonId}
          AND team_id = ${teamId}
        LIMIT 1
      `;
      
      if (players.length === 0) {
        console.log(`    ❌ Player not found: ${playerName}`);
        results.push({ player: playerName, success: false, error: 'Not found' });
        continue;
      }
      
      const player = players[0];
      console.log(`    ✅ Found: ${player.name} (${player.player_id})`);
      console.log(`       Auction Value: ${player.auction_value || player.acquisition_value || 0}`);
      console.log(`       Contract: ${player.contract_start_season} - ${player.contract_end_season}`);
      
      // Calculate refund
      const auctionValue = player.auction_value || player.acquisition_value || 0;
      const refund = calculateRefund(
        auctionValue,
        player.contract_start_season || seasonId,
        player.contract_end_season || seasonId,
        seasonId
      );
      
      console.log(`       Refund: ${refund}`);
      
      // Get team_season document
      const teamSeasonDocId = `${teamId}_${seasonId}`;
      const teamSeasonRef = db.collection('team_seasons').doc(teamSeasonDocId);
      const teamSeasonSnap = await teamSeasonRef.get();
      
      if (!teamSeasonSnap.exists) {
        console.log(`    ❌ Team season not found: ${teamSeasonDocId}`);
        results.push({ player: playerName, success: false, error: 'Team season not found' });
        continue;
      }
      
      const teamSeasonData = teamSeasonSnap.data();
      const currentBalance = teamSeasonData.football_budget || 0;
      const newBalance = currentBalance + refund;
      
      console.log(`       Team Balance: ${currentBalance} → ${newBalance}`);
      
      // Update player status to free_agent
      await auctionSql`
        UPDATE footballplayers
        SET team_id = NULL,
            status = 'free_agent',
            is_sold = false,
            is_auction_eligible = true,
            updated_at = NOW()
        WHERE player_id = ${player.player_id} 
          AND season_id = ${seasonId}
      `;
      
      // Decrement football_players_count
      await tournamentSql`
        UPDATE teams
        SET football_players_count = GREATEST(football_players_count - 1, 0),
            updated_at = NOW()
        WHERE id = ${teamId}
      `;
      
      // Update team balance
      await teamSeasonRef.update({
        football_budget: newBalance,
        updated_at: new Date()
      });
      
      // Create financial transaction
      await db.collection('transactions').add({
        team_id: teamId,
        season_id: seasonId,
        transaction_type: 'release_refund',
        currency_type: 'football',
        amount: refund,
        balance_before: currentBalance,
        balance_after: newBalance,
        description: `Released ${player.name} - Refund received`,
        metadata: {
          player_id: player.player_id,
          player_name: player.name,
          player_type: 'football',
          refund_amount: refund
        },
        created_at: new Date(),
        updated_at: new Date()
      });
      
      // Create player transaction record
      await db.collection('player_transactions').add({
        transaction_type: 'release',
        player_id: player.player_id,
        player_name: player.name,
        player_type: 'football',
        team_id: teamId,
        season_id: seasonId,
        refund_amount: refund,
        auction_value: auctionValue,
        processed_by: processedBy,
        processed_by_name: processedByName,
        created_at: new Date()
      });
      
      console.log(`    ✅ Release complete`);
      results.push({ 
        player: player.name, 
        success: true, 
        refund: refund 
      });
      
    } catch (error) {
      console.log(`    ❌ Error: ${error.message}`);
      results.push({ player: playerName, success: false, error: error.message });
    }
  }
  
  return { teamName: teamData.teamName, teamId, results };
}

/**
 * Main function
 */
async function processAllReleases() {
  console.log('🚀 Starting eFootball Player Releases for Season 16');
  console.log(`   Season: ${seasonId}`);
  console.log(`   Teams: ${releasedPlayers.length}`);
  console.log(`   Total Players: ${releasedPlayers.reduce((sum, t) => sum + t.players.length, 0)}`);
  
  const allResults = [];
  
  for (const teamData of releasedPlayers) {
    const result = await processTeamReleases(teamData);
    allResults.push(result);
  }
  
  // Summary
  console.log(`\n\n${'='.repeat(60)}`);
  console.log('SUMMARY');
  console.log(`${'='.repeat(60)}`);
  
  let totalSuccess = 0;
  let totalFailed = 0;
  let totalRefund = 0;
  
  allResults.forEach(teamResult => {
    if (teamResult.results) {
      const success = teamResult.results.filter(r => r.success).length;
      const failed = teamResult.results.filter(r => !r.success).length;
      const refund = teamResult.results
        .filter(r => r.success)
        .reduce((sum, r) => sum + (r.refund || 0), 0);
      
      console.log(`\n${teamResult.teamName} (${teamResult.teamId || 'N/A'}):`);
      console.log(`  ✅ Success: ${success}`);
      console.log(`  ❌ Failed: ${failed}`);
      console.log(`  💰 Total Refund: ${refund}`);
      
      totalSuccess += success;
      totalFailed += failed;
      totalRefund += refund;
    }
  });
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Total Success: ${totalSuccess}`);
  console.log(`Total Failed: ${totalFailed}`);
  console.log(`Total Refunds: ${totalRefund}`);
  console.log(`${'='.repeat(60)}\n`);
}

// Run the script
processAllReleases()
  .then(() => {
    console.log('✅ Script completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
