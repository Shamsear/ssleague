const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });

const sql = neon(process.env.NEON_TOURNAMENT_DB_URL);

async function checkTrophies() {
  const trophies = await sql`
    SELECT team_name, trophy_name, trophy_position 
    FROM team_trophies 
    WHERE season_id = 'SSPSLS16' 
      AND trophy_name LIKE '%League%'
    ORDER BY trophy_name
  `;
  
  console.log('League trophies in database:');
  trophies.forEach(t => {
    console.log(`  ${t.team_name}: "${t.trophy_name}" | "${t.trophy_position}"`);
    console.log(`    Key: ${t.trophy_name}|${t.trophy_position}`);
  });
  
  console.log('\n\nWhat preview is checking for:');
  console.log('  SS Super League S16 League|Shield Winner');
  console.log('  SS Super League S16 League|Knockout Winner');
  console.log('  SS Super League S16 League|Knockout Runner Up');
}

checkTrophies().catch(console.error);
