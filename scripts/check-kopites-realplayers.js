/**
 * Check Kopites Real Players in player_seasons
 */

require('dotenv').config({ path: '.env.local' });

const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.NEON_DATABASE_URL);

async function checkRealPlayers() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║         CHECK KOPITES REAL PLAYERS                        ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  try {
    // Check all Kopites player_seasons
    const players = await sql`
      SELECT *
      FROM player_seasons
      WHERE team_id = 'SSPSLT0023'
      ORDER BY season_id, player_name
    `;
    
    console.log(`Found ${players.length} player_seasons records for Kopites\n`);
    
    if (players.length === 0) {
      console.log('No real players found for Kopites.\n');
      return;
    }

    // Show all records
    console.log('All records:\n');
    players.forEach((p, i) => {
      console.log(`${i + 1}. ${p.player_name}`);
      console.log(`   Season: ${p.season_id}`);
      console.log(`   Team: ${p.team_name} (${p.team_id})`);
      console.log(`   Contract: ${p.contract_start_season || 'N/A'} → ${p.contract_end_season || 'N/A'}`);
      console.log(`   Value: ${p.auction_value || 0}`);
      console.log(`   Status: ${p.status || 'N/A'}`);
      console.log('');
    });

    // Group by status
    const active = players.filter(p => p.status === 'active');
    const inactive = players.filter(p => p.status !== 'active');
    
    console.log(`Active: ${active.length}, Inactive: ${inactive.length}\n`);

  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  }
}

checkRealPlayers()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
