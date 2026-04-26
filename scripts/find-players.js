const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.NEON_AUCTION_DB_URL || process.env.DATABASE_URL);

async function findPlayers() {
  const names = ['palhinha', 'joao', 'perisic', 'ivan', 'szoboszlai', 'olise'];
  
  for (const name of names) {
    const results = await sql`
      SELECT name, player_id, team_id 
      FROM footballplayers 
      WHERE LOWER(name) LIKE ${'%' + name + '%'}
      LIMIT 5
    `;
    
    if (results.length > 0) {
      console.log(`\nMatches for "${name}":`);
      results.forEach(p => console.log(`  - ${p.name} (${p.player_id}) - Team: ${p.team_id}`));
    }
  }
}

findPlayers().then(() => process.exit(0));
