const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.NEON_AUCTION_DB_URL);

(async () => {
  try {
    console.log('=== Checking teams table ===\n');
    
    // Get teams from Neon
    const teams = await sql`
      SELECT id, name, firebase_uid, season_id
      FROM teams
      WHERE season_id = 'SSPSLS17'
      ORDER BY name
    `;
    
    console.log('Teams in Neon:');
    teams.forEach(t => {
      console.log(`  ID: ${t.id}, Name: ${t.name}, Firebase UID: ${t.firebase_uid}`);
    });
    
    // Check footballplayers with team IDs
    console.log('\n=== Checking footballplayers ===\n');
    const players = await sql`
      SELECT DISTINCT team_id
      FROM footballplayers
      WHERE season_id = 'SSPSLS17'
    `;
    
    console.log('Unique team_ids in footballplayers:');
    players.forEach(p => {
      console.log(`  ${p.team_id}`);
    });
    
    // Try to match them
    console.log('\n=== Matching team_ids ===\n');
    for (const player of players) {
      const matchingTeam = teams.find(t => 
        t.id === player.team_id || 
        t.firebase_uid === player.team_id
      );
      
      if (matchingTeam) {
        console.log(`✅ ${player.team_id} matches team: ${matchingTeam.name} (ID: ${matchingTeam.id}, Firebase: ${matchingTeam.firebase_uid})`);
      } else {
        console.log(`❌ ${player.team_id} - NO MATCH FOUND`);
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error);
  }
})();
