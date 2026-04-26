/**
 * Fix team_name in player_history for swapped players
 * 
 * Changes team_name from league team name (e.g., "Varsity Soccers")
 * to real-world club name (e.g., "Bayern Munich")
 */

const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.NEON_AUCTION_DB_URL || process.env.DATABASE_URL || process.env.NEON_DATABASE_URL);

async function fixSwapTeamNames() {
  console.log('🔧 Fixing team_name in player_history for swapped players...\n');

  try {
    // Find all swap history records
    const historyRecords = await sql`
      SELECT id, player_id, player_name, team_id, team_name, acquisition_type, status, club
      FROM player_history
      WHERE acquisition_type = 'swap'
      ORDER BY acquisition_date DESC
    `;

    console.log(`Found ${historyRecords.length} swap history records\n`);

    if (historyRecords.length === 0) {
      console.log('✅ No records to fix!\n');
      return;
    }

    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const record of historyRecords) {
      console.log(`\n📋 Processing: ${record.player_name} (${record.player_id})`);
      console.log(`   History ID: ${record.id}`);
      console.log(`   Current team_name: ${record.team_name}`);
      console.log(`   Club field: ${record.club}`);

      try {
        // Fetch current player data to get the team_name (real-world club)
        const playerData = await sql`
          SELECT team_name
          FROM footballplayers
          WHERE player_id = ${record.player_id}
          LIMIT 1
        `;

        if (playerData.length === 0) {
          console.log(`   ⚠️  Player not found in footballplayers table`);
          errorCount++;
          continue;
        }

        const player = playerData[0];
        const correctTeamName = player.team_name || 'Unknown Club';

        // Check if already correct
        if (record.team_name === correctTeamName) {
          console.log(`   ⏭️  Already correct (${correctTeamName})`);
          skippedCount++;
          continue;
        }

        // Update the team_name to use real-world club from footballplayers.team_name
        await sql`
          UPDATE player_history
          SET 
            team_name = ${correctTeamName},
            updated_at = NOW()
          WHERE id = ${record.id}
        `;

        console.log(`   ✅ Updated: ${record.team_name} → ${correctTeamName}`);
        updatedCount++;

      } catch (error) {
        console.error(`   ❌ Error updating record:`, error.message);
        errorCount++;
      }
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log('📊 Summary');
    console.log('='.repeat(80));
    console.log(`   ✅ Records updated: ${updatedCount}`);
    console.log(`   ⏭️  Already correct: ${skippedCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   📋 Total processed: ${historyRecords.length}`);
    console.log('');

    if (updatedCount > 0) {
      console.log('🎉 Team names fixed successfully!\n');
      console.log('Note: team_name now shows real-world club (e.g., "Bayern Munich")');
      console.log('      team_id still shows league team (e.g., "SSPSLT0010")\n');
    }

  } catch (error) {
    console.error('❌ Fatal error:', error);
    console.error(error.stack);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

fixSwapTeamNames();
