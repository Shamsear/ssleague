const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

async function findPlayers() {
  console.log('Looking up players by ID...\n');
  console.log('='.repeat(80));
  
  const playerIds = ['2078', '318', '788'];
  
  for (const id of playerIds) {
    const players = await sql`
      SELECT id, player_id, name, position, team_name, club, overall_rating, status
      FROM footballplayers
      WHERE id = ${id}
    `;
    
    if (players.length > 0) {
      const p = players[0];
      console.log(`\nID: ${id}`);
      console.log(`  Name: ${p.name}`);
      console.log(`  Position: ${p.position}`);
      console.log(`  Team: ${p.team_name}`);
      console.log(`  Club: ${p.club}`);
      console.log(`  Overall Rating: ${p.overall_rating}`);
      console.log(`  Status: ${p.status}`);
      console.log(`  Player ID (eFootball): ${p.player_id}`);
    } else {
      console.log(`\nID: ${id} - NOT FOUND`);
    }
  }
  
  console.log('\n' + '='.repeat(80));
  
  process.exit(0);
}

findPlayers().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
