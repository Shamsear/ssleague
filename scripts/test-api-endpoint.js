/**
 * Test the actual API endpoint logic
 */

require('dotenv').config({ path: '.env.local' });

const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.NEON_DATABASE_URL);

async function testAPI() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║         TEST API ENDPOINT LOGIC                           ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const teamId = 'SSPSLT0023';
  const seasonId = 'SSPSLS16';

  try {
    // Step 1: Try footballplayers query
    console.log('1️⃣  FOOTBALLPLAYERS QUERY\n');
    
    const players = await sql`
      SELECT 
        id,
        player_id,
        name as player_name,
        position,
        acquisition_value as purchase_price,
        season_id
      FROM footballplayers
      WHERE team_id = ${teamId}
        AND (
          (contract_start_season <= ${seasonId} AND contract_end_season >= ${seasonId})
          OR season_id = ${seasonId}
        )
        AND status != 'released'
      ORDER BY name ASC
    `;
    
    console.log(`Found ${players.length} players in footballplayers\n`);

    // Step 2: If no players, try player_history
    if (players.length === 0) {
      console.log('2️⃣  PLAYER_HISTORY FALLBACK QUERY\n');
      
      const historyPlayers = await sql`
        SELECT 
          id,
          player_id,
          player_name,
          position,
          acquisition_value as purchase_price,
          season_id,
          status
        FROM player_history
        WHERE team_id = ${teamId}
          AND season_id = ${seasonId}
        ORDER BY player_name ASC
      `;
      
      console.log(`Found ${historyPlayers.length} players in player_history\n`);
      
      if (historyPlayers.length > 0) {
        console.log('Sample players:');
        historyPlayers.slice(0, 5).forEach((p, i) => {
          console.log(`   ${i + 1}. ${p.player_name} (${p.position}) - ${p.purchase_price} eCoin`);
          console.log(`      Status: ${p.status}`);
        });
      }
    }

  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  }
}

testAPI()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
