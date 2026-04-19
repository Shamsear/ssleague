const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

async function findMissingPlayers() {
  console.log('Searching for missing players with alternative spellings...\n');
  
  // Di Stéfano - try various spellings
  console.log('1. Searching for Di Stéfano:');
  let results = await sql`
    SELECT player_id, name, team_name 
    FROM footballplayers 
    WHERE LOWER(name) LIKE '%stefano%' OR LOWER(name) LIKE '%di stefano%'
    LIMIT 10
  `;
  console.log(`   Found ${results.length} matches:`);
  results.forEach(r => console.log(`   - ${r.name} (${r.team_name})`));
  
  // J. Branthwaite - try various spellings
  console.log('\n2. Searching for J. Branthwaite:');
  results = await sql`
    SELECT player_id, name, team_name 
    FROM footballplayers 
    WHERE LOWER(name) LIKE '%branthwaite%' OR LOWER(name) LIKE '%brathwait%'
    LIMIT 10
  `;
  console.log(`   Found ${results.length} matches:`);
  results.forEach(r => console.log(`   - ${r.name} (${r.team_name})`));
  
  // A. Zendejas - try various spellings
  console.log('\n3. Searching for A. Zendejas:');
  results = await sql`
    SELECT player_id, name, team_name 
    FROM footballplayers 
    WHERE LOWER(name) LIKE '%zendejas%' OR LOWER(name) LIKE '%zendeja%'
    LIMIT 10
  `;
  console.log(`   Found ${results.length} matches:`);
  results.forEach(r => console.log(`   - ${r.name} (${r.team_name})`));
  
  process.exit(0);
}

findMissingPlayers().catch(err => {
  console.error(err);
  process.exit(1);
});
