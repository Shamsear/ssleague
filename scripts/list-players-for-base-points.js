/**
 * List Players for Base Points Entry
 * 
 * This script lists all players in alphabetical order so you can
 * prepare base points data before running the update script.
 */

require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

const SEASON_ID = 'SSPSLS16';

async function listPlayers() {
  const sql = neon(process.env.NEON_TOURNAMENT_DB_URL);

  console.log('📋 Players List for Base Points Entry\n');
  console.log('='.repeat(80));
  console.log(`Season: ${SEASON_ID}`);
  console.log('='.repeat(80));
  console.log('');

  try {
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

    console.log(`Found ${players.length} players:\n`);
    console.log('='.repeat(80));
    
    let currentTeam = null;
    let playerIndex = 0;
    
    players.forEach((player) => {
      const teamName = player.team || 'No Team';
      
      // Print team header when team changes
      if (currentTeam !== teamName) {
        if (currentTeam !== null) {
          console.log(''); // Extra line between teams
        }
        console.log(`\n🏆 ${teamName.toUpperCase()}`);
        console.log('-'.repeat(80));
        currentTeam = teamName;
      }
      
      playerIndex++;
      console.log(`${playerIndex}. ${player.player_name}`);
      console.log(`   Stats: ${player.matches_played || 0} matches, ${player.goals_scored || 0} goals`);
      console.log(`   Current Base Points: ${player.base_points || 0}`);
      console.log('');
    });

    console.log('='.repeat(80));
    console.log('\nTo set base points, run:');
    console.log('  node scripts/set-player-base-points.js');
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

listPlayers()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
