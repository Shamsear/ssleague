/**
 * Check Kopites S16 Player History
 * 
 * Verify if player_history has records for Kopites in Season 16
 */

require('dotenv').config({ path: '.env.local' });

const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.NEON_DATABASE_URL);

async function checkPlayerHistory() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║      CHECK KOPITES S16 PLAYER HISTORY                     ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  try {
    // Check for Kopites S16 records
    console.log('Checking player_history for Kopites (SSPSLT0023) Season 16...\n');

    const s16Records = await sql`
      SELECT 
        id,
        player_id,
        player_name,
        position,
        team_id,
        team_name,
        season_id,
        acquisition_type,
        acquisition_value,
        contract_start_season,
        contract_end_season,
        status,
        end_reason
      FROM player_history
      WHERE team_id = 'SSPSLT0023'
      AND season_id = 'SSPSLS16'
      ORDER BY acquisition_value DESC
    `;

    console.log(`Found ${s16Records.length} player_history records for Kopites S16\n`);

    if (s16Records.length > 0) {
      console.log('Records breakdown:\n');

      // Group by status
      const byStatus = {};
      s16Records.forEach(r => {
        const status = r.status || 'unknown';
        if (!byStatus[status]) byStatus[status] = [];
        byStatus[status].push(r);
      });

      Object.entries(byStatus).forEach(([status, records]) => {
        console.log(`${status.toUpperCase()}: ${records.length} players`);
      });

      console.log('\n' + '═'.repeat(60) + '\n');

      // Show all records
      console.log('All records:\n');
      s16Records.forEach((r, i) => {
        console.log(`${i + 1}. ${r.player_name} (${r.position})`);
        console.log(`   Status: ${r.status}${r.end_reason ? ` (${r.end_reason})` : ''}`);
        console.log(`   Contract: ${r.contract_start_season} → ${r.contract_end_season}`);
        console.log(`   Value: ${r.acquisition_value} eCoin`);
        console.log(`   Type: ${r.acquisition_type}`);
        console.log('');
      });
    } else {
      console.log('❌ No player_history records found for Kopites S16\n');
    }

    // Also check what's in footballplayers for comparison
    console.log('═'.repeat(60) + '\n');
    console.log('Checking footballplayers table for comparison...\n');

    const footballPlayers = await sql`
      SELECT 
        player_id,
        name,
        position,
        team_id,
        team_name,
        season_id,
        acquisition_value,
        is_sold,
        status
      FROM footballplayers
      WHERE team_id = 'SSPSLT0023'
      AND season_id = 'SSPSLS16'
      ORDER BY acquisition_value DESC
    `;

    console.log(`Found ${footballPlayers.length} footballplayers records for Kopites S16\n`);

    if (footballPlayers.length > 0) {
      footballPlayers.slice(0, 5).forEach((p, i) => {
        console.log(`${i + 1}. ${p.name} (${p.position}) - ${p.acquisition_value} eCoin`);
      });
      if (footballPlayers.length > 5) {
        console.log(`... and ${footballPlayers.length - 5} more\n`);
      }
    }

  } catch (error) {
    console.error('\n❌ Error:', error);
    throw error;
  }
}

checkPlayerHistory()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
