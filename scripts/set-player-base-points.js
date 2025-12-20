/**
 * Interactive Script to Set Player Base Points
 * 
 * This script allows you to set base points for players in a season.
 * Players are presented in alphabetical order for easy data entry.
 * 
 * Usage:
 *   node scripts/set-player-base-points.js
 */

require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');
const readline = require('readline');

const SEASON_ID = 'SSPSLS16'; // Change this to target different seasons

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Promisify question
function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function setPlayerBasePoints() {
  const sql = neon(process.env.NEON_TOURNAMENT_DB_URL);

  console.log('📝 Player Base Points Entry Tool\n');
  console.log('='.repeat(80));
  console.log(`Season: ${SEASON_ID}`);
  console.log('='.repeat(80));
  console.log('');

  try {
    // Step 1: Get all players for the season, sorted by team then player name
    console.log('📋 Loading players...\n');
    const players = await sql`
      SELECT 
        player_id,
        player_name,
        team,
        base_points,
        matches_played,
        goals_scored
      FROM player_seasons
      WHERE season_id = ${SEASON_ID}
      ORDER BY 
        CASE WHEN team IS NULL OR team = '' THEN 'ZZZZZ' ELSE team END ASC,
        player_name ASC
    `;

    console.log(`✅ Found ${players.length} players\n`);
    console.log('='.repeat(80));
    console.log('Instructions:');
    console.log('  • Players are grouped by TEAM (alphabetically)');
    console.log('  • Within each team, players are sorted alphabetically');
    console.log('  • Enter base points for each player');
    console.log('  • Press Enter to skip (keeps current value)');
    console.log('  • Type "quit" to exit');
    console.log('  • Type "save" to save and exit');
    console.log('='.repeat(80));
    console.log('');

    const updates = [];
    let currentIndex = 0;
    let currentTeam = null;

    for (const player of players) {
      currentIndex++;
      
      const teamName = player.team || 'No Team';
      
      // Print team header when team changes
      if (currentTeam !== teamName) {
        console.log('\n' + '='.repeat(80));
        console.log(`🏆 ${teamName.toUpperCase()}`);
        console.log('='.repeat(80));
        currentTeam = teamName;
      }
      
      console.log(`\n[${currentIndex}/${players.length}] ${player.player_name}`);
      console.log(`   Stats: ${player.matches_played || 0} matches, ${player.goals_scored || 0} goals`);
      console.log(`   Current Base Points: ${player.base_points || 0}`);
      
      const answer = await question(`   Enter base points (or press Enter to skip): `);
      
      if (answer.toLowerCase() === 'quit') {
        console.log('\n❌ Exiting without saving...');
        rl.close();
        return;
      }
      
      if (answer.toLowerCase() === 'save') {
        console.log('\n💾 Saving and exiting...');
        break;
      }
      
      if (answer.trim() === '') {
        console.log('   ⏭️  Skipped');
        continue;
      }
      
      const basePoints = parseInt(answer);
      
      if (isNaN(basePoints)) {
        console.log('   ⚠️  Invalid number, skipping');
        continue;
      }
      
      updates.push({
        player_id: player.player_id,
        player_name: player.player_name,
        team: teamName,
        base_points: basePoints,
        old_base_points: player.base_points || 0
      });
      
      console.log(`   ✅ Will set to ${basePoints} (change: ${basePoints - (player.base_points || 0) > 0 ? '+' : ''}${basePoints - (player.base_points || 0)})`);
    }

    rl.close();

    // Step 2: Confirm and save
    if (updates.length === 0) {
      console.log('\n\nℹ️  No changes to save.');
      return;
    }

    console.log('\n\n' + '='.repeat(80));
    console.log('📊 Summary of Changes:');
    console.log('='.repeat(80));
    console.log('');
    
    // Group by team for summary
    const byTeam = {};
    updates.forEach(update => {
      if (!byTeam[update.team]) {
        byTeam[update.team] = [];
      }
      byTeam[update.team].push(update);
    });
    
    Object.keys(byTeam).sort().forEach(team => {
      console.log(`\n🏆 ${team}:`);
      byTeam[team].forEach(update => {
        const change = update.base_points - update.old_base_points;
        console.log(`   • ${update.player_name}: ${update.old_base_points} → ${update.base_points} (${change > 0 ? '+' : ''}${change})`);
      });
    });

    console.log('');
    console.log(`Total: ${updates.length} player(s) will be updated`);
    console.log('');

    // Create a new readline for confirmation
    const rl2 = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const confirm = await new Promise(resolve => {
      rl2.question('Proceed with update? (yes/no): ', answer => {
        rl2.close();
        resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
      });
    });

    if (!confirm) {
      console.log('\n❌ Update cancelled');
      return;
    }

    // Step 3: Update database
    console.log('\n💾 Updating database...\n');
    
    let updated = 0;
    let errors = 0;

    for (const update of updates) {
      try {
        await sql`
          UPDATE player_seasons
          SET 
            base_points = ${update.base_points},
            updated_at = NOW()
          WHERE player_id = ${update.player_id}
            AND season_id = ${SEASON_ID}
        `;
        updated++;
        process.stdout.write(`\r   Progress: ${updated}/${updates.length} players updated...`);
      } catch (error) {
        console.error(`\n❌ Error updating ${update.player_name}:`, error.message);
        errors++;
      }
    }

    console.log('\n\n✅ Update complete!\n');
    console.log('📊 Results:');
    console.log(`   Updated: ${updated} players`);
    console.log(`   Errors: ${errors}`);
    console.log('');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('\n❌ Error:', error);
    rl.close();
    throw error;
  }
}

// Run the script
if (require.main === module) {
  setPlayerBasePoints()
    .then(() => {
      console.log('\n✅ Script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { setPlayerBasePoints };
