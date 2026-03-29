const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.NEON_TOURNAMENT_DB_URL);

async function checkStructure() {
  try {
    console.log('🔍 Checking realplayerstats table structure...\n');

    // Get a sample record to see all columns
    const sample = await sql`
      SELECT *
      FROM realplayerstats
      LIMIT 1
    `;

    if (sample.length > 0) {
      console.log('📋 Available columns:');
      console.log(Object.keys(sample[0]).join(', '));
      console.log('\n📄 Sample record:');
      console.log(JSON.stringify(sample[0], null, 2));
    }

    // Check if there's a teams column
    const withTeams = await sql`
      SELECT id, player_id, player_name, season_id, team_id, teams
      FROM realplayerstats
      WHERE teams IS NOT NULL AND teams != ''
      LIMIT 5
    `;

    console.log('\n\n🏆 Sample records with teams column:');
    withTeams.forEach(record => {
      console.log(`\nPlayer: ${record.player_name} (${record.player_id})`);
      console.log(`Season: ${record.season_id}`);
      console.log(`Current team_id: ${record.team_id || '(null)'}`);
      console.log(`Teams value: ${record.teams}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

checkStructure();
