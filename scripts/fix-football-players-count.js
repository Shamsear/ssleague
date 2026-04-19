/**
 * Fix football_players_count in teams table
 * Recalculates the count based on actual player assignments
 */

const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL || process.env.NEON_DATABASE_URL);

async function fixFootballPlayersCount() {
  console.log('🔧 Starting football_players_count fix...\n');

  try {
    // Get all teams
    const teams = await sql`
      SELECT id, name, season_id, football_players_count
      FROM teams
      ORDER BY season_id, name
    `;

    console.log(`📊 Found ${teams.length} teams\n`);

    let fixedCount = 0;
    let alreadyCorrect = 0;
    const updates = [];

    for (const team of teams) {
      // Count actual players assigned to this team (no season filter)
      const actualCount = await sql`
        SELECT COUNT(*) as count
        FROM footballplayers
        WHERE team_id = ${team.id}
        AND is_sold = true
      `;

      const actualPlayerCount = parseInt(actualCount[0]?.count || '0');
      const currentStoredCount = parseInt(team.football_players_count || '0');

      if (actualPlayerCount !== currentStoredCount) {
        console.log(`❌ ${team.name} (${team.id}) [${team.season_id}]:`);
        console.log(`   Stored: ${currentStoredCount}, Actual: ${actualPlayerCount}`);
        console.log(`   Difference: ${actualPlayerCount - currentStoredCount}`);

        updates.push({
          teamId: team.id,
          teamName: team.name,
          seasonId: team.season_id,
          oldCount: currentStoredCount,
          newCount: actualPlayerCount,
          difference: actualPlayerCount - currentStoredCount
        });

        fixedCount++;
      } else {
        console.log(`✅ ${team.name} [${team.season_id}]: ${currentStoredCount} players (correct)`);
        alreadyCorrect++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total teams checked: ${teams.length}`);
    console.log(`Already correct: ${alreadyCorrect}`);
    console.log(`Need fixing: ${fixedCount}`);
    console.log('='.repeat(60) + '\n');

    if (updates.length === 0) {
      console.log('✅ All teams have correct player counts! No updates needed.');
      return;
    }

    console.log('📋 Teams that need updating:');
    console.log('='.repeat(60));
    for (const update of updates) {
      console.log(`${update.teamName} (${update.teamId})`);
      console.log(`  ${update.oldCount} → ${update.newCount} (${update.difference > 0 ? '+' : ''}${update.difference})`);
    }
    console.log('='.repeat(60) + '\n');

    // Ask for confirmation
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const answer = await new Promise(resolve => {
      readline.question('Apply these fixes? (yes/no): ', resolve);
    });
    readline.close();

    if (answer.toLowerCase() !== 'yes') {
      console.log('\n❌ Aborted. No changes made.');
      return;
    }

    console.log('\n🔄 Applying fixes...\n');

    // Apply updates
    for (const update of updates) {
      await sql`
        UPDATE teams
        SET 
          football_players_count = ${update.newCount},
          updated_at = NOW()
        WHERE id = ${update.teamId}
        AND season_id = ${update.seasonId}
      `;

      console.log(`✅ Updated ${update.teamName}: ${update.oldCount} → ${update.newCount}`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ ALL FIXES APPLIED SUCCESSFULLY!');
    console.log('='.repeat(60));
    console.log(`Updated ${updates.length} team(s)`);

    // Verify the fixes
    console.log('\n🔍 Verifying fixes...\n');
    let verifyErrors = 0;

    for (const update of updates) {
      const verifyResult = await sql`
        SELECT football_players_count
        FROM teams
        WHERE id = ${update.teamId}
        AND season_id = ${update.seasonId}
      `;

      const newStoredCount = parseInt(verifyResult[0]?.football_players_count || '0');
      if (newStoredCount === update.newCount) {
        console.log(`✅ ${update.teamName}: Verified (${newStoredCount})`);
      } else {
        console.log(`❌ ${update.teamName}: Verification failed! Expected ${update.newCount}, got ${newStoredCount}`);
        verifyErrors++;
      }
    }

    if (verifyErrors === 0) {
      console.log('\n✅ All updates verified successfully!');
    } else {
      console.log(`\n⚠️ ${verifyErrors} verification error(s) found!`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

// Run the script
fixFootballPlayersCount()
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
