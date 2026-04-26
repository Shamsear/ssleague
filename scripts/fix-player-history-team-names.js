const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.NEON_DATABASE_URL);

async function fixPlayerHistoryTeamNames() {
  console.log('🔧 Starting to fix team_name in player_history table...\n');

  try {
    // Get all player_history records
    const historyRecords = await sql`
      SELECT 
        id,
        player_id,
        team_id,
        team_name as current_team_name,
        acquisition_type,
        acquisition_date
      FROM player_history
      ORDER BY acquisition_date DESC
    `;

    console.log(`📊 Found ${historyRecords.length} player_history records\n`);

    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const record of historyRecords) {
      try {
        // Get the player's real-world club name from footballplayers table
        const playerData = await sql`
          SELECT team_name
          FROM footballplayers
          WHERE player_id = ${record.player_id}
          LIMIT 1
        `;

        if (playerData.length === 0) {
          console.log(`⚠️  Player ${record.player_id} not found in footballplayers table`);
          skippedCount++;
          continue;
        }

        const realWorldClubName = playerData[0].team_name || 'Free Agents';

        // Check if update is needed
        if (record.current_team_name === realWorldClubName) {
          console.log(`✓ Player ${record.player_id}: team_name already correct (${realWorldClubName})`);
          skippedCount++;
          continue;
        }

        // Update the team_name
        await sql`
          UPDATE player_history
          SET team_name = ${realWorldClubName}
          WHERE id = ${record.id}
        `;

        console.log(`✅ Updated player ${record.player_id}:`);
        console.log(`   Old: ${record.current_team_name}`);
        console.log(`   New: ${realWorldClubName}`);
        console.log(`   Team ID: ${record.team_id}`);
        console.log(`   Type: ${record.acquisition_type}\n`);

        updatedCount++;
      } catch (error) {
        console.error(`❌ Error updating record ${record.id}:`, error.message);
        errorCount++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📈 Summary:');
    console.log(`   Total records: ${historyRecords.length}`);
    console.log(`   ✅ Updated: ${updatedCount}`);
    console.log(`   ⏭️  Skipped (already correct): ${skippedCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log('='.repeat(60));

    if (updatedCount > 0) {
      console.log('\n✨ Team names have been fixed!');
      console.log('   team_id = league team (e.g., SSPSLT0010)');
      console.log('   team_name = real-world club (e.g., "Bayern Munich")');
    }

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run the script
fixPlayerHistoryTeamNames()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
