/**
 * Analyze Real Player Seasons for Takeover
 * 
 * Check what real players (SSCoin) exist for Kopites
 * and need to be transferred to TM Asgardians
 */

require('dotenv').config({ path: '.env.local' });

const { neon } = require('@neondatabase/serverless');

// Use TOURNAMENT database connection
const sql = neon(process.env.NEON_TOURNAMENT_DB_URL);

async function analyzeRealPlayers() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║      ANALYZE REAL PLAYER SEASONS FOR TAKEOVER             ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  try {
    // Check player_seasons table structure
    console.log('1️⃣  PLAYER_SEASONS TABLE STRUCTURE\n');
    
    const structure = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'player_seasons'
      ORDER BY ordinal_position
    `;
    
    console.log('Columns:');
    structure.forEach(col => {
      console.log(`   - ${col.column_name} (${col.data_type})`);
    });
    console.log('');

    // Check Kopites real players
    console.log('2️⃣  KOPITES REAL PLAYERS\n');
    
    const kopitesPlayers = await sql`
      SELECT *
      FROM player_seasons
      WHERE team_id = 'SSPSLT0023'
      ORDER BY season_id, player_name
    `;
    
    console.log(`Found ${kopitesPlayers.length} player_seasons records for Kopites\n`);
    
    if (kopitesPlayers.length > 0) {
      console.log('All records:');
      kopitesPlayers.forEach((p, i) => {
        console.log(`\n   ${i + 1}. ${p.player_name}`);
        console.log(`      Season: ${p.season_id}`);
        console.log(`      Status: ${p.status}`);
        console.log(`      Contract: ${p.contract_start_season} → ${p.contract_end_season}`);
        console.log(`      Value: ${p.acquisition_value}`);
        console.log(`      Type: ${p.acquisition_type}`);
      });
    }

    // Group by season
    console.log('\n\n3️⃣  BREAKDOWN BY SEASON\n');
    
    const bySeason = {};
    kopitesPlayers.forEach(p => {
      const season = p.season_id || 'unknown';
      if (!bySeason[season]) bySeason[season] = [];
      bySeason[season].push(p);
    });
    
    Object.entries(bySeason).forEach(([season, players]) => {
      console.log(`   ${season}: ${players.length} players`);
      const active = players.filter(p => p.status === 'active').length;
      const ended = players.filter(p => p.status !== 'active').length;
      console.log(`      Active: ${active}, Ended: ${ended}`);
    });

    // Check active contracts
    console.log('\n4️⃣  ACTIVE CONTRACTS\n');
    
    const activeContracts = kopitesPlayers.filter(p => p.status === 'active');
    
    console.log(`Found ${activeContracts.length} active contracts\n`);
    
    if (activeContracts.length > 0) {
      console.log('Active players:');
      activeContracts.forEach((p, i) => {
        console.log(`\n   ${i + 1}. ${p.player_name}`);
        console.log(`      Season: ${p.season_id}`);
        console.log(`      Contract: ${p.contract_start_season} → ${p.contract_end_season}`);
        console.log(`      Value: ${p.acquisition_value}`);
        console.log(`      Type: ${p.acquisition_type}`);
      });
    }

    // What needs to happen
    console.log('\n\n5️⃣  TAKEOVER PLAN\n');
    
    console.log('For each active player_seasons record:');
    console.log('   1. End the Kopites record:');
    console.log('      - Set status = "takeover"');
    console.log('      - Set end_date = NOW()');
    console.log('      - Set end_reason = "takeover"');
    console.log('      - Set contract_end_season = "SSPSLS17"');
    console.log('   2. Create new TM Asgardians record:');
    console.log('      - team_id = "SSPSLT0005"');
    console.log('      - team_name = "TM Asgardians"');
    console.log('      - season_id = "SSPSLS17"');
    console.log('      - acquisition_type = "takeover"');
    console.log('      - KEEP SAME contract_start_season');
    console.log('      - KEEP SAME contract_end_season');
    console.log('      - status = "active"\n');

    console.log(`Total records to process: ${activeContracts.length}\n`);

  } catch (error) {
    console.error('\n❌ Error during analysis:', error);
    throw error;
  }
}

analyzeRealPlayers()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
