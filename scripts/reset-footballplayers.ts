import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local file
config({ path: resolve(process.cwd(), '.env.local') });

import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ No DATABASE_URL found');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function resetFootballPlayers() {
  console.log('🔄 Starting footballplayers table reset...\n');

  try {
    // Step 1: Delete all team_players records
    console.log('🗑️  Deleting all records from team_players...');
    const deleteResult = await sql`DELETE FROM team_players RETURNING player_id`;
    console.log(`✅ Deleted ${deleteResult.length} player assignments\n`);

    // Step 2: Reset all footballplayers to available
    console.log('🔄 Resetting footballplayers table...');
    const resetResult = await sql`
      UPDATE footballplayers
      SET 
        is_sold = false,
        team_id = NULL,
        acquisition_value = NULL,
        season_id = NULL,
        round_id = NULL,
        status = 'available',
        contract_id = NULL,
        contract_start_season = NULL,
        contract_end_season = NULL,
        contract_length = NULL,
        updated_at = NOW()
      WHERE is_sold = true
      RETURNING id, name
    `;
    
    console.log(`✅ Reset ${resetResult.length} players to available status\n`);
    
    if (resetResult.length > 0) {
      console.log('Players reset:');
      resetResult.forEach((player, idx) => {
        if (idx < 10) { // Show first 10
          console.log(`   - ${player.name} (${player.id})`);
        }
      });
      if (resetResult.length > 10) {
        console.log(`   ... and ${resetResult.length - 10} more`);
      }
    }

    // Step 3: Verification
    console.log('\n🔍 Verifying updates...');
    
    const verifyResult = await sql`
      SELECT 
        COUNT(*) as total_players,
        SUM(CASE WHEN is_sold = false THEN 1 ELSE 0 END) as available_players,
        SUM(CASE WHEN is_sold = true THEN 1 ELSE 0 END) as sold_players
      FROM footballplayers
    `;
    
    const stats = verifyResult[0];
    console.log(`\nFootballplayers Stats:`);
    console.log(`   Total players: ${stats.total_players}`);
    console.log(`   Available: ${stats.available_players}`);
    console.log(`   Sold: ${stats.sold_players}`);
    
    if (stats.sold_players === '0') {
      console.log('   ✅ All players are available!');
    } else {
      console.log(`   ⚠️  ${stats.sold_players} players still marked as sold`);
    }
    
    const teamPlayersCheck = await sql`SELECT COUNT(*) as count FROM team_players`;
    console.log(`\nTeam Players Count: ${teamPlayersCheck[0].count}`);
    
    if (teamPlayersCheck[0].count === '0') {
      console.log('   ✅ team_players table is empty!');
    } else {
      console.log(`   ⚠️  ${teamPlayersCheck[0].count} records still in team_players`);
    }

    console.log('\n🎉 Footballplayers reset complete!\n');
    console.log('Summary:');
    console.log(`   - Team assignments deleted: ${deleteResult.length}`);
    console.log(`   - Players reset to available: ${resetResult.length}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

resetFootballPlayers().then(() => {
  console.log('\n✅ Script completed successfully');
  process.exit(0);
}).catch((error) => {
  console.error('\n❌ Script failed:', error);
  process.exit(1);
});
