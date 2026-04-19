/**
 * Check all player_history records for Kopites
 */

require('dotenv').config({ path: '.env.local' });

const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.NEON_DATABASE_URL);

async function checkKopites() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║         CHECK KOPITES PLAYER_HISTORY                      ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  try {
    const allKopites = await sql`
      SELECT season_id, status, COUNT(*) as count
      FROM player_history
      WHERE team_id = 'SSPSLT0023'
      GROUP BY season_id, status
      ORDER BY season_id, status
    `;
    
    console.log('Kopites player_history records:\n');
    
    allKopites.forEach(row => {
      console.log(`   ${row.season_id} - ${row.status}: ${row.count} players`);
    });
    
    console.log('\n\nDetailed S16 records:\n');
    
    const s16Details = await sql`
      SELECT player_name, status, end_reason, contract_start_season, contract_end_season
      FROM player_history
      WHERE team_id = 'SSPSLT0023'
      AND season_id = 'SSPSLS16'
      LIMIT 5
    `;
    
    s16Details.forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.player_name}`);
      console.log(`      Status: ${p.status}`);
      console.log(`      End Reason: ${p.end_reason}`);
      console.log(`      Contract: ${p.contract_start_season} → ${p.contract_end_season}`);
    });

  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  }
}

checkKopites()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
