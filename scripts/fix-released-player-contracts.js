/**
 * Fix contract seasons for released players
 * Released players: S16 start → S16.5 (mid-season)
 */

require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.NEON_DATABASE_URL);

async function fixContracts() {
  console.log('\n🔄 Fixing contract seasons for released players...\n');

  try {
    // Update all released players to have S16 → S16.5 contracts
    const result = await sql`
      UPDATE player_history
      SET 
        contract_start_season = 'SSPSLS16',
        contract_end_season = 'SSPSLS16.5'
      WHERE status = 'released'
      AND season_id = 'SSPSLS16'
    `;

    console.log(`✅ Updated ${result.count} released player contracts`);
    console.log('   Contract: SSPSLS16 → SSPSLS16.5 (mid-season)\n');

    // Show sample
    const sample = await sql`
      SELECT player_name, team_name, contract_start_season, contract_end_season, end_date
      FROM player_history
      WHERE status = 'released'
      LIMIT 5
    `;

    console.log('Sample released players:');
    sample.forEach(p => {
      console.log(`  ${p.player_name} (${p.team_name})`);
      console.log(`    Contract: ${p.contract_start_season} → ${p.contract_end_season}`);
      console.log(`    Released: ${p.end_date}\n`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

fixContracts()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
