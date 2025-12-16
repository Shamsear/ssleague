require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

async function checkTypes() {
  const fantasyDb = neon(process.env.FANTASY_DATABASE_URL);
  
  console.log('🔍 Checking fantasy team ID types...\n');
  
  try {
    // Check fantasy_teams table
    console.log('1️⃣ fantasy_teams table:');
    const teams = await fantasyDb`
      SELECT id, league_id, team_name
      FROM fantasy_teams
      WHERE league_id = 'SSPSLFLS16'
      LIMIT 3
    `;
    console.log('Teams:', teams);
    console.log('ID type:', typeof teams[0]?.id);
    
    // Check fantasy_squad table
    console.log('\n2️⃣ fantasy_squad table:');
    const squad = await fantasyDb`
      SELECT team_id, real_player_id, player_name, is_captain
      FROM fantasy_squad
      WHERE real_player_id = 'sspslpsl0098'
      LIMIT 3
    `;
    console.log('Squad:', squad);
    console.log('team_id type:', typeof squad[0]?.team_id);
    
    // Try direct match
    if (teams.length > 0 && squad.length > 0) {
      console.log('\n3️⃣ Comparison:');
      console.log(`Team ID: "${teams[0].id}" (${typeof teams[0].id})`);
      console.log(`Squad team_id: "${squad[0].team_id}" (${typeof squad[0].team_id})`);
      console.log(`Match: ${teams[0].id == squad[0].team_id}`);
      console.log(`Strict match: ${teams[0].id === squad[0].team_id}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkTypes();
