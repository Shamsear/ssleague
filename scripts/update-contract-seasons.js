/**
 * Update player_history with contract season information from footballplayers
 */

require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.NEON_DATABASE_URL);

async function updateContracts() {
  console.log('\n🔄 Updating contract seasons in player_history...\n');

  try {
    // Get all active history records
    const activeRecords = await sql`
      SELECT id, player_id, team_id, season_id
      FROM player_history
      WHERE status = 'active'
    `;

    console.log(`Found ${activeRecords.length} active records to update\n`);

    let updated = 0;
    let notFound = 0;

    for (const record of activeRecords) {
      // Get contract info from footballplayers
      const player = await sql`
        SELECT contract_start_season, contract_end_season
        FROM footballplayers
        WHERE player_id = ${record.player_id}
        AND team_id = ${record.team_id}
        AND season_id = ${record.season_id}
        LIMIT 1
      `;

      if (player.length > 0 && player[0].contract_start_season) {
        await sql`
          UPDATE player_history
          SET 
            contract_start_season = ${player[0].contract_start_season},
            contract_end_season = ${player[0].contract_end_season}
          WHERE id = ${record.id}
        `;
        updated++;
        
        if (updated % 50 === 0) {
          console.log(`Progress: ${updated} records updated...`);
        }
      } else {
        notFound++;
      }
    }

    console.log('\n✅ Update complete!');
    console.log(`   Updated: ${updated} records`);
    console.log(`   No contract info: ${notFound} records\n`);

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

updateContracts()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
